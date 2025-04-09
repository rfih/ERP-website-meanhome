from flask import Flask, render_template, request, jsonify
from datetime import datetime
import copy

app = Flask(__name__)
#mulai
orders = [
    {
        "id": 1,
        "demand_date": "2025/04/25",
        "delivery": "2025/05/01",
        "manufacture_code": "B25000101",
        "customer": "森華",
        "product": "F60A",
        "quantity": 30,
        "datecreate": "2025/04/30",
        "fengbian": "實木封邊",
        "wallpaper": "美耐板",
        "jobdesc": "凹槽把手.下降條.磁簧孔.龍吐珠.天地栓",
        "stations": ["框架組", "膠合組"],
        "active_groups": ["框架組", "膠合組"],
        "sub_tasks": [
            {
                "id": 1,
                "group": "框架組",
                "quantity": 15,
                "task": "釘門檻",
                "completed": 14,
                "note": "",
                "history": [
                    {"timestamp": "2025/03/25 08:00", "delta": 3},
                    {"timestamp": "2025/03/26 08:00", "delta": 4}
                ]
            },
            {
                "id": 2,
                "group": "膠合組",
                "quantity": 30,
                "task": "貼木皮",
                "completed": 20,
                "note": "",
                "history": [
                    {"timestamp": "2025/03/25 08:00", "delta": 5},
                    {"timestamp": "2025/03/26 08:00", "delta": 6}
                ]
            }
        ]
    },
    {
        "id": 2,
        "demand_date": "2025/05/15",
        "delivery": "2025/05/01",
        "manufacture_code": "B25000202",
        "customer": "大陸工程",
        "product": "F30A",
        "quantity": 40,
        "datecreate": "2025/04/30",
        "fengbian": "鐵(如)",
        "wallpaper": "OL8844",
        "jobdesc": "電子鎖.隱弓.",
        "stations": ["框架組", "膠合組"],
        "active_groups": ["框架組", "膠合組"],
        "sub_tasks": [
            {
                "id": 3,  # ✅ UNIQUE across all orders
                "group": "框架組",
                "quantity": 15,
                "task": "釘門檻",
                "completed": 10,
                "note": "",
                "history": [
                    {"timestamp": "2025/03/26 09:00", "delta": 2}
                ]
            },
            {
                "id": 4,  # ✅ UNIQUE across all orders
                "group": "膠合組",
                "quantity": 40,
                "task": "貼木皮",
                "completed": 33,
                "note": "",
                "history": [
                    {"timestamp": "2025/03/25 09:00", "delta": 7}
                ]
            }
        ]
    }
]

@app.route("/")
def home():
    today_date = datetime.today().strftime("%Y/%m/%d")
    return render_template("index.html", orders=orders, today_date=today_date)

@app.route("/update_task", methods=["POST"])
def update_task():
    data = request.json
    now = datetime.now().strftime("%Y/%m/%d %H:%M")

    task_id = data["task_id"]
    order_id = data["order_id"]  # ✅ NEW

    for order in orders:
        if order["id"] != order_id:  # ✅ Filter by specific order only
            continue
        for task in order["sub_tasks"]:
            if task["id"] == task_id:
                prev = task["completed"]
                delta = data["completed"] - prev
                task["completed"] = data["completed"]

                if "note" in data:
                    task["note"] = data["note"]

                if "history" not in task:
                    task["history"] = []

                if delta != 0:
                    task["history"].append({ "timestamp": now, "delta": delta })

                return jsonify({
                    "success": True,
                    "task": {
                        "id": task["id"],
                        "completed": task["completed"],
                        "quantity": task["quantity"],
                        "timestamp": now,
                        "delta": delta
                    }
                })

    return jsonify({ "success": False, "message": "Task not found" })

@app.route("/add_order", methods=["POST"])
def add_order():
    data = request.json
    new_order = {
        "id": len(orders) + 1,
        "demand_date": data["demand_date"],
        "delivery": data["delivery"],
        "manufacture_code": data["manufacture_code"],
        "customer": data["customer"],
        "product": data["product"],
        "quantity": int(data["quantity"]),
        "datecreate": data["datecreate"],
        "fengbian": data["fengbian"],
        "wallpaper": data["wallpaper"],
        "jobdesc": data["jobdesc"],
        "active_groups": [],  # No active groups initially
        "sub_tasks": []
    }
    orders.append(new_order)
    return jsonify({"success": True, "orders": orders})

@app.route("/add_task", methods=["POST"])
def add_task():
    data = request.json

    # Compute a unique task id across all orders
    existing_ids = [task["id"] for order in orders for task in order["sub_tasks"]]
    new_task_id = max(existing_ids, default=0) + 1

    for order in orders:
        if order["id"] == data["order_id"]:
            new_task = {
                "id": new_task_id,  # ✅ Globally unique
                "group": data["group"],
                "quantity": data["quantity"],
                "task": data["task"],
                "completed": data["completed"],
                "note": "",
                "history": []
            }
            order["sub_tasks"].append(new_task)

            if data["group"] not in order["active_groups"]:
                order["active_groups"].append(data["group"])
            break

    return jsonify({"success": True, "task": new_task, "order_id": data["order_id"]})

