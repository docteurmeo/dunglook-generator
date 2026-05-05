@echo off
chcp 65001 > nul
title DUNG LOOK - Publish to GitHub
cd /d "%~dp0"

echo ============================================
echo   DUNG LOOK - Publish to GitHub
echo ============================================
echo.

echo [1/3] Kiem tra thay doi...
git add -A
git diff --cached --quiet
if %errorlevel% equ 0 (
  echo.
  echo Khong co thay doi nao de publish.
  echo.
  pause
  exit /b 0
)

echo.
echo Cac file se duoc commit:
git diff --cached --name-status
echo.

set /p MSG="Commit message (Enter de dung 'Update assets'): "
if "%MSG%"=="" set MSG=Update assets

echo.
echo [2/3] Committing...
git commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo COMMIT FAILED. Xem loi o tren.
  echo.
  pause
  exit /b 1
)

echo.
echo [3/3] Pushing to GitHub...
git push
if errorlevel 1 (
  echo.
  echo PUSH FAILED. Co the loi mang hoac chua dang nhap GitHub.
  echo Hay mo GitHub Desktop va push thu cach truyen thong.
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   DA PUBLISH XONG!
echo   Site se rebuild trong ~1 phut.
echo   https://docteurmeo.github.io/dunglook-generator/
echo ============================================
echo.
echo (Mo trinh duyet va Ctrl+Shift+R sau 1 phut)
echo.
pause
