"""FinFlow API (FastAPI). Run: uvicorn backend.main:app  — also serves the HTML/JS frontend from /public."""
import csv
import html
import io
import os
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import services as svc
from .calc import calculate
from .models import Family, Goal, Holding, Payslip, SessionLocal, Transaction, User, init_db
from .schemas import (FamilyCreate, FamilyJoin, GoalIn, HoldingBulk, HoldingIn, HoldingPatch, LoginIn, PayslipIn, ProfileIn,
                      RegisterIn, SettingsIn, TxBulk, TxIn)
from .security import check_pw, hash_pw, limited, make_token, read_token, SESSION_DAYS

PUBLIC = Path(__file__).resolve().parent.parent / "public"
COOKIE_SECURE = os.environ.get("COOKIE_SECURE") == "1"

init_db()
app = FastAPI(title="FinFlow API", version="3.0")


# ---------- plumbing ----------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def bad(msg: str, status: int = 400) -> HTTPException:
    return HTTPException(status, msg)


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    uid = read_token(request.cookies.get("ff"))
    user = db.get(User, uid) if uid else None
    if not user:
        raise bad("Please sign in", 401)
    return user


def set_session(response: Response, uid: int) -> None:
    response.set_cookie("ff", make_token(uid), max_age=SESSION_DAYS * 86400, httponly=True, samesite="lax", secure=COOKIE_SECURE, path="/")


