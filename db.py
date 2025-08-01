from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import SQLALCHEMY_DATABASE_URI

engine = create_engine(SQLALCHEMY_DATABASE_URI, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()
