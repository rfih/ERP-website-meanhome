from flask import Flask, render_template, request, jsonify
from datetime import datetime
from db import Base, engine, SessionLocal
from models import Order, Task, TaskHistory
import sqlite3

app = Flask(__name__)
app.config.from_object("config")

# Create tables on first run (we'll add Alembic later)
Base.metadata.create_all(bind=engine)

def get_db_connection():
    conn = sqlite3.connect("database.db", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

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
                        "remaining": max(0, (t.quantity or 0) - (t.completed or 0))
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
            note=data.get("note", ""),
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
        session.add(TaskHistory(task_id=t.id, delta=(t.completed - prev), note=note))
        session.commit()
        return jsonify(success=True, completed=t.completed)

@app.route("/task-history/<int:task_id>")
def task_history(task_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, completed, timestamp, start_time, stop_time, duration_minutes 
        FROM task_history 
        WHERE task_id = ? 
        ORDER BY timestamp DESC
    """, (task_id,))
    history = cur.fetchall()
    conn.close()

    history_data = []
    for row in history:
        history_data.append({
            "id": row["id"],
            "completed": row["completed"],
            "timestamp": row["timestamp"],
            "start_time": row["start_time"],
            "stop_time": row["stop_time"],
            "duration_minutes": row["duration_minutes"]
        })
    return jsonify(history_data)


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
    task_id = data["task_id"]
    action = data["action"]  # "start" or "stop"

    conn = get_db_connection()
    cur = conn.cursor()

    if action == "start":
        cur.execute("UPDATE sub_tasks SET start_time = datetime('now') WHERE id = ?", (task_id,))
        cur.execute("""INSERT INTO task_history (task_id, timestamp, note) VALUES (?, datetime('now'), ?)""", (task_id, 'Start'))
    elif action == "stop":
        cur.execute("""
            UPDATE sub_tasks
            SET stop_time = datetime('now'),
                duration_minutes = CAST((strftime('%s', datetime('now')) - strftime('%s', start_time)) / 60 AS INTEGER)
            WHERE id = ?
        """, (task_id,))
        cur.execute("INSERT INTO task_history (task_id, timestamp, note) VALUES (?, datetime('now'), ?)", 
                    (task_id, 'Stop'))

    conn.commit()
    conn.close()
    return jsonify(success=True)

with open("schema.sql", "r", encoding="utf-8") as f:
    schema = f.read()

if __name__ == "__main__":
    app.run(debug=True)
