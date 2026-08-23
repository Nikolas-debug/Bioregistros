<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Autenticacion por token.
 *
 * Es deliberadamente minima: durante el mes de prueba hay un solo usuario.
 * No usa Sanctum para no arrastrar una dependencia mas, pero hace lo mismo
 * que hace Sanctum por dentro: token aleatorio de 256 bits, guardado como
 * SHA-256, enviado en la cabecera Authorization: Bearer.
 *
 * Cuando entren varios tecnicos y cada uno con varios dispositivos, el
 * camino es cambiar esto por Sanctum, que ya maneja varios tokens por
 * usuario y caducidad. Mientras tanto, un token por cuenta es suficiente y
 * es mas facil de auditar.
 */
class AuthController extends Controller
{
    /** Intentos de login permitidos antes de bloquear temporalmente. */
    private const INTENTOS_MAX = 5;
    private const BLOQUEO_SEGUNDOS = 300;

    /**
     * POST /api/auth/login
     * Body: { "email": "...", "password": "..." }
     */
    public function login(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'email'    => ['required', 'string', 'max:180'],
            'password' => ['required', 'string'],
        ], [
            'email.required'    => 'Escriba su correo o usuario.',
            'password.required' => 'Escriba su contraseña.',
        ]);

        // Freno contra fuerza bruta: por correo y por IP, para que un
        // atacante no pueda probar contraseñas sin limite.
        $llave = 'login:' . mb_strtolower($datos['email']) . '|' . $request->ip();

        if (RateLimiter::tooManyAttempts($llave, self::INTENTOS_MAX)) {
            $faltan = RateLimiter::availableIn($llave);

            return response()->json([
                'mensaje' => "Demasiados intentos fallidos. Espere {$faltan} segundos.",
            ], 429);
        }

        $usuario = User::where('email', $datos['email'])->first();

        if (! $usuario || ! Hash::check($datos['password'], $usuario->password)) {
            RateLimiter::hit($llave, self::BLOQUEO_SEGUNDOS);

            // Un solo mensaje para los dos casos: decir "ese correo no
            // existe" le confirmaria a un atacante que otro si existe.
            return response()->json([
                'mensaje' => 'El correo o la contraseña no son correctos.',
            ], 401);
        }

        if (! $usuario->activo) {
            return response()->json([
                'mensaje' => 'Esta cuenta está desactivada. Consulte con el administrador.',
            ], 403);
        }

        RateLimiter::clear($llave);

        return response()->json([
            'token'   => $usuario->generarToken(),
            'usuario' => $usuario->comoPerfil(),
        ]);
    }

    /** POST /api/auth/logout — invalida el token actual. */
    public function logout(Request $request): JsonResponse
    {
        $request->user()?->revocarToken();

        return response()->json(['mensaje' => 'Sesión cerrada.']);
    }

    /**
     * GET /api/auth/yo
     * La PWA lo llama al abrir para saber si el token guardado sigue
     * sirviendo. Si devuelve 401, muestra la pantalla de ingreso.
     */
    public function yo(Request $request): JsonResponse
    {
        return response()->json([
            'usuario' => $request->user()->comoPerfil(),
        ]);
    }

    /** PUT /api/auth/perfil — el usuario corrige su propio nombre o cargo. */
    public function actualizarPerfil(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'name'        => ['sometimes', 'string', 'max:180'],
            'cargo'       => ['sometimes', 'nullable', 'string', 'max:120'],
            'institucion' => ['sometimes', 'nullable', 'string', 'max:180'],
        ]);

        $usuario = $request->user();
        $usuario->fill($datos)->save();

        return response()->json(['usuario' => $usuario->comoPerfil()]);
    }

    /** PUT /api/auth/contrasena */
    public function cambiarContrasena(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'actual' => ['required', 'string'],
            'nueva'  => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'nueva.min'       => 'La contraseña nueva debe tener al menos 8 caracteres.',
            'nueva.confirmed' => 'La confirmación no coincide con la contraseña nueva.',
        ]);

        $usuario = $request->user();

        if (! Hash::check($datos['actual'], $usuario->password)) {
            return response()->json([
                'mensaje' => 'La contraseña actual no es correcta.',
            ], 422);
        }

        $usuario->password = $datos['nueva'];
        $usuario->save();

        // Cambiar la contraseña cierra la sesion en todos lados: es lo que
        // uno espera cuando la cambia justamente porque sospecha algo.
        return response()->json([
            'mensaje' => 'Contraseña actualizada. Vuelva a iniciar sesión.',
            'token'   => $usuario->generarToken(),
        ]);
    }
}
