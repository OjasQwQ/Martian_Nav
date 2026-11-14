@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-mars-map.ps1"
if errorlevel 1 (
  echo.
  pause
)
