@echo off
title FinFlow (FastAPI)
cd /d "%~dp0"
where python >nul 2>nul || (echo Python 3.10+ is required: https://python.org & pause & exit /b 1)
if not exist .venv ( echo Creating virtual environment... & python -m venv .venv )
.venv\Scripts\python -m pip install -q -r requirements.txt
echo Starting FinFlow at http://localhost:3000  (API docs: /docs)  - close this window to stop
start "" http://localhost:3000
.venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 3000
pause
