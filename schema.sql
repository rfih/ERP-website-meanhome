CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_date TEXT NOT NULL,
  customer TEXT NOT NULL,
  product TEXT NOT NULL,
  quantity INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sub_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  "group" TEXT NOT NULL,
  task TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  start_time TEXT,
  stop_time TEXT,
  duration_minutes INTEGER,
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS task_history;
CREATE TABLE task_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    note TEXT,
    completed INTEGER,
    timestamp TEXT,
    start_time TEXT,
    stop_time TEXT,
    duration_minutes INTEGER
);

CREATE TABLE IF NOT EXISTS task_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    note TEXT,
    completed INTEGER,
    timestamp TEXT,
    start_time TEXT,
    stop_time TEXT,
    duration_minutes INTEGER,
    FOREIGN KEY(task_id) REFERENCES sub_tasks(id)
);

ALTER TABLE task_history ADD COLUMN completed INTEGER;
ALTER TABLE task_history ADD COLUMN start_time TEXT;
ALTER TABLE task_history ADD COLUMN stop_time TEXT;
ALTER TABLE task_history ADD COLUMN duration_minutes INTEGER;

CREATE TABLE IF NOT EXISTS station_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL UNIQUE,
  "group" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_station_keywords_keyword
ON station_keywords(keyword);
