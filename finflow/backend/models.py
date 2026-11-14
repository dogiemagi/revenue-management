"""SQLAlchemy models + engine. SQLite by default; set DATABASE_URL for Postgres etc."""
import os
from pathlib import Path
from typing import Optional

from sqlalchemy import Float, ForeignKey, Integer, String, Text, create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)

DATABASE_URL = os.environ.get("DATABASE_URL") or f"sqlite:///{os.environ.get('DB_FILE') or DATA / 'finflow.db'}"
_sqlite = DATABASE_URL.startswith("sqlite")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if _sqlite else {})

if _sqlite:
    @event.listens_for(engine, "connect")
    def _pragmas(conn, _):
        cur = conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.close()

SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


_now = text("CURRENT_TIMESTAMP")
_uid = lambda: mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)  # noqa: E731


class Family(Base):
    __tablename__ = "families"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    invite_code: Mapped[str] = mapped_column(String(20), unique=True)
    created_at: Mapped[Optional[str]] = mapped_column(String, server_default=_now)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(120), unique=True)
    pass_hash: Mapped[str] = mapped_column(String(255))
    family_id: Mapped[Optional[int]] = mapped_column(ForeignKey("families.id", ondelete="SET NULL"))
    is_family_admin: Mapped[int] = mapped_column(Integer, default=0)
    is_demo: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[Optional[str]] = mapped_column(String, server_default=_now)


class Setting(Base):
    __tablename__ = "settings"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    json: Mapped[str] = mapped_column(Text)


class Holding(Base):
    __tablename__ = "holdings"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _uid()
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(30))
    invested: Mapped[float] = mapped_column(Float)
    current: Mapped[float] = mapped_column(Float)
    sip: Mapped[float] = mapped_column(Float, default=0)

    def dict(self):
        return {"id": self.id, "name": self.name, "type": self.type, "invested": self.invested, "current": self.current, "sip": self.sip}


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _uid()
    date: Mapped[str] = mapped_column(String(10))
    description: Mapped[str] = mapped_column(String(120))
    cat: Mapped[str] = mapped_column(String(30))
    amount: Mapped[float] = mapped_column(Float)
    kind: Mapped[str] = mapped_column(String(10))

    def dict(self):
        return {"id": self.id, "date": self.date, "desc": self.description, "cat": self.cat, "amount": self.amount, "kind": self.kind}


class Goal(Base):
    __tablename__ = "goals"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _uid()
    name: Mapped[str] = mapped_column(String(120))
    target: Mapped[float] = mapped_column(Float)
    saved: Mapped[float] = mapped_column(Float, default=0)
    date: Mapped[str] = mapped_column(String(10))

    def dict(self):
        return {"id": self.id, "name": self.name, "target": self.target, "saved": self.saved, "date": self.date}


class Payslip(Base):
    __tablename__ = "payslips"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _uid()
    title: Mapped[str] = mapped_column(String(120))
    pay_date: Mapped[str] = mapped_column(String(10))
    category: Mapped[str] = mapped_column(String(30))
    gross: Mapped[float] = mapped_column(Float)
    allowances: Mapped[float] = mapped_column(Float, default=0)
    tax: Mapped[float] = mapped_column(Float, default=0)
    pension: Mapped[float] = mapped_column(Float, default=0)
    insurance: Mapped[float] = mapped_column(Float, default=0)
    other: Mapped[float] = mapped_column(Float, default=0)
    net: Mapped[float] = mapped_column(Float)
    notes: Mapped[Optional[str]] = mapped_column(Text, default="")

    def dict(self):
        return {"id": self.id, "title": self.title, "pay_date": self.pay_date, "category": self.category, "gross": self.gross,
                "allowances": self.allowances, "tax": self.tax, "pension": self.pension, "insurance": self.insurance,
                "other": self.other, "net": self.net, "notes": self.notes or ""}


def init_db():
    Base.metadata.create_all(engine)
