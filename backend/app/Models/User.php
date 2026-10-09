<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
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

    /** Dispositivos con sesion abierta a la vez; el ingreso mas viejo sale. */
    public const MAX_SESIONES = 5;

    /**
     * Genera un token nuevo, guarda solo su huella y devuelve el token en
     * claro. Es la unica vez que existe legible: si se pierde, se genera
     * otro. Si ya hay MAX_SESIONES abiertas, se cierra la mas antigua.
     */
    public function generarToken(): string
    {
        $token = Str::random(64);

        DB::table('api_tokens')->insert([
            'user_id'    => $this->id,
            'token_hash' => hash('sha256', $token),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $vigentes = DB::table('api_tokens')->where('user_id', $this->id)
            ->orderByDesc('id')->limit(self::MAX_SESIONES)->pluck('id');

        DB::table('api_tokens')->where('user_id', $this->id)
            ->whereNotIn('id', $vigentes)->delete();

        $this->forceFill(['ultimo_acceso' => now()])->save();

        return $token;
    }

    /** Cierra la sesion de ese token, o todas si no se indica ninguno. */
    public function revocarToken(?string $token = null): void
    {
        DB::table('api_tokens')->where('user_id', $this->id)
            ->when($token, fn ($q) => $q->where('token_hash', hash('sha256', $token)))
            ->delete();
    }

    /** Busca al dueño de un token. Devuelve null si no existe o esta inactivo. */
    public static function porToken(?string $token): ?self
    {
        if (! $token) {
            return null;
        }

        return static::whereIn('id', DB::table('api_tokens')
                ->where('token_hash', hash('sha256', $token))->select('user_id'))
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
