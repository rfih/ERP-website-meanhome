import sqlite3
from db import engine  # uses the same DB file as your app

db_path = engine.url.database
print("Using DB:", db_path)

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# current columns
cur.execute("PRAGMA table_info(task_history)")
cols = {row[1] for row in cur.fetchall()}
print("Before:", cols)

def add(col, coltype):
    if col not in cols:
        sql = f'ALTER TABLE task_history ADD COLUMN "{col}" {coltype}'
        print("Executing:", sql)
        cur.execute(sql)
        cols.add(col)

# exactly what your ORM insert expects
needed = {
    "completed": "INTEGER",
    "delta": "INTEGER",
    "note": "TEXT",
    "timestamp": "TEXT",
    "start_time": "TEXT",
    "stop_time": "TEXT",
    "duration_minutes": "INTEGER",
}

for c, t in needed.items():
    add(c, t)

conn.commit()

cur.execute("PRAGMA table_info(task_history)")
print("After:", [row[1] for row in cur.fetchall()])

conn.close()
print("✅ Migration done.")
