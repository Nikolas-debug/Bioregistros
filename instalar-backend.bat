@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ============================================================
echo    Instalacion del backend Laravel - Gestion Biomedica
echo ============================================================
echo.

REM ==========================================================
REM  1. Verificar que PHP este disponible
REM ==========================================================
php -v >nul 2>&1
if errorlevel 1 (
  echo   [X] No se encontro PHP.
  echo.
  echo       Composer necesita PHP para funcionar. En Windows lo mas
  echo       comodo es instalar Laragon, que trae PHP, Composer y
  echo       PostgreSQL en un solo instalador:
  echo.
  echo           https://laragon.org/download/
  echo.
  echo       Despues de instalarlo, cierre esta ventana, abra una
  echo       nueva y vuelva a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('php -r "echo PHP_VERSION;"') do set PHPVER=%%v
echo   [OK] PHP %PHPVER%

REM ==========================================================
REM  2. Verificar la extension de PostgreSQL
REM ==========================================================
php -r "exit(extension_loaded('pdo_pgsql') ? 0 : 1);"
if errorlevel 1 (
  echo   [!]  La extension pdo_pgsql NO esta activa en PHP.
  echo.
  echo        Sin ella Laravel no puede hablar con PostgreSQL.
  echo        Abra su archivo php.ini y quite el punto y coma ^(;^)
  echo        del inicio de estas dos lineas:
  echo.
  echo            extension=pdo_pgsql
  echo            extension=pgsql
  echo.
  echo        Para saber donde esta su php.ini:  php --ini
  echo        Guarde, cierre esta ventana y vuelva a ejecutar.
  echo.
  pause
  exit /b 1
)
echo   [OK] Extension pdo_pgsql activa

REM ==========================================================
REM  2b. Verificar la extension zip
REM      Composer descarga los paquetes como .zip, y ademas
REM      PhpSpreadsheet la necesita siempre: un .xlsx es un zip
REM      por dentro. Sin ella no hay registro masivo.
REM ==========================================================
php -r "exit(extension_loaded('zip') ? 0 : 1);"
if errorlevel 1 (
  echo   [!]  La extension zip NO esta activa en PHP.
  echo.
  echo        Sin ella Composer no puede descomprimir los paquetes,
  echo        y el registro masivo tampoco podria leer archivos .xlsx
  echo        ^(un Excel es un zip por dentro^).
  echo.
  echo        Ejecute:   activar-extensiones-php.bat
  echo        Ese script edita el php.ini por usted ^(pide permisos
  echo        de administrador y hace un respaldo antes^).
  echo.
  pause
  exit /b 1
)
echo   [OK] Extension zip activa

REM ==========================================================
REM  3. Ubicar composer.phar
REM ==========================================================
if not exist "composer.phar" if exist "backend\composer.phar" (
  move /y "backend\composer.phar" "composer.phar" >nul
)
if not exist "composer.phar" if exist "_archivos-backend\composer.phar" (
  move /y "_archivos-backend\composer.phar" "composer.phar" >nul
)

if not exist "composer.phar" (
  echo   [..] Descargando Composer...
  php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
  php composer-setup.php --quiet
  del composer-setup.php >nul 2>&1
)

if not exist "composer.phar" (
  echo   [X] No se pudo obtener composer.phar.
  echo       Descarguelo manualmente de https://getcomposer.org/composer.phar
  echo       y guardelo en esta misma carpeta.
  pause
  exit /b 1
)

REM OJO: la variable de entorno COMPOSER esta reservada -- Composer la
REM interpreta como la ruta de un composer.json. Si quedo definida por
REM un intento anterior, hay que limpiarla o toda ejecucion falla con
REM "does not contain valid JSON".
set "COMPOSER="
set "PHARFILE=%CD%\composer.phar"
echo   [OK] Composer listo
echo.

REM ==========================================================
REM  4. Instalar Laravel
REM     create-project exige que la carpeta destino este VACIA,
REM     y backend\ ya tiene los archivos del proyecto. Por eso
REM     primero se ponen a salvo con otro nombre.
REM ==========================================================
if exist "backend\artisan" (
  echo   [OK] Laravel ya estaba instalado en backend\
  goto :dependencias
)

if not exist "_archivos-backend" (
  if exist "backend" (
    echo   [..] Guardando los archivos del proyecto en _archivos-backend\
    ren "backend" "_archivos-backend"
  )
)

echo   [..] Instalando Laravel ^(esto tarda unos minutos^)...
echo.
php "%PHARFILE%" create-project laravel/laravel backend --no-interaction
echo.

if not exist "backend\artisan" (
  echo   [X] La instalacion de Laravel fallo.
  echo       Revise el mensaje de error de arriba. Lo mas comun es
  echo       falta de conexion a internet o que falte activar la
  echo       extension "openssl" o "zip" en php.ini
  echo.
  echo       Sus archivos siguen intactos en _archivos-backend\
  pause
  exit /b 1
)
echo   [OK] Laravel instalado

REM ==========================================================
REM  5. Devolver los archivos del proyecto encima de Laravel
REM ==========================================================
if exist "_archivos-backend" (
  echo   [..] Copiando los archivos del proyecto sobre Laravel...
  xcopy "_archivos-backend\*" "backend\" /E /I /Y /Q >nul
  echo   [OK] Archivos del proyecto en su lugar
)
echo.

:dependencias
REM ==========================================================
REM  6. Libreria para leer y escribir Excel
REM ==========================================================
if exist "backend\vendor\phpoffice\phpspreadsheet" (
  echo   [OK] PhpSpreadsheet ya instalado
  goto :entorno
)

echo   [..] Instalando PhpSpreadsheet ^(lectura de Excel^)...
echo.
php "%PHARFILE%" require phpoffice/phpspreadsheet --working-dir=backend --no-interaction
echo.

REM No basta con que el comando termine: hay que ver la carpeta.
REM PhpSpreadsheet exige gd, dom, simplexml, xml, xmlwriter, iconv y zip.
REM Si falta una sola, Composer se niega y antes esto pasaba en silencio.
if not exist "backend\vendor\phpoffice\phpspreadsheet" (
  echo   [X] PhpSpreadsheet NO se instalo.
  echo.
  echo       Casi siempre es porque falta alguna extension de PHP.
  echo       Lea el mensaje de arriba: si dice "requires ext-algo",
  echo       esa es la que falta.
  echo.
  echo       Ejecute:   activar-extensiones-php.bat
  echo       ^(ya contempla gd, dom, simplexml, xml, xmlwriter e iconv^)
  echo       y despues vuelva a correr este archivo.
  echo.
  echo       Sin esta libreria funciona todo menos la importacion de
  echo       Excel del lado del servidor. La de la PWA si sirve.
  echo.
  pause
  exit /b 1
)
echo   [OK] PhpSpreadsheet instalado
echo.

:entorno

REM ==========================================================
REM  7. Archivo .env con los datos de PostgreSQL
REM ==========================================================
if exist "backend\.env" (
  findstr /C:"DB_CONNECTION=pgsql" "backend\.env" >nul 2>&1
  if not errorlevel 1 (
    echo   [OK] backend\.env ya apunta a PostgreSQL
    goto :pwaenv
  )
  echo   [..] Respaldando el .env anterior como .env.respaldo
  copy /y "backend\.env" "backend\.env.respaldo" >nul
)

echo   [..] Creando backend\.env con la configuracion de PostgreSQL...

> "backend\.env" echo APP_NAME="Gestion Biomedica"
>> "backend\.env" echo APP_ENV=local
>> "backend\.env" echo APP_KEY=
>> "backend\.env" echo APP_DEBUG=true
>> "backend\.env" echo APP_TIMEZONE=America/Bogota
>> "backend\.env" echo APP_URL=http://localhost:8000
>> "backend\.env" echo.
>> "backend\.env" echo APP_LOCALE=es
>> "backend\.env" echo APP_FALLBACK_LOCALE=es
>> "backend\.env" echo.
>> "backend\.env" echo LOG_CHANNEL=stack
>> "backend\.env" echo LOG_LEVEL=debug
>> "backend\.env" echo.
>> "backend\.env" echo DB_CONNECTION=pgsql
>> "backend\.env" echo DB_HOST=127.0.0.1
>> "backend\.env" echo DB_PORT=5432
>> "backend\.env" echo DB_DATABASE=Bioregistros
>> "backend\.env" echo DB_USERNAME=postgres
>> "backend\.env" echo DB_PASSWORD=root
>> "backend\.env" echo.
>> "backend\.env" echo SESSION_DRIVER=file
>> "backend\.env" echo QUEUE_CONNECTION=sync
>> "backend\.env" echo CACHE_STORE=file
>> "backend\.env" echo.
>> "backend\.env" echo CORS_ORIGENES=http://localhost:3000,http://localhost:5173

echo   [OK] backend\.env creado

:pwaenv
REM ==========================================================
REM  7b. .env de la PWA
REM      Vite solo expone al navegador las variables que empiezan
REM      por VITE_. Sin esta linea el frontend no sabe a donde
REM      llamar y la sincronizacion nunca sale del celular.
REM ==========================================================
if exist ".env" (
  findstr /C:"VITE_API_URL" ".env" >nul 2>&1
  if errorlevel 1 (
    echo   [..] Agregando VITE_API_URL al .env de la PWA...
    >> ".env" echo.
    >> ".env" echo # --- API de Laravel ---
    >> ".env" echo # /api usa el proxy de Vite hacia el puerto 8000.
    >> ".env" echo # Para probar desde un celular, ponga aqui la IP del PC:
    >> ".env" echo #   VITE_API_URL=http://192.168.1.50:8000/api
    >> ".env" echo VITE_API_URL=/api
    echo   [OK] VITE_API_URL agregado
  ) else (
    echo   [OK] El .env de la PWA ya tiene VITE_API_URL
  )
) else (
  echo   [..] Creando el .env de la PWA...
  > ".env" echo VITE_API_URL=/api
  echo   [OK] .env creado
)
echo.

:llave
REM ==========================================================
REM  8. Llave de la aplicacion
REM ==========================================================
cd backend
findstr /R /C:"^APP_KEY=base64:" ".env" >nul 2>&1
if errorlevel 1 (
  echo   [..] Generando la llave de la aplicacion...
  php artisan key:generate --force >nul
  echo   [OK] Llave generada
) else (
  echo   [OK] La llave ya existe
)
echo.

REM ==========================================================
REM  9. Migraciones
REM ==========================================================
echo ============================================================
echo    Ultimo paso: crear las tablas en PostgreSQL
echo ============================================================
echo.
echo   Antes de continuar, la base de datos "Bioregistros" debe
echo   existir. Si aun no la ha creado, abra pgAdmin o psql y corra:
echo.
echo       CREATE DATABASE "Bioregistros";
echo.
echo   ^(las comillas dobles importan: la B va en mayuscula^)
echo.
pause
echo.
echo   [..] Creando las tablas...
echo.
php artisan migrate --force

if errorlevel 1 (
  echo.
  echo   [!]  Las migraciones no se completaron.
  echo.
  echo        Causas mas frecuentes:
  echo         - La base "Bioregistros" no existe todavia.
  echo         - PostgreSQL no esta corriendo.
  echo         - La contrasena en backend\.env no es la correcta
  echo           ^(ahora dice DB_PASSWORD=root^).
  echo.
  echo        Corrija y vuelva a correr:   php artisan migrate
  echo.
  cd ..
  pause
  exit /b 1
)

cd ..

echo.
echo ============================================================
echo    Listo. El backend quedo instalado.
echo ============================================================
echo.
echo   Para arrancarlo, ejecute:   iniciar-backend.bat
echo   Para arrancar la PWA:       npm run dev
echo.
echo   Puede borrar la carpeta _archivos-backend\ cuando quiera;
echo   su contenido ya esta copiado dentro de backend\
echo.
pause
