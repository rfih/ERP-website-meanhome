import sqlite3

with open("schema.sql", "r", encoding="utf-8") as f:
    schema = f.read()

# If you're using 'database.db', change this to 'production.db' if needed
conn = sqlite3.connect("database.db")  
cur = conn.cursor()

# Execute schema
cur.executescript(schema)

print("✅ Database initialized successfully.")

conn.commit()
conn.close()
