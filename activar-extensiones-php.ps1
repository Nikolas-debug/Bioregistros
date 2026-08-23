# =====================================================================
#  Activa las extensiones de PHP que necesita el backend.
#
#  Por que hacen falta:
#   - zip      : Composer descarga los paquetes como .zip, y ademas
#                PhpSpreadsheet lo necesita SIEMPRE, porque un archivo
#                .xlsx es en realidad un zip por dentro. Sin esta
#                extension el registro masivo no puede leer Excel.
#   - openssl  : para descargar por https.
#   - pdo_pgsql / pgsql : para hablar con PostgreSQL.
#   - mbstring / fileinfo / curl : las pide Laravel.
#   - gd, dom, simplexml, xml, xmlwriter, iconv : las exige
#                PhpSpreadsheet. Si falta una sola, Composer se niega a
#                instalarlo y la importacion de Excel del servidor no
#                existe.
#
#  El script es seguro de repetir: antes de decidir nada revisa que
#  extensiones ya estan cargadas de verdad, para no escribirlas dos
#  veces. AMPPS carga algunas desde archivos .ini aparte, y duplicarlas
#  produce el aviso "Module already loaded".
#
#  El php.ini de AMPPS vive en Archivos de Programa, asi que este
#  script se pide permisos de administrador solo.
# =====================================================================

$ErrorActionPreference = 'Stop'

$MARCA = '; --- Extensiones activadas para Gestion Biomedica ---'

# ---------------------------------------------------------------------
#  PHP escribe avisos por stderr y PowerShell los trata como errores.
#  Esta funcion los captura como texto normal y los descarta.
# ---------------------------------------------------------------------
function Invocar-PHP {
    param([string[]]$Argumentos)

    $anterior = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $salida = & php @Argumentos 2>&1 | ForEach-Object { $_.ToString() }
    } finally {
        $ErrorActionPreference = $anterior
    }

    # Fuera los avisos de PHP; solo interesa la salida util.
    return $salida | Where-Object {
        $_ -notmatch '^\s*(PHP )?(Warning|Notice|Deprecated|Fatal)' -and
        $_ -notmatch '^\s*$'
    }
}

function Modulos-Cargados {
    return (Invocar-PHP @('-m')) |
        Where-Object { $_ -notmatch '^\s*\[' } |
        ForEach-Object { $_.Trim().ToLower() }
}

function Es-Administrador {
    $identidad = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identidad)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# --- Elevarse si hace falta -------------------------------------------
if (-not (Es-Administrador)) {
    Write-Host ""
    Write-Host "  Este script necesita permisos de administrador para editar" -ForegroundColor Yellow
    Write-Host "  el php.ini de AMPPS. Acepte la ventana que aparecera." -ForegroundColor Yellow
    Write-Host ""
    Start-Process powershell.exe -Verb RunAs -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit', '-File', "`"$PSCommandPath`""
    )
    exit
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   Extensiones de PHP para el backend" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Version de PHP ------------------------------------------------
$version = (Invocar-PHP @('-r', 'echo PHP_VERSION;')) | Select-Object -First 1

if (-not $version) {
    Write-Host "  [X] No se encontro PHP en el PATH." -ForegroundColor Red
    Write-Host "      Agregue C:\Program Files\Ampps\php al PATH de Windows."
    Read-Host "`n  Enter para cerrar"
    exit 1
}

Write-Host "  PHP detectado: $version"

$partes = $version.Split('.')
if ([int]$partes[0] -lt 8 -or ([int]$partes[0] -eq 8 -and [int]$partes[1] -lt 2)) {
    Write-Host ""
    Write-Host "  [X] Laravel necesita PHP 8.2 o superior." -ForegroundColor Red
    Write-Host "      El suyo es $version."
    Read-Host "`n  Enter para cerrar"
    exit 1
}

# --- 2. Ubicar el php.ini --------------------------------------------
$linea = (Invocar-PHP @('--ini')) | Where-Object { $_ -match 'Loaded Configuration File' }

if (-not $linea) {
    Write-Host "  [X] No se pudo determinar la ruta del php.ini" -ForegroundColor Red
    Read-Host "`n  Enter para cerrar"
    exit 1
}

$ini = ($linea -split ':\s+', 2)[1].Trim()

if ($ini -eq '(none)' -or -not (Test-Path $ini)) {
    Write-Host "  [X] PHP no esta usando ningun php.ini." -ForegroundColor Red
    Read-Host "`n  Enter para cerrar"
    exit 1
}

Write-Host "  Archivo de configuracion: $ini"
Write-Host ""

# PhpSpreadsheet exige varias de estas. Si falta una sola, Composer se
# niega a instalarlo y el registro masivo del servidor queda sin libreria.
$necesarias = @(
    'zip', 'openssl', 'mbstring', 'fileinfo', 'curl',
    'pdo_pgsql', 'pgsql',
    'gd', 'dom', 'simplexml', 'xml', 'xmlwriter', 'iconv'
)

# --- 3. Respaldo ------------------------------------------------------
$respaldo = "$ini.respaldo-" + (Get-Date -Format 'yyyyMMdd-HHmmss')
Copy-Item -Path $ini -Destination $respaldo -Force
Write-Host "  [OK] Respaldo: $respaldo"
Write-Host ""

