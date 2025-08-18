from flask import Flask, render_template, request, jsonify, session, send_file
from datetime import datetime, timezone
from db import Base, engine, SessionLocal
from models import Order, Task, TaskHistory
from io import BytesIO
import openpyxl
from openpyxl import Workbook
import warnings
from sqlalchemy import text
import re, unicodedata
warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

def utcnow():
    return datetime.now(timezone.utc)

task_timers = {}

app = Flask(__name__)
app.config.from_object("config")

# Create tables on first run (we'll add Alembic later)
Base.metadata.create_all(bind=engine)

def as_utc(dt):
    """Return a timezone-aware UTC datetime from DB value (datetime or str)."""
    if not dt:
        return None
    if isinstance(dt, str):
        s = dt.replace('Z', '+00:00')           # accept Z suffix
        try:
            dt = datetime.fromisoformat(s)
        except Exception:
            # last-resort parse; treat as UTC
            try:
                dt = datetime.strptime(dt, "%Y-%m-%d %H:%M:%S.%f")
            except Exception:
                dt = datetime.strptime(dt, "%Y-%m-%d %H:%M:%S")
            dt = dt.replace(tzinfo=timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt

def recalc_active_groups(order):
    # derive from tasks where remaining > 0
    groups = []
    for t in order.tasks:
        remaining = max(0, (t.quantity or 0) - (t.completed or 0))
        if remaining > 0 and t.group and t.group not in groups:
            groups.append(t.group)
    return groups

def order_progress(order):
    total_q = sum((t.quantity or 0) for t in order.tasks)
    done_q = sum((t.completed or 0) for t in order.tasks)
    return (done_q, total_q)

@app.route("/")
def home():
    with SessionLocal() as session:
        orders = session.query(Order).order_by(Order.id.desc()).all()
        today = datetime.today().strftime("%Y/%m/%d")
        # Build a light-weight view model for template simplicity
        vm = []
        for o in orders:
            done_q, total_q = order_progress(o)
            vm.append({
                "id": o.id,
                "manufacture_code": o.manufacture_code or "",
                "customer": o.customer or "",
                "product": o.product or "",
                "demand_date": o.demand_date or "",
                "delivery": o.delivery or "",
                "quantity": o.quantity or 0,
                "datecreate": o.datecreate or "",
                "fengbian": o.fengbian or "",
                "wallpaper": o.wallpaper or "",
                "jobdesc": o.jobdesc or "",
                "active_groups": ", ".join(recalc_active_groups(o)),
                "progress": (done_q, total_q),
                "sub_tasks": [
                    {
                        "id": t.id,
                        "group": t.group or "",
                        "task": t.task or "",
                        "quantity": t.quantity or 0,
                        "completed": t.completed or 0,
                        "remaining": max(0, (t.quantity or 0) - (t.completed or 0)),
                        "running": bool(getattr(t, "start_time", None) and not getattr(t, "stop_time", None)),
                        "started_at": (t.start_time.isoformat() if getattr(t, "start_time", None) else None),
                    } for t in o.tasks
                ]
            })
        return render_template("index.html", orders=vm, today_date=today)

@app.route("/add_order", methods=["POST"])
def add_order():
    data = request.get_json()
    with SessionLocal() as session:
        o = Order(
            manufacture_code=data.get("manufacture_code"),
            customer=data.get("customer"),
            product=data.get("product"),
            demand_date=data.get("demand_date"),
            delivery=data.get("delivery"),
            quantity=int(data.get("quantity", 0)),
            datecreate=data.get("datecreate"),
            fengbian=data.get("fengbian"),
            wallpaper=data.get("wallpaper"),
            jobdesc=data.get("jobdesc"),
        )
        session.add(o)
        session.flush()  # get o.id before commit

        # Create tasks from planned stations
        for t in data.get("initial_tasks", []):
            session.add(Task(
                order_id=o.id,
                group=t.get("group"),
                task=t.get("task"),
                quantity=o.quantity,
                completed=0
            ))

        session.commit()
        return jsonify(success=True, order_id=o.id)

@app.route("/add_task", methods=["POST"])
def add_task():
    data = request.get_json()
    with SessionLocal() as session:
        order_id = int(data["order_id"])
        o = session.get(Order, order_id)
        if not o:
            return jsonify(success=False, message="Order not found"), 404

        t = Task(
            order_id=o.id,
            group=data.get("group"),
            task=data.get("task"),
            quantity=int(data.get("quantity", 0)),
            completed=int(data.get("completed", 0)),
        )
        session.add(t)
        session.commit()
        return jsonify(success=True, task_id=t.id)

@app.route("/get_task/<int:task_id>")
def get_task(task_id):
    with SessionLocal() as session:
        t = session.get(Task, task_id)
        if not t:
            return jsonify(success=False, message="Task not found"), 404
        return jsonify(success=True, task={
            "id": t.id, "order_id": t.order_id, "group": t.group or "",
            "task": t.task or "", "quantity": t.quantity or 0, "completed": t.completed or 0
        })

@app.route("/update_task", methods=["POST"])
def update_task():
    data = request.get_json()
    order_id = int(data["order_id"])
    task_id = int(data["task_id"])
    new_completed = int(data.get("completed", 0))
    note = data.get("note", "")
    with SessionLocal() as session:
        t = session.query(Task).filter_by(id=task_id, order_id=order_id).first()
        if not t:
            return jsonify(success=False, message="Task not found"), 404
        prev = t.completed or 0
        t.completed = max(0, min(new_completed, t.quantity or 0))  # clamp
        label = note or ("update" if t.completed != prev else "noop")
        session.add(TaskHistory(
            task_id=t.id,
            timestamp=datetime.now(timezone.utc),
            delta=(t.completed - prev),
            note=label,
            completed=t.completed
        ))
        session.commit()
        return jsonify(success=True, completed=t.completed)
    
def iso(dt):
    if not dt:
        return None
    if isinstance(dt, str):
        # 'YYYY-MM-DD HH:MM:SS(.ffffff)?(+00:00)?' -> ISO + Z
        s = dt.strip().replace(' ', 'T')
        if s.endswith('+00:00'):
            s = s[:-6] + 'Z'
        elif s[-1].isdigit():  # no tz info, assume UTC
            s += 'Z'
        return s
    # datetime
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")

@app.route("/task-history/<int:task_id>")
def task_history(task_id):
    def iso(dt):
        if not dt:
            return None
        # If it's naive, treat as UTC
        if isinstance(dt, str):
            # already text, best effort pass-through
            return dt
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")

    with SessionLocal() as session:
        rows = (session.query(TaskHistory)
                .filter(TaskHistory.task_id == task_id)
                .order_by(TaskHistory.id.desc())  # stable, monotonic
                .all())

        out = []
        for h in rows:
            out.append({
                "id": h.id,
                "completed": h.completed,
                "delta": getattr(h, "delta", None),
                "note": h.note,
                "timestamp": iso(h.timestamp),
                "start_time": iso(h.start_time),
                "stop_time": iso(h.stop_time),
                "duration_minutes": h.duration_minutes
            })
        return jsonify(out)

@app.route("/delete_task", methods=["POST"])
def delete_task():
    data = request.get_json()
    order_id = int(data["order_id"])
    task_id = int(data["task_id"])
    with SessionLocal() as session:
        t = session.query(Task).filter_by(id=task_id, order_id=order_id).first()
        if not t:
            return jsonify(success=False, message="Task not found"), 404
        session.delete(t)
        session.commit()
        return jsonify(success=True)

@app.route("/delete_order", methods=["POST"])
def delete_order():
    data = request.get_json()
    order_id = int(data["order_id"])
    with SessionLocal() as session:
        o = session.get(Order, order_id)
        if not o:
            return jsonify(success=False, message="Order not found"), 404
        session.delete(o)
        session.commit()
        return jsonify(success=True)

@app.route("/update_order", methods=["POST"])
def update_order():
    data = request.get_json()
    with SessionLocal() as session:
        o = session.get(Order, int(data["order_id"]))
        if not o:
            return jsonify(success=False, message="Order not found"), 404
        # Save all editable fields
        o.manufacture_code = data.get("manufacture_code", o.manufacture_code)
        o.customer = data.get("customer", o.customer)
        o.product = data.get("product", o.product)
        o.demand_date = data.get("demand_date", o.demand_date)
        o.delivery = data.get("delivery", o.delivery)
        o.quantity = int(data.get("quantity", o.quantity or 0))
        o.datecreate = data.get("datecreate", o.datecreate)
        o.fengbian = data.get("fengbian", o.fengbian)
        o.wallpaper = data.get("wallpaper", o.wallpaper)
        o.jobdesc = data.get("jobdesc", o.jobdesc)
        o.updated_at = datetime.utcnow()
        session.commit()
        return jsonify(success=True)
    
@app.route("/update_task_info", methods=["POST"])
def update_task_info():
    data = request.get_json()
    task_id = int(data["task_id"])
    order_id = int(data["order_id"])

    with SessionLocal() as session:
        t = session.query(Task).filter_by(id=task_id, order_id=order_id).first()
        if not t:
            return jsonify(success=False, message="Task not found"), 404
        t.group = data.get("group", t.group)
        t.task = data.get("task", t.task)
        t.quantity = int(data.get("quantity", t.quantity or 0))
        session.commit()
        return jsonify(success=True)
    
@app.route("/update_task_timer", methods=["POST"])
def update_task_timer():
    data = request.get_json()
    task_id = int(data["task_id"])
    action = data["action"]

    now = datetime.now(timezone.utc)

    with SessionLocal() as session:
        t = session.get(Task, task_id)
        if not t:
            return jsonify(success=False, message="Task not found"), 404

        if action == "start":
            if t.start_time is None:
                t.start_time = now
                session.add(TaskHistory(
                    task_id=task_id, timestamp=now, note="start", completed=t.completed
                ))
            # duplicate starts are ignored

        elif action == "stop":
            start_dt = as_utc(t.start_time)
            if start_dt is None:
                last_start = (session.query(TaskHistory)
                              .filter(TaskHistory.task_id == task_id,
                                      TaskHistory.note == "start")
                              .order_by(TaskHistory.id.desc())
                              .first())
                start_dt = as_utc(last_start.timestamp) if last_start else None

            dur_min = int((now - start_dt).total_seconds() // 60) if start_dt else None

            session.add(TaskHistory(
                task_id=task_id, timestamp=now, note="stop",
                completed=t.completed, start_time=start_dt, stop_time=now,
                duration_minutes=dur_min
            ))
            t.start_time = None

        session.commit()

    return jsonify(success=True)

with open("schema.sql", "r", encoding="utf-8") as f:
    schema = f.read()

@app.route("/export/orders.xlsx")
def export_orders_xlsx():
    wb = Workbook()
    ws_orders = wb.active
    ws_orders.title = "orders"

    # Header row (match your UI)
    ws_orders.append(["客戶交期","預計出貨","製令號碼","專案名稱","產品名稱","數量","派單日","封邊","面飾","作業內容","order_id"])

    with SessionLocal() as s:
        orders = s.query(Order).order_by(Order.id).all()
        for o in orders:
            ws_orders.append([
                o.demand_date or "",
                o.delivery or "",
                o.manufacture_code or "",
                o.customer or "",
                o.product or "",
                o.quantity or 0,
                o.datecreate or "",
                o.fengbian or "",
                o.wallpaper or "",
                o.jobdesc or "",
                o.id,
            ])

        # tasks sheet
        ws_tasks = wb.create_sheet("tasks")
        ws_tasks.append(["order_id","組別","工作內容","數量","已完成","task_id"])
        tasks = s.query(Task).order_by(Task.order_id, Task.id).all()
        for t in tasks:
            ws_tasks.append([t.order_id, t.group or "", t.task or "", t.quantity or 0, t.completed or 0, t.id])

    bio = BytesIO()
    wb.save(bio)
    bio.seek(0)
    return send_file(
        bio,
        as_attachment=True,
        download_name="orders_export.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

def _cell(v):
    # keep as string; your DB stores text dates already
    return "" if v is None else str(v).replace("\n","").strip()

def _norm(s):
    if s is None: return ""
    s = unicodedata.normalize("NFKC", str(s))
    return s.replace("\n","").replace(" ","").strip()

def _find_header(ws):
    for r_idx, row in enumerate(ws.iter_rows(values_only=True), start=1):
        vals = [_norm(v) for v in row]
        if any(vals):
            return vals, r_idx
    return None, None

# --- flexible patterns (substring/regex) ---
PATTERNS = {
    # demand date: 客戶要求交期 / 客戶交期
    "demand":   [r"客戶.*交期"],
    # delivery: 任意含「出貨/出货」，covers 預計可出貨日 / 預計出貨 / 可出貨日 ...
    "delivery": [r"出貨", r"出货"],
    # code: 製令(號碼/号码) with or without line breaks
    "code":     [r"製令.*(號碼|号码)"],
    "customer": [r"專案名稱"],
    "product":  [r"產品.*名"],
    "qty":      [r"數量"],
    "datecre":  [r"派單日|派单日"],
    "fengbian": [r"封邊|封边"],
    "wall":     [r"面飾|面饰"],
    "jobdesc":  [r"作業內容|作业.*容"],
}

def _col_by_patterns(header, patterns):
    for i, h in enumerate(header):
        for pat in patterns:
            if re.search(pat, h):
                return i
    return None

@app.route("/import_orders", methods=["POST"])
def import_orders():
    f = request.files.get("file")
    if not f:
        return jsonify(success=False, message="No file"), 400

    # take explicit sheet name from query (?sheet=生產中門框) or form field
    sheet_name = (request.args.get("sheet") or request.form.get("sheet") or "").strip()

    wb = openpyxl.load_workbook(f, read_only=True, data_only=True)

    # choose sheet without scanning all sheetnames if user provided one
    if sheet_name:
        try:
            ws = wb[sheet_name]
        except KeyError:
            return jsonify(success=False, message=f"找不到工作表: {sheet_name}"), 400
    else:
        # default: first sheet (no sheet scanning)
        ws = wb[wb.sheetnames[0]]

    header, header_row = _find_header(ws)
    if not header:
        return jsonify(success=False, message="找不到標題列"), 400

    # acceptable synonyms
    synonyms = {
        "demand":   {"客戶交期","客戶要求交期"},
        "delivery": {"預計出貨","可出貨日"},
        "code":     {"製令號碼","製令号碼","製令号码"},
        "customer": {"專案名稱"},
        "product":  {"產品名稱","產品名"},
        "qty":      {"數量"},
        "datecre":  {"派單日","派单日"},
        "fengbian": {"封邊","封边"},
        "wall":     {"面飾","面饰"},
        "jobdesc":  {"作業內容","作业內容","作业内容"},
    }

    def col(keys):
        for k in keys:
            if k in header:
                return header.index(k)
        return None

    # make a header index on THIS sheet only
    idx = {k: _col_by_patterns(header, v) for k, v in PATTERNS.items()}

    required_keys = ["demand","delivery","code","customer","product","qty","datecre"]
    missing = [k for k in required_keys if idx[k] is None]
    if missing:
        # friendlier error showing which ones are missing
        zh = {
            "demand":"客戶交期",
            "delivery":"預計出貨",
            "code":"製令號碼",
            "customer":"專案名稱",
            "product":"產品名稱",
            "qty":"數量",
            "datecre":"派單日"
        }
        miss_names = "、".join(zh[k] for k in missing)
        return jsonify(success=False, message=f"此工作表缺少必要欄位：{miss_names}（{sheet_name or ws.title}）"), 400

    def cell(v):
        return "" if v is None else str(v).strip()

    created = 0
    with SessionLocal() as s:
        for row in ws.iter_rows(min_row=header_row+1, values_only=True):
            if not row or not any(row): 
                continue
            def get(key):
                i = idx[key]
                return cell(row[i]) if i is not None and i < len(row) else ""

            try:
                qty = int((get("qty") or "0"))
            except ValueError:
                qty = 0

            o = Order(
                demand_date      = get("demand"),
                delivery         = get("delivery"),
                manufacture_code = get("code"),
                customer         = get("customer"),
                product          = get("product"),
                quantity         = qty,
                datecreate       = get("datecre"),
                fengbian         = get("fengbian"),
                wallpaper        = get("wall"),
                jobdesc          = get("jobdesc"),
            )
            s.add(o)
            created += 1

        s.commit()

    return jsonify(success=True, created=created, sheet=sheet_name or ws.title)

if __name__ == "__main__":
    app.run(debug=True)
