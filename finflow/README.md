# FinFlow

Full-stack personal finance manager: salary engine, pay slips, spending, investments, growth planning and a family workspace.

| Layer | Tech |
|---|---|
| Frontend | HTML + CSS + vanilla JS (`public/`), hand-written SVG charts and icons |
| Backend | **FastAPI** (Python 3.10+), Pydantic validation, REST API under `/api` |
| Database | SQLAlchemy 2 on SQLite (set `DATABASE_URL` for Postgres) |
| Auth | scrypt password hashing, signed HttpOnly session cookie |

## Run
```
run.bat                                   # Windows: sets up .venv, installs deps, opens the browser
```
or manually:
```
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn backend.main:app --port 3000
```
Open http://localhost:3000 · interactive API docs at http://localhost:3000/docs

Tests (19, throwaway database): `.venv\Scripts\python -m pytest -q`

Env vars: `DATABASE_URL`, `DB_FILE`, `SECRET` (cookie signing key; otherwise generated in `data/secret.key`), `COOKIE_SECURE=1` (behind HTTPS).

## Structure
```
backend/
  main.py       routes, auth dependency, error handling, security headers, static hosting
  schemas.py    Pydantic request models (all validation)
  models.py     SQLAlchemy models + engine
  services.py   settings, state assembly, family aggregation, demo seed
  calc.py       multi-cadence salary engine (weekly / bi-weekly / monthly / yearly / hourly)
  security.py   scrypt, signed tokens, rate limiting
public/         index.html, app.js, styles.css
tests/          pytest end-to-end API tests
```

## Ideas adopted from dogiemagi/revenue-management
Salary engine, pay slips with print view + CSV export, accounts, family workspace with invite codes, demo account, bulk expense entry.

## Notes
- The demo account is shared by everyone who clicks it; "Reset demo data" restores it.
- For public deployment use HTTPS and set `COOKIE_SECURE=1`.
