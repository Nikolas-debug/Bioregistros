<?php

/**
 * Crea el usuario de la aplicacion escribiendo directo en PostgreSQL.
 *
 * Es un atajo para la etapa de prueba local. Hace exactamente lo mismo que
 * "php artisan usuario:crear", pero sin arrancar Laravel: asi funciona
 * aunque artisan se caiga con el fatal de collision, que aparece cuando
 * Laravel intenta DIBUJAR cualquier excepcion.
 *
 * La contrasena se guarda con bcrypt, que es lo mismo que usa el modelo
 * User (cast 'hashed'), asi que el login de la API la valida sin cambios.
 *
 *   php crear-usuario-local.php
 *   php crear-usuario-local.php luis@biomedica.local "Luis Tester" biomedica2026
 */

$archivoEnv = __DIR__ . DIRECTORY_SEPARATOR . 'backend' . DIRECTORY_SEPARATOR . '.env';

if (! is_file($archivoEnv)) {
    exit("  [X] No se encontro {$archivoEnv}" . PHP_EOL);
}

/* --- Datos del usuario --- */

$correo      = $argv[1] ?? 'luis@biomedica.local';
$nombre      = $argv[2] ?? 'Luis Tester';
$contrasena  = $argv[3] ?? 'biomedica2026';
$cargo       = 'Ingeniero Biomedico';
$institucion = 'Clinica del Nino';

if (mb_strlen($contrasena) < 8) {
    exit('  [X] La contrasena debe tener al menos 8 caracteres.' . PHP_EOL);
}

/* --- Conexion, leyendo backend/.env --- */

$env = [];
foreach (file($archivoEnv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linea) {
    $linea = trim($linea);
    if ($linea === '' || str_starts_with($linea, '#') || ! str_contains($linea, '=')) {
        continue;
    }
    [$clave, $valor] = explode('=', $linea, 2);
    $env[trim($clave)] = trim($valor, " \t\"'");
}

$host    = $env['DB_HOST']     ?? '127.0.0.1';
$puerto  = (int) ($env['DB_PORT'] ?? 5432);
$base    = $env['DB_DATABASE'] ?? '';
$usuario = $env['DB_USERNAME'] ?? '';
$clave   = $env['DB_PASSWORD'] ?? '';

try {
    $pdo = new PDO(
        "pgsql:host={$host};port={$puerto};dbname={$base}",
        $usuario,
        $clave,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
    );
} catch (Throwable $e) {
    echo '  [X] No se pudo conectar a la base:' . PHP_EOL;
    echo '      ' . $e->getMessage() . PHP_EOL;
    echo '      Corra primero revisar-backend-local.bat' . PHP_EOL;
    exit(1);
}

/* --- Alta o actualizacion --- */

// Mismo algoritmo que usa Laravel para el cast 'hashed'.
$hash = password_hash($contrasena, PASSWORD_BCRYPT, ['cost' => 12]);
$ahora = date('Y-m-d H:i:s');

$existente = $pdo->prepare('select id from users where email = ?');
$existente->execute([$correo]);
$id = $existente->fetchColumn();

if ($id) {
    $sql = $pdo->prepare(
        'update users
            set name = ?, password = ?, cargo = ?, institucion = ?, activo = true,
                api_token_hash = null, token_creado_en = null, updated_at = ?
          where id = ?'
    );
    $sql->execute([$nombre, $hash, $cargo, $institucion, $ahora, $id]);
    $accion = 'actualizado';
} else {
    $sql = $pdo->prepare(
        'insert into users (name, email, password, cargo, institucion, activo, created_at, updated_at)
         values (?, ?, ?, ?, ?, true, ?, ?)'
    );
    $sql->execute([$nombre, $correo, $hash, $cargo, $institucion, $ahora, $ahora]);
    $accion = 'creado';
}

/* --- Comprobacion, para no dejarlo a la fe --- */

$fila = $pdo->prepare('select name, password, activo from users where email = ?');
$fila->execute([$correo]);
$guardado = $fila->fetch(PDO::FETCH_ASSOC);

$valida = $guardado && password_verify($contrasena, $guardado['password']);

echo PHP_EOL;
echo str_repeat('=', 60), PHP_EOL;
echo "  Usuario {$accion}", PHP_EOL;
echo str_repeat('=', 60), PHP_EOL;
echo '  Acceso ......... ', $correo, PHP_EOL;
echo '  Contrasena ..... ', $contrasena, PHP_EOL;
echo '  Nombre ......... ', $nombre, PHP_EOL;
echo '  Activo ......... ', ($guardado['activo'] ? 'si' : 'no'), PHP_EOL;
echo '  Contrasena ok .. ', ($valida ? 'si, verificada' : 'NO — algo salio mal'), PHP_EOL;
echo PHP_EOL;
echo '  Con esto ya puede entrar a la aplicacion. Levante el backend con', PHP_EOL;
echo '  iniciar-backend.bat y la PWA con  npm run dev.', PHP_EOL;
echo PHP_EOL;
