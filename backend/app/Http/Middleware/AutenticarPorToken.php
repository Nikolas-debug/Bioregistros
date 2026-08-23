<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Deja pasar solo a quien traiga un token valido en
 * Authorization: Bearer <token>
 *
 * La busqueda es por el hash del token, que esta indexado: no se recorre
 * la tabla ni se comparan cadenas una por una.
 */
class AutenticarPorToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $usuario = User::porToken($request->bearerToken());

        if (! $usuario) {
            return response()->json([
                'mensaje' => 'Sesión no válida o expirada. Vuelva a iniciar sesión.',
            ], 401);
        }

        // Se registra el ultimo acceso, pero no en cada peticion: durante
        // una sincronizacion se harian decenas de escrituras inutiles.
        if (! $usuario->ultimo_acceso || $usuario->ultimo_acceso->diffInMinutes(now()) >= 10) {
            $usuario->forceFill(['ultimo_acceso' => now()])->saveQuietly();
        }

        $request->setUserResolver(fn () => $usuario);

        return $next($request);
    }
}