# ---------------------------------------------------------------------
#  4. Primera pasada: quitar el bloque que haya agregado una ejecucion
#     anterior de este script. Asi partimos siempre del estado limpio
#     y podemos medir que extensiones carga PHP por su cuenta.
# ---------------------------------------------------------------------
$lineas = Get-Content -Path $ini
$limpio = @()
$dentroDelBloque = $false
$seLimpio = $false

foreach ($l in $lineas) {
    if ($l.Trim() -eq $MARCA -or $l.Trim() -eq '; --- Agregado para el backend de Gestion Biomedica ---') {
        $dentroDelBloque = $true
        $seLimpio = $true
        continue
    }

    if ($dentroDelBloque) {
        # El bloque son lineas "extension=algo" seguidas; termina al
        # encontrar cualquier otra cosa.
        if ($l -match '^\s*extension\s*=' -or $l.Trim() -eq '') {
            continue
        }
        $dentroDelBloque = $false
    }

    $limpio += $l
}

if ($seLimpio) {
    Set-Content -Path $ini -Value $limpio
    Write-Host "  [..] Se retiro el bloque agregado en una corrida anterior,"
    Write-Host "       para volver a calcularlo sin duplicados."
    Write-Host ""
}

# --- 5. Que carga PHP por su cuenta ----------------------------------
$cargadas = Modulos-Cargados

# --- 6. Segunda pasada: activar solo lo que falte ---------------------
$lineas      = Get-Content -Path $ini
$yaEstaban   = @()
$descomentadas = @()
$porAgregar  = @()

foreach ($ext in $necesarias) {

    if ($cargadas -contains $ext.ToLower()) {
        # AMPPS ya la carga (a veces desde otro archivo .ini).
        # Tocarla solo produciria "Module already loaded".
        $yaEstaban += $ext
        continue
    }

    $encontrada = $false

    for ($i = 0; $i -lt $lineas.Count; $i++) {
        # Reconoce  ;extension=zip   ;extension=php_zip.dll   ; extension = "zip"
        if ($lineas[$i] -match "^\s*;\s*extension\s*=\s*`"?(php_)?$ext(\.dll)?`"?\s*$") {
            $lineas[$i] = ($lineas[$i] -replace '^\s*;\s*', '')
            $descomentadas += $ext
            $encontrada = $true
            break
        }
    }

    if (-not $encontrada) {
        $porAgregar += $ext
    }
}

if ($porAgregar.Count -gt 0) {
    $lineas += ''
    $lineas += $MARCA
    foreach ($ext in $porAgregar) { $lineas += "extension=$ext" }
}

Set-Content -Path $ini -Value $lineas

if ($yaEstaban.Count -gt 0) {
    Write-Host "  [OK] Ya estaban activas: $($yaEstaban -join ', ')"
}
if ($descomentadas.Count -gt 0) {
    Write-Host "  [OK] Descomentadas:      $($descomentadas -join ', ')"
}
if ($porAgregar.Count -gt 0) {
    Write-Host "  [OK] Agregadas:          $($porAgregar -join ', ')"
}
if ($descomentadas.Count -eq 0 -and $porAgregar.Count -eq 0) {
    Write-Host "  [OK] No hubo nada que cambiar."
}
Write-Host ""

# --- 7. Verificar -----------------------------------------------------
Write-Host "  Verificando lo que PHP carga ahora..."
Write-Host ""

$cargadasAhora = Modulos-Cargados
$fallaron = @()

foreach ($ext in $necesarias) {
    if ($cargadasAhora -contains $ext.ToLower()) {
        Write-Host "     [OK] $ext"
    } else {
        Write-Host "     [X]  $ext  -- no se cargo" -ForegroundColor Red
        $fallaron += $ext
    }
}

Write-Host ""

# Comprobar que no quedaron avisos de duplicado.
$avisos = & {
    $anterior = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & php -m 2>&1 | ForEach-Object { $_.ToString() } } finally { $ErrorActionPreference = $anterior }
} | Where-Object { $_ -match 'already loaded' }

if ($avisos) {
    Write-Host "  [!]  PHP sigue avisando de extensiones duplicadas:" -ForegroundColor Yellow
    $avisos | ForEach-Object { Write-Host "       $_" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "       Puede venir de otro archivo .ini de AMPPS."
    Write-Host "       Para ver todos los que PHP lee:   php --ini"
    Write-Host ""
}

if ($fallaron.Count -gt 0) {
    Write-Host "============================================================" -ForegroundColor Yellow
    Write-Host "  Faltan extensiones por cargar" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Yellow
    Write-Host ""

    $carpetaExt = Join-Path (Split-Path $ini) 'ext'
    if (Test-Path $carpetaExt) {
        Write-Host "  Revisando la carpeta $carpetaExt"
        foreach ($ext in $fallaron) {
            $dll = Join-Path $carpetaExt "php_$ext.dll"
            if (Test-Path $dll) {
                Write-Host "     - php_$ext.dll SI existe (revise extension_dir en el php.ini)"
            } else {
                Write-Host "     - php_$ext.dll NO existe en esa carpeta" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  No existe la carpeta $carpetaExt" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "  La linea extension_dir del php.ini debe apuntar a esa carpeta:"
    Write-Host "     extension_dir = `"ext`""
    Write-Host ""
    Write-Host "  Si algo salio mal, el archivo original esta en:"
    Write-Host "  $respaldo"
    Write-Host ""
} else {
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  Todo listo." -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Cierre las ventanas de consola que tenga abiertas y"
    Write-Host "  ejecute:   instalar-backend.bat"
    Write-Host ""
}

Read-Host "  Enter para cerrar"
