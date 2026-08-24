<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Entrega la PWA.
 *
 * Es un controlador y no una funcion anonima en routes/web.php por una
 * razon concreta: `php artisan route:cache` no puede serializar closures,
 * y el arranque en produccion cachea las rutas. Con un closure ahi, el
 * despliegue falla con "Unable to prepare route for serialization".
 */
class SpaController extends Controller
{
    public function __invoke(): BinaryFileResponse|Response
    {
        $indice = public_path('index.html');

        if (! file_exists($indice)) {
            return response()->json([
                'aplicacion' => config('app.name'),
                'mensaje'    => 'La API está funcionando. La interfaz corre aparte en desarrollo.',
                'ping'       => url('/api/sync/ping'),
            ]);
        }

        return response()
            ->file($indice, ['Cache-Control' => 'no-cache, must-revalidate']);
    }
}
