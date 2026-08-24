<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

/**
 * Crea o actualiza el usuario inicial leyendo variables de entorno.
 *
 *   php artisan usuario:sembrar
 *
 * Existe para poder dar de alta al usuario en un servidor donde no hay
 * forma de abrir una consola interactiva. En Railway se ejecuta solo, en
 * cada arranque del contenedor.
 *
 * Variables que lee:
 *
 *   USUARIO_INICIAL_EMAIL        obligatoria
 *   USUARIO_INICIAL_PASSWORD     obligatoria
 *   USUARIO_INICIAL_NOMBRE       opcional
 *   USUARIO_INICIAL_CARGO        opcional
 *   USUARIO_INICIAL_INSTITUCION  opcional
 *
 * Si falta cualquiera de las dos obligatorias, no hace nada y termina
 * bien: asi el arranque del contenedor no se cae cuando las variables ya
 * se retiraron.
 *
 * Es idempotente a proposito. Si el usuario ya existe con esos mismos
 * datos y esa misma contraseña, no toca nada. Eso importa porque tocarlo
 * revocaria el token, y Luis tendria que volver a entrar en el celular
 * cada vez que se redespliega.
 */
class SembrarUsuario extends Command
{
    protected $signature = 'usuario:sembrar';

    protected $description = 'Crea el usuario inicial a partir de variables de entorno';

    /**
     * Lee una variable de entorno.
     *
     * Usa getenv() como respaldo porque con la configuracion en cache
     * Laravel no carga el archivo .env, y env() puede devolver null. En
     * Railway las variables son de verdad del sistema, asi que getenv()
     * siempre las ve.
     */
    private function variable(string $nombre): ?string
    {
        $valor = env($nombre);

        if ($valor === null || $valor === '') {
            $valor = getenv($nombre);
        }

        return is_string($valor) && $valor !== '' ? $valor : null;
    }

    public function handle(): int
    {
        $email = $this->variable('USUARIO_INICIAL_EMAIL');
        $password = $this->variable('USUARIO_INICIAL_PASSWORD');

        if (! $email || ! $password) {
            $this->line('  usuario:sembrar — sin variables, no hay nada que hacer.');

            return self::SUCCESS;
        }

        $nombre = $this->variable('USUARIO_INICIAL_NOMBRE') ?: $email;
        $cargo = $this->variable('USUARIO_INICIAL_CARGO');
        $institucion = $this->variable('USUARIO_INICIAL_INSTITUCION');

        $validador = Validator::make([
            'email'    => $email,
            'name'     => $nombre,
            'password' => $password,
        ], [
            'email'    => ['required', 'string', 'max:180'],
            'name'     => ['required', 'string', 'max:180'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        if ($validador->fails()) {
            foreach ($validador->errors()->all() as $error) {
                $this->error('  usuario:sembrar — '.$error);
            }

            // No devuelve fallo: el arranque del contenedor no debe caerse
            // por unas variables mal escritas. El mensaje queda en el
            // registro de Railway.
            return self::SUCCESS;
        }

        $usuario = User::where('email', $email)->first();

        if ($usuario
            && Hash::check($password, $usuario->password)
            && $usuario->name === $nombre
            && $usuario->cargo === $cargo
            && $usuario->institucion === $institucion
            && $usuario->activo) {
            $this->line("  usuario:sembrar — {$email} ya está al día, sin cambios.");

            return self::SUCCESS;
        }

        $creado = $usuario === null;

        $usuario = User::updateOrCreate(
            ['email' => $email],
            [
                'name'        => $nombre,
                'password'    => $password,     // el modelo lo cifra solo
                'cargo'       => $cargo,
                'institucion' => $institucion,
                'activo'      => true,
            ]
        );

        // Cambiar la contraseña invalida la sesion abierta.
        $usuario->revocarToken();

        $this->info(sprintf(
            '  usuario:sembrar — %s %s.',
            $creado ? 'creado' : 'actualizado',
            $email
        ));

        if (! $creado) {
            $this->line('  La sesión abierta en el celular quedó cerrada; hay que entrar de nuevo.');
        }

        $this->line('  Retire USUARIO_INICIAL_PASSWORD de las variables cuando ya no la necesite.');

        return self::SUCCESS;
    }
}