@app.route("/delete_task", methods=["POST"])
def delete_task():
    data = request.json
    task_id = data.get("task_id")
    order_id = data.get("order_id")

    for order in orders:
        if order["id"] == order_id:
            order["sub_tasks"] = [t for t in order["sub_tasks"] if t["id"] != task_id]
            order["active_groups"] = sorted({t["group"] for t in order["sub_tasks"] if t["group"]})
            break

    return jsonify({"success": True})

@app.route("/delete_order", methods=["POST"])
def delete_order():
    data = request.json
    global orders
    orders = [order for order in orders if order["id"] != data["order_id"]]
    return jsonify({"success": True, "message": "Order deleted successfully"})

@app.route("/stations_summary")
def station_overview():
    selected_group = request.args.get("group", "物裁組")

    station_summary = {
        "quantity": 0,
        "completed": 0
    }

    for order in orders:
        for task in order["sub_tasks"]:
            if task["group"] == selected_group:
                station_summary["quantity"] += task["quantity"]
                station_summary["completed"] += task["completed"]

    today_date = datetime.today().strftime("%Y/%m/%d")
    return render_template(
        "stations.html",
        today_date=today_date,
        selected_group=selected_group,
        quantity=station_summary["quantity"],
        completed=station_summary["completed"],
        station_list=["物裁組", "框架組", "膠合組", "門裁組", "封邊組", "整修組", "CNC", "噴漆組", "包裝組", "四面刨組", "門框組", "自動缐組"]
    )

@app.route("/stations")
def stations():
    station_list = [
        "物裁組", "框架組", "膠合組", "門裁組", "封邊組", "整修組",
        "CNC", "噴漆組", "包裝組", "四面刨組", "門框組", "自動缐組"
    ]
    selected_group = request.args.get("group", station_list[0])

    filtered_orders = []
    for order in orders:
        filtered_sub_tasks = [t for t in order["sub_tasks"] if t["group"] == selected_group]
        if filtered_sub_tasks:
            order_copy = copy.deepcopy(order)
            order_copy["sub_tasks"] = filtered_sub_tasks
            filtered_orders.append(order_copy)
            
    tasks = []
    for order in filtered_orders:
        for task in order["sub_tasks"]:
            tasks.append({ "order": order, "task": task })

    today_date = datetime.today().strftime("%Y/%m/%d")
    print("Selected group:", selected_group, flush=True)
    print("Filtered orders:", filtered_orders, flush=True)
    return render_template("stations.html",
        orders=filtered_orders,
        tasks=tasks,
        station_list=station_list,
        selected_group=selected_group,
        today_date=today_date)
    

@app.route("/station_progress")
def station_progress():
    station = request.args.get("station")  # Get selected station
    today_date = datetime.today().strftime("%Y/%m/%d")

    # Filter tasks by station
    filtered = []
    for order in orders:
        for task in order["sub_tasks"]:
            if task["group"] == station:
                filtered.append({
                    "order_id": order["id"],
                    "demand_date": order["demand_date"],
                    "manufacture_code": order["manufacture_code"],
                    "customer": order["customer"],
                    "product": order["product"],
                    "quantity": order["quantity"],
                    "task": task
                })

    return render_template("station_progress.html", station=station, tasks=filtered, today_date=today_date)

@app.route("/task_history")
def task_history():
    order_id = int(request.args.get("order_id"))
    task_id = int(request.args.get("task_id"))

    for order in orders:
        if order["id"] == order_id:
            for task in order["sub_tasks"]:
                if task["id"] == task_id:
                    return jsonify({"history": task.get("history", [])})

    return jsonify({"history": []})

@app.route("/update_order", methods=["POST"])
def update_order():
    data = request.json
    for order in orders:
        if order["id"] == data["order_id"]:
            order["manufacture_code"] = data["manufacture_code"]
            order["customer"] = data["customer"]
            order["product"] = data["product"]
            order["demand_date"] = data["demand_date"]
            order["quantity"] = int(data["quantity"])
            return jsonify({"success": True})
    return jsonify({"success": False, "message": "Order not found"})

@app.route("/update_task_info", methods=["POST"])
def update_task_info():
    data = request.json
    for order in orders:
        if order["id"] == data["order_id"]:
            for task in order["sub_tasks"]:
                if task["id"] == data["task_id"]:
                    task["group"] = data["group"]
                    task["task"] = data["task"]
                    task["quantity"] = data["quantity"]
                    order["active_groups"] = list({t["group"] for t in order["sub_tasks"] if t.get("group")})
                    return jsonify({"success": True})
    return jsonify({"success": False, "message": "Task not found"})

def recalculate_active_groups(order):
    order["active_groups"] = sorted(
        {task["group"] for task in order["sub_tasks"] if task["group"]}
    )

@app.route("/get_task/<int:task_id>")
def get_task(task_id):
    for order in orders:
        for task in order["sub_tasks"]:
            if task["id"] == task_id:
                return jsonify({
                    "task": task,
                    "order_id": order["id"]
                })
    return jsonify({ "error": "not found" }), 404

@app.route("/update_note", methods=["POST"])
def update_note():
    data = request.get_json()
    task_id = data.get("task_id")
    order_id = data.get("order_id")
    new_note = data.get("note")

    for order in orders:
        if order["id"] == order_id:
            for task in order["sub_tasks"]:
                if task["id"] == task_id:
                    task["note"] = new_note
                    return jsonify({"success": True})

    return jsonify({"success": False, "message": "Task or order not found"})



if __name__ == "__main__":
    app.run(debug=True)
