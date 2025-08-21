# models.py
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Boolean, DateTime, Boolean, Date,
)
from sqlalchemy.orm import relationship
from db import Base  # Base, engine, SessionLocal live in db.py


# Orders
class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Your business fields (keep them as TEXT/STRING to match existing DB)
    manufacture_code = Column(String)
    customer        = Column(String)
    product         = Column(String)
    demand_date     = Column(String)   # stored as text like "YYYY/MM/DD"
    delivery        = Column(String)   # stored as text
    quantity        = Column(Integer, default=0)
    datecreate      = Column(String)   # stored as text
    fengbian        = Column(String)
    wallpaper       = Column(String)
    jobdesc         = Column(Text)
    archived    = Column(Boolean, default=False)   # soft archive flag
    archived_at = Column(DateTime)                 # when it was archived

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime)

    # relationships
    tasks = relationship("Task", back_populates="order", cascade="all, delete-orphan")


# Tasks (mapped to existing **sub_tasks** table)
class Task(Base):
    __tablename__ = "sub_tasks"
    __table_args__ = {'sqlite_autoincrement': True}
    id = Column(Integer, primary_key=True, autoincrement=True)

    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    # the column is literally named "group" in SQLite
    group = Column("group", String, nullable=True)
    task  = Column(String, nullable=True)

    quantity = Column(Integer, nullable=True)
    completed = Column(Integer, nullable=True, default=0)

    # timing
    start_time = Column(DateTime)      # may be NULL in DB
    stop_time  = Column(DateTime)
    duration_minutes = Column(Integer)

    # relationships
    order    = relationship("Order", back_populates="tasks")
    history  = relationship("TaskHistory", back_populates="task", cascade="all, delete-orphan")


# Task history (mapped to existing **task_history** table)
class TaskHistory(Base):
    __tablename__ = "task_history"

    id = Column(Integer, primary_key=True, autoincrement=True)

    task_id = Column(Integer, ForeignKey("sub_tasks.id"), nullable=False)

    # quantities
    completed = Column(Integer)   # present after your migration
    delta     = Column(Integer)   # present after your migration

    # audit / timing
    note       = Column(String)   # e.g. "start", "stop"
    timestamp  = Column(DateTime, default=datetime.utcnow)
    start_time = Column(DateTime)
    stop_time  = Column(DateTime)
    duration_minutes = Column(Integer)

    task = relationship("Task", back_populates="history")

class StationSchedule(Base):
    __tablename__ = "station_schedule"
    __table_args__ = {"sqlite_autoincrement": True}   # <- table-level flag

    id          = Column(Integer, primary_key=True)   # no sqlite_autoincrement here
    station     = Column(String, index=True)
    task_id     = Column(Integer, index=True)
    order_id    = Column(Integer, index=True)
    plan_date   = Column(String, index=True)          # 'YYYY-MM-DD'
    planned_qty = Column(Integer, default=0)
    sequence    = Column(Integer, default=0)
    note        = Column(String, default="")
    locked      = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)