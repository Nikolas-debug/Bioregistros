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
            // Pasa en desarrollo, cuando la PWA corre aparte con
            // "npm run dev" y este servidor solo atiende la API.
            return response()->json([
                'aplicacion' => config('app.name'),
                'mensaje'    => 'La API está funcionando. La interfaz corre aparte en desarrollo.',
                'ping'       => url('/api/sync/ping'),
            ]);
        }

        // Sin cache: el index.html referencia los archivos con un hash en
        // el nombre, asi que si el navegador se queda con un index viejo
        // pide archivos que ya no existen y la aplicacion no carga.
        return response()
            ->file($indice, ['Cache-Control' => 'no-cache, must-revalidate']);
    }
}
