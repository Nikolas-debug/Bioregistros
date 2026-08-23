@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "backend\artisan" (
  echo.
  echo   [X] Laravel todavia no esta instalado.
  echo       Ejecute primero:  instalar-backend.bat
  echo.
  pause
  exit /b 1
)

cd backend

echo.
echo ============================================================
echo    API Gestion Biomedica
echo ============================================================
echo.
echo   Escuchando en:  http://localhost:8000
echo.
echo   Para probar desde un celular en la red de la clinica, use
echo   la IP de este computador ^(vea abajo^) en el .env de la PWA:
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
  echo       VITE_API_URL=http:/^/%%a:8000/api
)

echo.
echo   Deje esta ventana abierta. Ctrl+C para detener.
echo ============================================================
echo.

php artisan serve --host=0.0.0.0 --port=8000
