@echo off
title FinFlow
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 22.13+ is required: https://nodejs.org & pause & exit /b 1)
echo Starting FinFlow at http://localhost:3000  (close this window to stop)
start "" http://localhost:3000
node server.js
pause
