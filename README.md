# ERP / MES Lite — Meanhome Woodwork

A lightweight **ERP/MES web app** for the factory floor: track work orders, station progress, daily output, and print-friendly views for each station.

> Built with **Flask + SQLite** and designed to be simple, reliable, and fast for production teams.

---

## ✨ Features

- **Work Orders & Stations**
  - Create/update jobs, track per-station completion, operator notes
  - “Today” view for quick stand-ups
- **Progress Input UX**
  - Inline update fields, validation, optional notes per task
- **Print-friendly Pages**
  - Dedicated CSS for A4; station headers, compact tables (no extra chrome)
- **Multilingual-ready**
  - EN / 中文 / Bahasa-friendly templates (copy resources and extend)
- **Deployment-friendly**
  - Works with **waitress** / **gunicorn**, **Cloudflare Tunnel** / reverse proxy

---

## 🧱 Tech Stack

- **Backend**: Python 3.10+, Flask, Jinja2
- **DB**: SQLite (SQLAlchemy optional)
- **Frontend**: HTML/CSS, a sprinkle of JS
- **Serving**: waitress or gunicorn
- **Optional**: Cloudflare Tunnel for secure public access

---

👋 Author

Rizky Febri Ibra Habibie

Email: rizkyfebriibrahabibie@gmail.com

LinkedIn: [/in/rizkyfebriibrahabibie/](https://www.linkedin.com/in/rizkyfebriibrahabibie/)
