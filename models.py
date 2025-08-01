from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from db import Base

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    manufacture_code = Column(String(50))
    customer = Column(String(100))
    product = Column(String(100))
    demand_date = Column(String(10))
    delivery = Column(String(10))
    datecreate = Column(String(10))
    quantity = Column(Integer)
    fengbian = Column(String(100))
    wallpaper = Column(String(100))
    jobdesc = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    tasks = relationship("Task", back_populates="order", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    group = Column(String(50))
    task = Column(String(100))
    quantity = Column(Integer)
    completed = Column(Integer, default=0)
    note = Column(Text)
    order = relationship("Order", back_populates="tasks")
    history = relationship("TaskHistory", back_populates="task", cascade="all, delete-orphan")

class TaskHistory(Base):
    __tablename__ = "task_history"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    delta = Column(Integer)
    note = Column(Text)
    task = relationship("Task", back_populates="history")
