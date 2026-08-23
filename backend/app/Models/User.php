<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'cargo',
        'institucion',
        'activo',
    ];

    /**
     * Nunca salen en un JSON. El hash del token esta aqui a proposito:
     * aunque no sirva para suplantar, no hay razon para exponerlo.
     */
    protected $hidden = [
        'password',
        'remember_token',
        'api_token_hash',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
            'token_creado_en'   => 'datetime',
            'ultimo_acceso'     => 'datetime',
            'activo'            => 'boolean',
        ];
    }

    /**
     * Genera un token nuevo, guarda solo su huella y devuelve el token en
     * claro. Es la unica vez que existe legible: si se pierde, se genera
     * otro. Iniciar sesion invalida el token anterior, asi que la cuenta
     * queda activa en un solo dispositivo a la vez.
     */
    public function generarToken(): string
    {
        $token = Str::random(64);

        $this->forceFill([
            'api_token_hash'  => hash('sha256', $token),
            'token_creado_en' => now(),
            'ultimo_acceso'   => now(),
        ])->save();

        return $token;
    }

    public function revocarToken(): void
    {
        $this->forceFill([
            'api_token_hash'  => null,
            'token_creado_en' => null,
        ])->save();
    }

    /** Busca al dueño de un token. Devuelve null si no existe o esta inactivo. */
    public static function porToken(?string $token): ?self
    {
        if (! $token) {
            return null;
        }

        return static::where('api_token_hash', hash('sha256', $token))
            ->where('activo', true)
            ->first();
    }

    /** Como lo espera la PWA. */
    public function comoPerfil(): array
    {
        return [
            'id'          => (string) $this->id,
            'name'        => $this->name,
            'email'       => $this->email,
            'role'        => $this->cargo ?? 'Técnico Biomédico',
            'institution' => $this->institucion ?? '',
            'avatarUrl'   => '',
            'isLoggedIn'  => true,
        ];
    }
}