LABELS = {"desc": "description", "cat": "category", "kind": "type", "pay_date": "pay date", "current": "current value", "sip": "SIP",
          "tax_rate": "tax rate", "pension_rate": "pension rate", "infl": "inflation", "step": "step-up", "ret": "return"}


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
    return JSONResponse({"error": exc.detail if isinstance(exc.detail, str) else "Request failed"}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    err = exc.errors()[0]
    loc = [p for p in err["loc"] if p != "body"]
    row = ""
    if "items" in loc and loc.index("items") + 1 < len(loc) and isinstance(loc[loc.index("items") + 1], int):
        row = f"Row {loc[loc.index('items') + 1] + 1}: "
    elif loc and loc[-1] == "items":
        return JSONResponse({"error": "Provide between 1 and 200 rows"}, status_code=400)
    field = next((p for p in reversed(loc) if isinstance(p, str)), "input")
    return JSONResponse({"error": f"{row}Invalid {LABELS.get(field, field.replace('_', ' '))}"}, status_code=400)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    p = request.url.path
    resp.headers["Cache-Control"] = "no-store" if p.startswith(("/api", "/print")) else "no-cache"
    resp.headers.update({"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin"})
    if "content-security-policy" not in resp.headers:
        cdn = " https://cdn.jsdelivr.net" if p.startswith(("/docs", "/redoc")) else ""
        resp.headers["Content-Security-Policy"] = (f"default-src 'self'; script-src 'self' 'unsafe-inline'{cdn}; style-src 'self' 'unsafe-inline'{cdn}; "
                                                   "img-src 'self' data: https://fastapi.tiangolo.com; frame-ancestors 'none'" if cdn else
                                                   "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'")
    return resp


def ip_of(request: Request) -> str:
    return request.client.host if request.client else ""


# ---------- auth ----------
@app.post("/api/register", tags=["auth"])
def register(body: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    if limited(ip_of(request), "reg", 10, 3600):
        raise bad("Too many attempts, try later", 429)
    name, email = body.name.strip(), body.email.strip().lower()
    if not name or len(name) > 80:
        raise bad("Invalid name")
    if not (3 < len(email) <= 120) or "@" not in email or " " in email or "." not in email.split("@")[-1] or email.endswith("@finflow.local"):
        raise bad("Invalid email")
    if not 8 <= len(body.password) <= 200:
        raise bad("Password must be at least 8 characters")
    if db.scalar(select(User).where(User.email == email)):
        raise bad("Email already registered")
    user = User(name=name, email=email, pass_hash=hash_pw(body.password))
    db.add(user)
    db.commit()
    set_session(response, user.id)
    return svc.full_state(db, user)


@app.post("/api/login", tags=["auth"])
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    if limited(ip_of(request), "login", 10, 15 * 60):
        raise bad("Too many attempts, try again in a few minutes", 429)
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not user or user.is_demo or not check_pw(body.password, user.pass_hash):
        raise bad("Invalid email or password", 401)
    set_session(response, user.id)
    return svc.full_state(db, user)


@app.post("/api/demo", tags=["auth"])
def demo(response: Response, db: Session = Depends(get_db)):
    user = svc.ensure_demo(db)
    set_session(response, user.id)
    return svc.full_state(db, user)


@app.post("/api/logout", tags=["auth"])
def logout(response: Response):
    response.delete_cookie("ff", path="/")
    return {"ok": True}


@app.get("/api/state", tags=["state"])
def state(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return svc.full_state(db, user)


@app.post("/api/demo/reset", tags=["auth"])
def demo_reset(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.email != "demo@finflow.local":
        raise bad("Only the demo account can be reset", 403)
    svc.seed_user(db, user.id)
    db.commit()
    return svc.full_state(db, user)


# ---------- settings & salary ----------
@app.put("/api/settings", tags=["salary"])
def put_settings(body: SettingsIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = svc.get_settings(db, user.id)
    if body.currency is not None:
        s["currency"] = body.currency
    if body.theme is not None:
        s["theme"] = body.theme
    if body.cash is not None:
        s["cash"] = body.cash
    if body.onboarded is not None:
        s["onboarded"] = body.onboarded
    if body.alloc:
        s["alloc"] = body.alloc.model_dump()
    if body.growth:
        g = body.growth.model_dump()
        g["years"] = round(g["years"])
        s["growth"] = g
    svc.put_settings(db, user.id, s)
    db.commit()
    return {"ok": True}


@app.put("/api/profile", tags=["salary"])
def put_profile(body: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = svc.get_settings(db, user.id)
    s["profile"] = body.profile()
    if body.cash is not None:
        s["cash"] = body.cash
    svc.put_settings(db, user.id, s)
    db.commit()
    return {"profile": s["profile"], "cash": s["cash"], "calc": calculate(s["profile"])}


@app.post("/api/calc", tags=["salary"])
def calc(body: ProfileIn, user: User = Depends(current_user)):
    return calculate(body.profile())


# ---------- holdings ----------
def _holding(user_id: int, b: HoldingIn) -> Holding:
    return Holding(user_id=user_id, name=b.name, type=b.type, invested=b.invested, current=b.invested if b.current is None else b.current, sip=b.sip)


@app.post("/api/holdings", tags=["investments"])
def add_holding(body: HoldingIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    h = _holding(user.id, body)
    db.add(h)
    db.commit()
    return h.dict()


@app.post("/api/holdings/bulk", tags=["investments"])
def add_holdings_bulk(body: HoldingBulk, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = [_holding(user.id, b) for b in body.items]
    db.add_all(rows)
    db.commit()
    return {"items": [h.dict() for h in rows]}


def _owned(db: Session, model, id_: int, user: User):
    row = db.get(model, id_)
    return row if row and row.user_id == user.id else None


@app.put("/api/holdings/{id_}", tags=["investments"])
def edit_holding(id_: int, body: HoldingIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    h = _owned(db, Holding, id_, user)
    if not h:
        raise bad("Not found", 404)
    h.name, h.type, h.invested, h.sip = body.name, body.type, body.invested, body.sip
    h.current = body.invested if body.current is None else body.current
    db.commit()
    return h.dict()


@app.patch("/api/holdings/{id_}", tags=["investments"])
def patch_holding(id_: int, body: HoldingPatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    h = _owned(db, Holding, id_, user)
    if not h:
        raise bad("Not found", 404)
    h.current = body.current
    db.commit()
    return {"ok": True}


def _delete(model):
    def handler(id_: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
        row = _owned(db, model, id_, user)
        if row:
            db.delete(row)
            db.commit()
        return {"ok": True}
    handler.__name__ = f"delete_{model.__tablename__}"
    return handler


app.delete("/api/holdings/{id_}", tags=["investments"])(_delete(Holding))
app.delete("/api/transactions/{id_}", tags=["spending"])(_delete(Transaction))
app.delete("/api/goals/{id_}", tags=["goals"])(_delete(Goal))
app.delete("/api/payslips/{id_}", tags=["payslips"])(_delete(Payslip))


# ---------- transactions ----------
def _tx(user_id: int, b: TxIn) -> Transaction:
    return Transaction(user_id=user_id, date=b.date, description=b.desc, cat=b.cat, amount=b.amount, kind=b.kind)


@app.post("/api/transactions", tags=["spending"])
def add_tx(body: TxIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    t = _tx(user.id, body)
    db.add(t)
    db.commit()
    return t.dict()


@app.put("/api/transactions/{id_}", tags=["spending"])
def edit_tx(id_: int, body: TxIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    t = _owned(db, Transaction, id_, user)
    if not t:
        raise bad("Not found", 404)
    t.date, t.description, t.cat, t.amount, t.kind = body.date, body.desc, body.cat, body.amount, body.kind
    db.commit()
    return t.dict()


@app.post("/api/transactions/bulk", tags=["spending"])
def add_tx_bulk(body: TxBulk, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = [_tx(user.id, b) for b in body.items]   # all validated by pydantic first -> all-or-nothing
    db.add_all(rows)
    db.commit()
    return {"items": [t.dict() for t in rows]}


# ---------- goals ----------
@app.post("/api/goals", tags=["goals"])
def add_goal(body: GoalIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    g = Goal(user_id=user.id, name=body.name, target=body.target, saved=body.saved, date=body.date)
    db.add(g)
    db.commit()
    return g.dict()


@app.put("/api/goals/{id_}", tags=["goals"])
def edit_goal(id_: int, body: GoalIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    g = _owned(db, Goal, id_, user)
    if not g:
        raise bad("Not found", 404)
    g.name, g.target, g.saved, g.date = body.name, body.target, body.saved, body.date
    db.commit()
    return g.dict()


# ---------- pay slips ----------
def _slip_fields(body: PayslipIn, user: User, db: Session) -> dict:
    if body.fromProfile:
        s = svc.slip_from_profile(svc.get_settings(db, user.id)["profile"], body.pay_date, body.title or "Salary", body.category)
    else:
        if not body.title:
            raise bad("Invalid title")
        if body.gross is None:
            raise bad("Invalid gross")
        net = max(0.0, round(body.gross - body.tax - body.pension - body.insurance - body.other, 2))
        s = {"title": body.title, "pay_date": body.pay_date, "category": body.category, "gross": body.gross, "allowances": body.allowances,
             "tax": body.tax, "pension": body.pension, "insurance": body.insurance, "other": body.other, "net": net}
    s["notes"] = body.notes[:500]
    return s


@app.post("/api/payslips", tags=["payslips"])
def add_payslip(body: PayslipIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = Payslip(user_id=user.id, **_slip_fields(body, user, db))
    db.add(p)
    db.commit()
    return p.dict()


@app.put("/api/payslips/{id_}", tags=["payslips"])
def edit_payslip(id_: int, body: PayslipIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = _owned(db, Payslip, id_, user)
    if not p:
        raise bad("Not found", 404)
    for k, v in _slip_fields(body, user, db).items():
        setattr(p, k, v)
    db.commit()
    return p.dict()


def _csv_cell(v) -> str:
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s   # block spreadsheet formula injection


@app.get("/api/payslips/export.csv", tags=["payslips"])
def export_csv(user: User = Depends(current_user), db: Session = Depends(get_db)):
    out = io.StringIO()
    w = csv.writer(out, lineterminator="\r\n")
    w.writerow(["Date", "Title", "Category", "Gross", "Allowances", "Tax", "Pension", "Insurance", "Other deductions", "Net", "Notes"])
    for p in db.scalars(select(Payslip).where(Payslip.user_id == user.id).order_by(Payslip.pay_date.desc(), Payslip.id.desc())):
        w.writerow([_csv_cell(x) for x in (p.pay_date, p.title, p.category, p.gross, p.allowances, p.tax, p.pension, p.insurance, p.other, p.net, p.notes)])
    return Response(out.getvalue(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="payslips.csv"'})


@app.get("/print/{id_}", response_class=HTMLResponse, tags=["payslips"])
def print_slip(id_: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = _owned(db, Payslip, id_, user)
    if not p:
        raise bad("Not found", 404)
    cur = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}[svc.get_settings(db, user.id)["currency"]]
    e = lambda v: html.escape(str(v if v is not None else ""), quote=True)  # noqa: E731
    m = lambda n: f"{cur}{n:,.2f}"  # noqa: E731
    row = lambda a, b, cls="": f'<tr class="{cls}"><td>{a}</td><td class="r">{b}</td></tr>'  # noqa: E731
    page = f"""<!doctype html><meta charset=utf-8><title>Pay slip – {e(p.title)}</title>
<style>body{{font:15px system-ui,sans-serif;max-width:640px;margin:30px auto;padding:0 20px;color:#111}}h1{{margin:0}}table{{width:100%;border-collapse:collapse;margin:14px 0}}td{{padding:8px;border-bottom:1px solid #ddd}}.r{{text-align:right}}.t td{{font-weight:700;border-top:2px solid #111}}.m{{color:#666}}button{{padding:8px 16px;margin-top:10px}}@media print{{button{{display:none}}}}</style>
<h1>Pay Slip</h1><div class=m>{e(user.name)} · {e(p.title)} · {e(p.pay_date)} · {e(p.category.replace('_', ' '))}</div>
<table><tr><td colspan=2><b>Earnings</b></td></tr>{row('Gross pay', m(p.gross))}{row('&nbsp;&nbsp;of which allowances', m(p.allowances))}
<tr><td colspan=2><b>Deductions</b></td></tr>{row('Income tax', m(p.tax))}{row('Pension / PF', m(p.pension))}{row('Insurance', m(p.insurance))}{row('Other', m(p.other))}{row('Total deductions', m(p.tax + p.pension + p.insurance + p.other))}{row('Net pay', m(p.net), 't')}</table>
{f'<p class=m>{e(p.notes)}</p>' if p.notes else ''}<button onclick="print()">Print / Save as PDF</button>"""
    return HTMLResponse(page, headers={"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'"})


# ---------- family ----------
@app.post("/api/family/create", tags=["family"])
def family_create(body: FamilyCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.family_id:
        raise bad("You are already in a family")
    for _ in range(6):
        fam = Family(name=body.name, invite_code=svc.invite_code())
        db.add(fam)
        try:
            db.flush()
            break
        except IntegrityError:
            db.rollback()
    user.family_id, user.is_family_admin = fam.id, 1
    db.commit()
    return {"family": svc.family_view(db, user)}


@app.post("/api/family/join", tags=["family"])
def family_join(body: FamilyJoin, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if limited(ip_of(request), "join", 15, 3600):
        raise bad("Too many attempts", 429)
    if user.family_id:
        raise bad("You are already in a family")
    fam = db.scalar(select(Family).where(Family.invite_code == body.code.strip().upper()))
    if not fam:
        raise bad("Invite code not found")
    user.family_id, user.is_family_admin = fam.id, 0
    db.commit()
    return {"family": svc.family_view(db, user)}


@app.post("/api/family/leave", tags=["family"])
def family_leave(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not user.family_id:
        raise bad("Not in a family")
    fid, was_admin = user.family_id, user.is_family_admin
    user.family_id, user.is_family_admin = None, 0
    db.flush()
    rest = db.scalars(select(User).where(User.family_id == fid).order_by(User.id)).all()
    if not rest:
        db.delete(db.get(Family, fid))
    elif was_admin:
        rest[0].is_family_admin = 1
    db.commit()
    return {"family": None}


# ---------- frontend (plain HTML/JS/CSS) ----------
app.mount("/", StaticFiles(directory=PUBLIC, html=True), name="frontend")
