@echo off
title DUNG LOOK - Local Test Server
echo ============================================
echo   DUNG LOOK - Local Test Server
echo ============================================
echo.
echo Dang khoi dong server...
echo Khi server chay, mo trinh duyet vao:
echo.
echo     http://localhost:8080
echo.
echo De DUNG server: dong cua so nay (hoac Ctrl+C)
echo ============================================
echo.
cd /d "%~dp0"
call node scripts/build.js
echo.
start "" "http://localhost:8080"
npx --yes http-server -p 8080 -c-1 -s
pause
