@echo off
chcp 65001 > nul
title DUNG LOOK - Backup Claude Memory
cd /d "%~dp0"

set "MEM_SRC=%USERPROFILE%\.claude\projects\C--Users-%USERNAME%-Desktop-dunglook\memory"
set "MEM_DST=%~dp0.claude-memory"

echo ============================================
echo   Backup Claude Memory len GitHub
echo ============================================
echo.
echo Memory tu:  %MEM_SRC%
echo Luu vao:    %MEM_DST%
echo.

if not exist "%MEM_SRC%" (
  echo Khong tim thay memory tai duong dan tren.
  echo Kiem tra: ban da mo Claude Code tu thu muc Desktop\dunglook chua?
  echo.
  pause
  exit /b 1
)

echo [1/4] Copy memory vao repo...
if not exist "%MEM_DST%" mkdir "%MEM_DST%"
xcopy /E /Y /I /Q "%MEM_SRC%\*" "%MEM_DST%\" > nul
if errorlevel 1 (
  echo COPY FAILED.
  echo.
  pause
  exit /b 1
)

echo [2/4] Kiem tra thay doi...
git add -- .claude-memory
git diff --cached --quiet -- .claude-memory
if %errorlevel% equ 0 (
  echo.
  echo Khong co thay doi memory nao moi. Khong can backup.
  echo.
  pause
  exit /b 0
)

echo Cac file memory thay doi:
git diff --cached --name-status -- .claude-memory
echo.

echo [3/4] Committing...
git commit -m "Backup Claude memory" -- .claude-memory
if errorlevel 1 (
  echo COMMIT FAILED.
  echo.
  pause
  exit /b 1
)

echo.
echo [4/4] Pushing to GitHub...
git push
if errorlevel 1 (
  echo PUSH FAILED. Co the loi mang hoac chua dang nhap GitHub.
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   DA BACKUP MEMORY XONG!
echo   Memory hien co tren GitHub, san sang dung tren may khac.
echo ============================================
echo.
pause
