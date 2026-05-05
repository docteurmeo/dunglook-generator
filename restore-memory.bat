@echo off
chcp 65001 > nul
title DUNG LOOK - Restore Claude Memory
cd /d "%~dp0"

set "MEM_SRC=%~dp0.claude-memory"
set "MEM_DST=%USERPROFILE%\.claude\projects\C--Users-%USERNAME%-Desktop-dunglook\memory"

echo ============================================
echo   Restore Claude Memory tu GitHub
echo ============================================
echo.
echo Tu repo:    %MEM_SRC%
echo Cai vao:    %MEM_DST%
echo.

echo [1/3] Pull memory moi nhat tu GitHub...
git pull
if errorlevel 1 (
  echo PULL FAILED. Co the dang co conflict, hay xu ly thu cong.
  echo.
  pause
  exit /b 1
)

if not exist "%MEM_SRC%" (
  echo.
  echo Khong tim thay backup memory trong repo.
  echo Hay chay backup-memory.bat tren may cu truoc.
  echo.
  pause
  exit /b 1
)

echo.
echo [2/3] Tao thu muc dich neu chua co...
if not exist "%MEM_DST%" mkdir "%MEM_DST%"

echo [3/3] Copy memory vao .claude...
xcopy /E /Y /I /Q "%MEM_SRC%\*" "%MEM_DST%\" > nul
if errorlevel 1 (
  echo COPY FAILED.
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   DA RESTORE MEMORY XONG!
echo.
echo   Mo Claude Code tu: %USERPROFILE%\Desktop\dunglook
echo   (dung thu muc cha cua dunglook-generator)
echo ============================================
echo.
pause
