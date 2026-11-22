<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Autenticacion por token.
 *
 * Es deliberadamente minima: durante el mes de prueba hay un solo usuario.
 * No usa Sanctum para no arrastrar una dependencia mas, pero hace lo mismo
 * que hace Sanctum por dentro: token aleatorio de 256 bits, guardado como
 * SHA-256, enviado en la cabecera Authorization: Bearer.
 *
 * Cada cuenta puede tener hasta User::MAX_SESIONES tokens (uno por
 * dispositivo), guardados en la tabla api_tokens.
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

        // Sin distinguir mayusculas: el teclado del celular pone la primera
        // letra en mayuscula y "Luis@..." fallaba con la clave correcta.
        $usuario = User::whereRaw('lower(email) = ?', [mb_strtolower(trim($datos['email']))])->first();

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

    /* ------------------------------------------------------------------ */
    /* Acceso con codigo por correo                                        */
    /* ------------------------------------------------------------------ */

    private const CODIGO_MINUTOS = 10;
    private const CODIGO_INTENTOS = 5;

    /** Huella del codigo con la llave de la app: la tabla sola no sirve para adivinarlo. */
    private function huella(string $codigo): string
    {
        return hash_hmac('sha256', $codigo, (string) config('app.key'));
    }

    private function usuarioPorCorreo(string $email): ?User
    {
        return User::whereRaw('lower(email) = ?', [mb_strtolower(trim($email))])->first();
    }

    /**
     * POST /api/auth/codigo   Body: { "email": "..." }
     *
     * Envia un codigo de 6 digitos al correo. Responde lo mismo exista o
     * no la cuenta, para no confirmarle a nadie que correos estan dados de
     * alta.
     */
    public function pedirCodigo(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'email' => ['required', 'string', 'max:180'],
        ], ['email.required' => 'Escriba su correo.']);

        $llave = 'codigo:' . mb_strtolower(trim($datos['email'])) . '|' . $request->ip();
        if (RateLimiter::tooManyAttempts($llave, 3)) {
            return response()->json([
                'mensaje' => 'Ya se enviaron varios códigos. Espere ' . RateLimiter::availableIn($llave) . ' segundos.',
            ], 429);
        }
        RateLimiter::hit($llave, 600);

        // Sin correo configurado, Laravel "envia" escribiendo en el registro
        // del servidor: el codigo quedaria a la vista en los logs de Railway.
        if (app()->isProduction() && in_array(config('mail.default'), ['log', 'array'], true)) {
            return response()->json([
                'mensaje' => 'El envío de códigos por correo no está configurado todavía. Entre con su contraseña.',
            ], 503);
        }

        $usuario = $this->usuarioPorCorreo($datos['email']);

        if ($usuario && $usuario->activo) {
            $codigo = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

            DB::transaction(function () use ($usuario, $codigo) {
                // Solo vale el ultimo codigo pedido.
                DB::table('codigos_acceso')->where('user_id', $usuario->id)->whereNull('usado_en')
                    ->update(['usado_en' => now(), 'updated_at' => now()]);

                DB::table('codigos_acceso')->insert([
                    'user_id'     => $usuario->id,
                    'codigo_hash' => $this->huella($codigo),
                    'expira_en'   => now()->addMinutes(self::CODIGO_MINUTOS),
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            });

            try {
                Mail::raw(
                    "Su código de acceso a Gestión Biomédica es:\n\n    {$codigo}\n\n"
                    . 'Vence en ' . self::CODIGO_MINUTOS . " minutos y sirve una sola vez.\n"
                    . "Si usted no lo pidió, ignore este correo: nadie puede entrar sin él.\n",
                    fn ($m) => $m->to($usuario->email)->subject("{$codigo} es su código de acceso — Gestión Biomédica"),
                );
            } catch (\Throwable $e) {
                Log::error('No se pudo enviar el codigo de acceso', ['error' => $e->getMessage()]);

                return response()->json([
                    'mensaje' => 'No se pudo enviar el correo en este momento. Entre con su contraseña.',
                ], 503);
            }
        }

        return response()->json([
            'mensaje' => 'Si el correo está registrado, le llegó un código de 6 dígitos. Vence en '
                . self::CODIGO_MINUTOS . ' minutos.',
        ]);
    }

    /**
     * POST /api/auth/codigo/verificar   Body: { "email": "...", "codigo": "123456" }
     * Devuelve lo mismo que el login con contraseña.
     */
    public function verificarCodigo(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'email'  => ['required', 'string', 'max:180'],
            'codigo' => ['required', 'string', 'regex:/^\d{6}$/'],
        ], ['codigo.regex' => 'El código son 6 números.']);

        $llave = 'verificar:' . mb_strtolower(trim($datos['email'])) . '|' . $request->ip();
        if (RateLimiter::tooManyAttempts($llave, 10)) {
            return response()->json([
                'mensaje' => 'Demasiados intentos. Espere ' . RateLimiter::availableIn($llave) . ' segundos.',
            ], 429);
        }
        RateLimiter::hit($llave, 600);

        $invalido = response()->json(['mensaje' => 'El código no es correcto o ya venció. Pida uno nuevo.'], 422);

        $usuario = $this->usuarioPorCorreo($datos['email']);
        if (! $usuario || ! $usuario->activo) {
            return $invalido;
        }

        $registro = DB::table('codigos_acceso')->where('user_id', $usuario->id)->whereNull('usado_en')
            ->where('expira_en', '>', now())->orderByDesc('id')->first();

        if (! $registro) {
            return $invalido;
        }

        $intentos = $registro->intentos + 1;
        $acierta = hash_equals($registro->codigo_hash, $this->huella($datos['codigo']));

        DB::table('codigos_acceso')->where('id', $registro->id)->update([
            'intentos'   => $intentos,
            // Acertar lo gasta; fallar demasiadas veces tambien.
            'usado_en'   => $acierta || $intentos >= self::CODIGO_INTENTOS ? now() : null,
            'updated_at' => now(),
        ]);

        if (! $acierta) {
            return $invalido;
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
        $request->user()?->revocarToken($request->bearerToken());

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
        $usuario->revocarToken();

        // Cambiar la contraseña cierra la sesion en todos lados: es lo que
        // uno espera cuando la cambia justamente porque sospecha algo.
        return response()->json([
            'mensaje' => 'Contraseña actualizada. Vuelva a iniciar sesión.',
            'token'   => $usuario->generarToken(),
        ]);
    }
}
