"""Domain logic: settings, state assembly, family aggregation, demo seeding."""
import json
import secrets
from datetime import date, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .calc import calculate
from .models import Family, Goal, Holding, Payslip, Setting, Transaction, User
from .security import hash_pw


def default_settings() -> dict:
    return {
        "currency": "INR", "theme": "dark", "cash": 0, "alloc": {"needs": 50, "wants": 30},
        "growth": {"years": 20, "step": 8, "infl": 5, "target": 10_000_000, "ret": None, "start": None, "monthly": None},
        "profile": {"pay_frequency": "monthly", "base_salary": 0, "allowances": 0, "bonus_expected": 0, "tax_rate": 15,
                    "pension_rate": 6, "insurance_deduction": 0, "other_deductions": 0, "standard_hours_per_week": 40,
                    "overtime_hours": 0, "overtime_rate_multiplier": 1.5},
    }


def get_settings(db: Session, uid: int) -> dict:
    d = default_settings()
    row = db.get(Setting, uid)
    if not row:
        return d
    s = json.loads(row.json)
    return {**d, **s, "alloc": {**d["alloc"], **s.get("alloc", {})}, "growth": {**d["growth"], **s.get("growth", {})},
            "profile": {**d["profile"], **s.get("profile", {})}}


def put_settings(db: Session, uid: int, s: dict) -> None:
    row = db.get(Setting, uid)
    if row:
        row.json = json.dumps(s)
    else:
        db.add(Setting(user_id=uid, json=json.dumps(s)))


def _rows(db: Session, model, uid: int, *order):
    return db.scalars(select(model).where(model.user_id == uid).order_by(*order)).all()


def family_view(db: Session, user: User):
    if not user.family_id:
        return None
    fam = db.get(Family, user.family_id)
    users = db.scalars(select(User).where(User.family_id == fam.id).order_by(User.is_family_admin.desc(), User.id)).all()
    members = []
    for m in users:   # only salary figures are shared with the household
        c = calculate(get_settings(db, m.id)["profile"])["monthly"]
        members.append({"id": m.id, "name": m.name, "admin": bool(m.is_family_admin), "you": m.id == user.id, "gross": c["gross"], "net": c["net"]})
    total_net = sum(m["net"] for m in members)
    total_gross = sum(m["gross"] for m in members)
    for m in members:
        m["share"] = round(m["net"] / total_net * 1000) / 10 if total_net else 0
    return {"id": fam.id, "name": fam.name, "invite_code": fam.invite_code, "is_admin": bool(user.is_family_admin), "members": members,
            "monthly_gross": round(total_gross, 2), "monthly_net": round(total_net, 2), "annual_net": round(total_net * 12, 2)}


def full_state(db: Session, user: User) -> dict:
    s = get_settings(db, user.id)
    return {
        "user": {"id": user.id, "name": user.name, "email": user.email, "demo": bool(user.is_demo)}, **s, "calc": calculate(s["profile"]),
        "holdings": [h.dict() for h in _rows(db, Holding, user.id, Holding.id)],
        "tx": [t.dict() for t in _rows(db, Transaction, user.id, Transaction.date.desc(), Transaction.id.desc())],
        "goals": [g.dict() for g in _rows(db, Goal, user.id, Goal.date)],
        "payslips": [p.dict() for p in _rows(db, Payslip, user.id, Payslip.pay_date.desc(), Payslip.id.desc())],
        "family": family_view(db, user),
    }


def invite_code() -> str:
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    c = "".join(secrets.choice(chars) for _ in range(8))
    return f"{c[:4]}-{c[4:]}"


# ---------- payslips ----------
_PERIOD = {"weekly": "weekly", "biweekly": "biweekly", "monthly": "monthly", "yearly": "yearly", "hourly": "monthly"}


