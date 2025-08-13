# fix_sequence.py
import sqlite3

conn = sqlite3.connect("database.db")
c = conn.cursor()

# Make sure sqlite_sequence row exists
c.execute("INSERT OR IGNORE INTO sqlite_sequence(name, seq) VALUES('sub_tasks', 0)")

# Set to the max of current sub_tasks.id and any task_id appearing in task_history
c.execute("SELECT IFNULL(MAX(id), 0) FROM sub_tasks")
max_tasks = c.fetchone()[0] or 0
c.execute("SELECT IFNULL(MAX(task_id), 0) FROM task_history")
max_hist = c.fetchone()[0] or 0

target = max(max_tasks, max_hist)
c.execute("UPDATE sqlite_sequence SET seq = ? WHERE name = 'sub_tasks'", (target,))
conn.commit()
conn.close()
print("sub_tasks sequence set to", target)
