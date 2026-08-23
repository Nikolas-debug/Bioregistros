<?php

use App\Http\Controllers\SpaController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rutas web
|--------------------------------------------------------------------------
| En produccion Laravel tambien sirve la PWA: el build de Vite queda en
| public/ y cualquier direccion que no empiece por api/ devuelve su
| index.html. De ahi en adelante se encarga el navegador.
|
| Asi la aplicacion y la API viven en el mismo dominio: no hay CORS que
| configurar, ni dos servicios, ni dos certificados.
*/

Route::get('/{cualquiera?}', SpaController::class)
    ->where('cualquiera', '^(?!api|up).*$');