def slip_from_profile(profile: dict, pay_date: str, title: str, category: str = "primary_job") -> dict:
    c = calculate(profile)[_PERIOD[profile["pay_frequency"]]]
    return {"title": title, "pay_date": pay_date, "category": category, "gross": c["gross"], "allowances": c["allowances"],
            "tax": c["tax"], "pension": c["pension"], "insurance": c["insurance"], "other": c["other"], "net": c["net"], "notes": ""}


# ---------- demo ----------
def _month_back(today: date, back: int):
    m = today.month - 1 - back
    return today.year + m // 12, m % 12 + 1


def seed_user(db: Session, uid: int) -> None:
    today = date.today()
    seed = 7

    def rnd():
        nonlocal seed
        seed = (seed * 9301 + 49297) % 233280
        return seed / 233280

    for model in (Holding, Transaction, Goal, Payslip):
        db.execute(delete(model).where(model.user_id == uid))
    profile = {**default_settings()["profile"], "base_salary": 75000, "allowances": 12000, "bonus_expected": 5000, "insurance_deduction": 2500, "other_deductions": 1000}
    put_settings(db, uid, {**default_settings(), "cash": 120000, "profile": profile})
    for name, typ, inv, cur, sip in [("Nifty 50 Index Fund", "Mutual Fund", 300000, 365000, 10000), ("Blue-chip Stocks", "Stocks", 150000, 186000, 3000),
                                     ("Gold ETF", "Gold", 80000, 92000, 2000), ("Fixed Deposit", "Fixed Deposit", 200000, 214000, 0), ("PPF", "PPF/EPF", 120000, 134000, 5000)]:
        db.add(Holding(user_id=uid, name=name, type=typ, invested=inv, current=cur, sip=sip))
    base = {"Rent": 18000, "Groceries": 7000, "Utilities": 3200, "Transport": 2500, "Health": 1200, "Dining": 3500, "Shopping": 4500, "Entertainment": 2000, "Travel": 2500, "Other": 1000}
    for m in range(6):
        y, mo = _month_back(today, m)
        for i, (cat, b) in enumerate(base.items()):
            day = min(today.day, 1 + i * 2) if m == 0 else 1 + i * 2
            db.add(Transaction(user_id=uid, date=date(y, mo, day).isoformat(), description=f"{cat} spend", cat=cat, amount=round(b * (0.8 + rnd() * 0.5) / 50) * 50, kind="expense"))
        db.add(Payslip(user_id=uid, **slip_from_profile(profile, date(y, mo, 28).isoformat(), "Monthly salary")))
    db.add(Goal(user_id=uid, name="Emergency fund", target=500000, saved=120000, date=date(today.year + 1, 6, 1).isoformat()))
    db.add(Goal(user_id=uid, name="Dream home down-payment", target=2500000, saved=400000, date=date(today.year + 6, 1, 1).isoformat()))


def ensure_demo(db: Session) -> User:
    u = db.scalar(select(User).where(User.email == "demo@finflow.local"))
    if u:
        return u

    def mk(name, email, profile=None):
        user = User(name=name, email=email, pass_hash=hash_pw(secrets.token_hex(24)), is_demo=1)
        db.add(user)
        db.flush()
        if profile:
            d = default_settings()
            put_settings(db, user.id, {**d, "profile": {**d["profile"], **profile}})
        return user

    me = mk("Morgan (Demo)", "demo@finflow.local")
    seed_user(db, me.id)
    p2 = mk("Alex Morgan", "alex@finflow.local", {"base_salary": 62000, "allowances": 8000, "bonus_expected": 3000, "insurance_deduction": 2000, "other_deductions": 800})
    p3 = mk("Sam Morgan", "sam@finflow.local", {"base_salary": 30000, "allowances": 4000, "tax_rate": 10, "insurance_deduction": 1000})
    fam = Family(name="Morgan Household", invite_code="DEMO-2026")
    db.add(fam)
    db.flush()
    me.family_id, me.is_family_admin = fam.id, 1
    p2.family_id = p3.family_id = fam.id
    db.commit()
    return me
