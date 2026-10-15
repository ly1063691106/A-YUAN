@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  阿缘摄影 · 本地预览
echo  ==================
echo  将在浏览器打开 http://127.0.0.1:8787/
echo  用这个方式打开，字体和图片最稳。关掉这个黑窗口就停止服务。
echo.
set PY=%USERPROFILE%\.workbuddy\binaries\python\envs\default\Scripts\python.exe
if not exist "%PY%" set PY=python
start "" http://127.0.0.1:8787/
"%PY%" -m http.server 8787
