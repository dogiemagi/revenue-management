"""End-to-end API tests. Run: python -m pytest -q"""
import re

import pytest

PW = "password123"


@pytest.fixture(scope="module")
def asha(make_client):
    c = make_client()
    r = c.post("/api/register", json={"name": "Asha", "email": "asha@x.com", "password": PW})
    assert r.status_code == 200
    return c


@pytest.fixture(scope="module")
def bob(make_client):
    c = make_client()
    assert c.post("/api/register", json={"name": "Bob", "email": "bob@x.com", "password": PW}).status_code == 200
    return c


def state(c):
    return c.get("/api/state").json()


def test_unauthenticated_rejected(make_client):
    assert make_client().get("/api/state").status_code == 401


def test_register_validation(make_client):
    c = make_client()
    assert c.post("/api/register", json={"name": "A", "email": "a@x.com", "password": "short"}).status_code == 400
    assert c.post("/api/register", json={"name": "A", "email": "not-an-email", "password": PW}).status_code == 400
    assert c.post("/api/register", json={"name": "A", "email": "a@finflow.local", "password": PW}).status_code == 400


def test_register_and_session(asha):
    s = state(asha)
    assert s["user"]["name"] == "Asha" and s["user"]["demo"] is False
    assert s["profile"]["pay_frequency"] == "monthly" and s["calc"]["monthly"]["net"] == 0


def test_duplicate_email_and_bad_login(make_client, asha):
    c = make_client()
    assert c.post("/api/register", json={"name": "X", "email": "ASHA@x.com", "password": PW}).status_code == 400
    assert c.post("/api/login", json={"email": "asha@x.com", "password": "nope-nope"}).status_code == 401
    ok = c.post("/api/login", json={"email": "asha@x.com", "password": PW})
    assert ok.status_code == 200 and c.get("/api/state").status_code == 200


def test_tampered_cookie_rejected(make_client, asha):
    c = make_client()
    tok = asha.cookies.get("ff")
    c.cookies.set("ff", re.sub(r"\.[0-9a-f]+$", ".00", tok))
    assert c.get("/api/state").status_code == 401


def test_salary_engine_matches_reference(asha):
    r = asha.put("/api/profile", json={"pay_frequency": "monthly", "base_salary": 75000, "allowances": 12000, "bonus_expected": 5000, "tax_rate": 15,
                                       "pension_rate": 6, "insurance_deduction": 2500, "other_deductions": 1000, "standard_hours_per_week": 40,
                                       "overtime_hours": 0, "overtime_rate_multiplier": 1.5, "cash": 5000}).json()
    assert r["calc"]["monthly"]["net"] == 70875
    assert r["calc"]["yearly"]["net"] == 850500
    assert r["calc"]["weekly"]["gross"] == 21230.77


def test_profile_rejects_bad_input(asha):
    assert asha.put("/api/profile", json={"pay_frequency": "daily", "base_salary": 1}).status_code == 400
    assert asha.put("/api/profile", json={"pay_frequency": "monthly", "tax_rate": 99}).status_code == 400


def test_calc_without_saving(asha):
    r = asha.post("/api/calc", json={"pay_frequency": "weekly", "base_salary": 1000, "tax_rate": 10})
    assert r.json()["yearly"]["gross"] == 52000
    assert state(asha)["profile"]["pay_frequency"] == "monthly"      # unchanged


def test_transactions_crud_and_validation(asha):
    base = {"date": "2026-01-05", "desc": "x", "cat": "Rent", "amount": 5, "kind": "expense"}
    assert asha.post("/api/transactions", json={**base, "cat": "Nope"}).status_code == 400
    assert asha.post("/api/transactions", json={**base, "amount": -5}).status_code == 400
    assert asha.post("/api/transactions", json={**base, "date": "2026-13-45"}).status_code == 400
    t = asha.post("/api/transactions", json={**base, "desc": "Rent", "amount": "18000"})     # numeric strings from HTML forms
    assert t.status_code == 200 and t.json()["amount"] == 18000
    assert len(state(asha)["tx"]) == 1
    asha.delete(f"/api/transactions/{t.json()['id']}")
    assert state(asha)["tx"] == []


def test_bulk_transactions_atomic(asha):
    before = len(state(asha)["tx"])
    good = [{"date": f"2026-01-1{i}", "desc": f"Item {i}", "cat": "Groceries", "amount": 100 * i} for i in (1, 2, 3)]
    r = asha.post("/api/transactions/bulk", json={"items": good})
    assert r.status_code == 200 and len(r.json()["items"]) == 3
    bad = asha.post("/api/transactions/bulk", json={"items": good + [{"date": "2026-01-15", "desc": "Oops", "cat": "Groceries", "amount": -1}]})
    assert bad.status_code == 400 and bad.json()["error"].startswith("Row 4")
    assert len(state(asha)["tx"]) == before + 3
    assert asha.post("/api/transactions/bulk", json={"items": []}).status_code == 400
    for t in r.json()["items"]:
        asha.delete(f"/api/transactions/{t['id']}")


