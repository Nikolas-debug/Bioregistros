<?php

use App\Http\Middleware\AutenticarPorToken;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // La API no usa sesiones ni formularios, asi que el token CSRF no
        // aplica: la protege el token de autenticacion.
        $middleware->validateCsrfTokens(except: ['api/*']);

        $middleware->alias([
            'token' => AutenticarPorToken::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Los errores de la API siempre en JSON, nunca en HTML.
        $exceptions->shouldRenderJsonWhen(
            fn ($request) => $request->is('api/*') || $request->expectsJson()
        );
    })->create();
