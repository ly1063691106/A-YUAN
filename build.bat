@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  阿缘摄影 · 作品集重建
echo  ====================
echo.
set PY=%USERPROFILE%\.workbuddy\binaries\python\envs\default\Scripts\python.exe
if not exist "%PY%" set PY=python
"%PY%" build.py
echo.
pause
