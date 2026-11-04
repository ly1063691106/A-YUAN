@echo off
title A-YUAN Photo - Local Server
cd /d "%~dp0"
echo.
echo   A-YUAN Photo - local preview
echo   ==========================
echo   Site : http://127.0.0.1:8787/
echo   Admin: http://127.0.0.1:8787/admin.html
echo   Close this window to stop the server.
echo.
set PY=%USERPROFILE%\.workbuddy\binaries\python\envs\default\Scripts\python.exe
if not exist "%PY%" set PY=python
"%PY%" serve.py
echo.
echo Server stopped. If there is an error above, take a screenshot.
pause