def test_bulk_holdings_atomic(asha):
    r = asha.post("/api/holdings/bulk", json={"items": [{"name": "A", "type": "Gold", "invested": 100},
                                                        {"name": "B", "type": "ETF", "invested": 200, "current": 250, "sip": 10}]})
    assert r.status_code == 200
    assert [h["current"] for h in r.json()["items"]] == [100, 250]
    n = len(state(asha)["holdings"])
    bad = asha.post("/api/holdings/bulk", json={"items": [{"name": "C", "type": "Gold", "invested": 1}, {"name": "D", "type": "Nope", "invested": 1}]})
    assert bad.status_code == 400 and bad.json()["error"].startswith("Row 2")
    assert len(state(asha)["holdings"]) == n
    for h in r.json()["items"]:
        asha.delete(f"/api/holdings/{h['id']}")


def test_holdings_and_goals_crud(asha):
    h = asha.post("/api/holdings", json={"name": "Fund", "type": "ETF", "invested": 1000, "current": ""}).json()
    assert h["current"] == 1000                                   # blank current value defaults to invested
    assert asha.patch(f"/api/holdings/{h['id']}", json={"current": 1500}).status_code == 200
    assert asha.post("/api/goals", json={"name": "Trip", "target": 5000, "date": "2027-01-01"}).status_code == 200
    s = state(asha)
    assert s["holdings"][0]["current"] == 1500 and len(s["goals"]) == 1


def test_users_cannot_touch_each_others_data(asha, bob):
    mine = state(asha)["holdings"][0]["id"]
    assert bob.patch(f"/api/holdings/{mine}", json={"current": 1}).status_code == 404
    bob.delete(f"/api/holdings/{mine}")
    assert len(state(asha)["holdings"]) == 1
    assert state(bob)["holdings"] == []


def test_payslips_print_csv(asha, bob):
    g = asha.post("/api/payslips", json={"fromProfile": True, "title": '=HYPERLINK("x")', "pay_date": "2026-02-28"}).json()
    assert g["net"] == 70875
    m = asha.post("/api/payslips", json={"title": "Gig <b>", "pay_date": "2026-03-10", "category": "freelance", "gross": 1000, "tax": 100}).json()
    assert m["net"] == 900
    page = asha.get(f"/print/{m['id']}")
    assert page.status_code == 200 and "Gig &lt;b&gt;" in page.text and "Gig <b>" not in page.text
    assert bob.get(f"/print/{m['id']}").status_code == 404
    csv_resp = asha.get("/api/payslips/export.csv")
    assert csv_resp.headers["content-type"].startswith("text/csv") and "'=HYPERLINK" in csv_resp.text
    asha.delete(f"/api/payslips/{g['id']}")
    assert len(state(asha)["payslips"]) == 1


def test_family_lifecycle(asha, bob):
    c = asha.post("/api/family/create", json={"name": "Test Fam"}).json()["family"]
    assert re.fullmatch(r"[A-Z2-9]{4}-[A-Z2-9]{4}", c["invite_code"])
    assert bob.post("/api/family/join", json={"code": "ZZZZ-ZZZZ"}).status_code == 400
    j = bob.post("/api/family/join", json={"code": c["invite_code"].lower()}).json()["family"]
    assert len(j["members"]) == 2 and j["is_admin"] is False and j["monthly_net"] == 70875
    asha.post("/api/family/leave")
    assert state(bob)["family"]["is_admin"] is True               # admin handed over
    bob.post("/api/family/leave")
    assert state(bob)["family"] is None


def test_settings_persist_and_validate(asha):
    assert asha.put("/api/settings", json={"currency": "XXX"}).status_code == 400
    asha.put("/api/settings", json={"currency": "USD", "theme": "light", "alloc": {"needs": 40, "wants": 20},
                                    "growth": {"years": 10, "step": 5, "infl": 4, "target": 1e6, "ret": ""}})
    s = state(asha)
    assert s["currency"] == "USD" and s["theme"] == "light" and s["alloc"]["needs"] == 40
    assert s["growth"]["years"] == 10 and s["growth"]["ret"] is None


def test_demo_account(make_client, asha):
    d = make_client()
    s = d.post("/api/demo").json()
    assert len(s["tx"]) == 60 and len(s["payslips"]) == 6 and len(s["family"]["members"]) == 3 and s["user"]["demo"] is True
    assert len(d.post("/api/demo/reset").json()["tx"]) == 60
    assert asha.post("/api/demo/reset").status_code == 403
    assert make_client().post("/api/login", json={"email": "demo@finflow.local", "password": "x"}).status_code == 401


def test_static_frontend_and_safety(make_client, asha):
    c = make_client()
    assert c.get("/").status_code == 200 and "FinFlow" in c.get("/").text
    assert c.get("/app.js").status_code == 200
    assert c.get("/..%2Fbackend/main.py").status_code == 404
    assert c.get("/%2e%2e/data/secret.key").status_code == 404
    assert "content-security-policy" in c.get("/").headers
    assert asha.post("/api/login", content="{bad", headers={"Content-Type": "application/json"}).status_code == 400


def test_openapi_docs_available(make_client):
    r = make_client().get("/openapi.json")
    assert r.status_code == 200 and "/api/transactions/bulk" in r.json()["paths"]
