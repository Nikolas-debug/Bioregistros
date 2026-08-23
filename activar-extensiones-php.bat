@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "activar-extensiones-php.ps1" (
  echo.
  echo   [X] Falta el archivo activar-extensiones-php.ps1
  echo       Debe estar en esta misma carpeta.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0activar-extensiones-php.ps1"
