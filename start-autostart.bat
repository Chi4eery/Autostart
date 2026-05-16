@echo off
cd /d "%~dp0"
echo Starting AutoStart local server...
echo.
echo Site URL: http://localhost:3000
echo To stop the server, close this window or press Ctrl+C.
echo.
node server.js
pause
