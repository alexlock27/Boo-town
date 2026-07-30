@echo off
title Boo Town - local review server
cd /d "%~dp0"
echo.
echo   Starting Boo Town...
echo   Your browser should open at http://localhost:8000
echo.
echo   Leave THIS WINDOW OPEN while you play.
echo   Close it (or press Ctrl+C) when you are finished.
echo.
python _serve.py --open
echo.
echo   The server has stopped.
pause
