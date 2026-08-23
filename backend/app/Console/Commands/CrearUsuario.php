<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/**
 * Crea o actualiza un usuario de la aplicacion.
 *
 *   php artisan usuario:crear
 *
 * Pregunta la contraseña de forma oculta, para que no quede en el
 * historial de la consola ni en ningun archivo del repositorio.
 *
 * Tambien acepta los datos por parametro, util al desplegar:
 *   php artisan usuario:crear --email=luis@biomedica.local --nombre="Luis" --password=...
 */
class CrearUsuario extends Command
{
    protected $signature = 'usuario:crear
                            {--email= : Correo o usuario de acceso}
                            {--nombre= : Nombre completo}
                            {--cargo= : Cargo, ej. Ingeniero Biomédico}
                            {--institucion= : Nombre de la clínica o IPS}
                            {--password= : Contraseña (si se omite, se pregunta)}
                            {--forzar : Actualiza el usuario si ya existe}';

    protected $description = 'Crea el usuario que puede entrar a la aplicación';

    public function handle(): int
    {
        $email = $this->option('email') ?: $this->ask('Correo o usuario de acceso');
        $nombre = $this->option('nombre') ?: $this->ask('Nombre completo');
        $cargo = $this->option('cargo') ?: $this->ask('Cargo', 'Ingeniero Biomédico');
        $institucion = $this->option('institucion') ?: $this->ask('Institución', '');

        $existente = User::where('email', $email)->first();

        if ($existente && ! $this->option('forzar')) {
            $this->warn("Ya existe un usuario con el correo {$email}.");

            if (! $this->confirm('¿Desea actualizar su contraseña y sus datos?', false)) {
                $this->info('No se hizo ningún cambio.');

                return self::SUCCESS;
            }
        }

        $password = $this->option('password');

        if (! $password) {
            $password = $this->secret('Contraseña (no se ve al escribir)');
            $confirmacion = $this->secret('Escríbala otra vez');

            if ($password !== $confirmacion) {
                $this->error('Las contraseñas no coinciden. No se hizo ningún cambio.');

                return self::FAILURE;
            }
        }

        $validador = Validator::make([
            'email'    => $email,
            'name'     => $nombre,
            'password' => $password,
        ], [
            'email'    => ['required', 'string', 'max:180'],
            'name'     => ['required', 'string', 'max:180'],
            'password' => ['required', 'string', 'min:8'],
        ], [
            'password.min' => 'La contraseña debe tener al menos 8 caracteres.',
            'required'     => 'El campo :attribute es obligatorio.',
        ]);

        if ($validador->fails()) {
            foreach ($validador->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $usuario = User::updateOrCreate(
            ['email' => $email],
            [
                'name'        => $nombre,
                'password'    => $password,     // el modelo lo cifra solo
                'cargo'       => $cargo ?: null,
                'institucion' => $institucion ?: null,
                'activo'      => true,
            ]
        );

        // Cualquier sesion anterior queda invalidada.
        $usuario->revocarToken();

        $this->newLine();
        $this->info($existente ? 'Usuario actualizado.' : 'Usuario creado.');
        $this->table(
            ['Campo', 'Valor'],
            [
                ['Acceso', $usuario->email],
                ['Nombre', $usuario->name],
                ['Cargo', $usuario->cargo ?: '—'],
                ['Institución', $usuario->institucion ?: '—'],
            ]
        );
        $this->newLine();
        $this->line('  La contraseña no se guarda en ningún archivo del proyecto.');
        $this->line('  Si se pierde, vuelva a correr este comando para cambiarla.');
        $this->newLine();

        return self::SUCCESS;
    }
}
