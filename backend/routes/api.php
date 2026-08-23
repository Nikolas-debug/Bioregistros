<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DispositivoController;
use App\Http\Controllers\Api\ImportacionController;
use App\Http\Controllers\Api\MantenimientoController;
use App\Http\Controllers\Api\SyncController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API - Gestion Biomedica
|--------------------------------------------------------------------------
| Todo exige token, salvo el login y el ping.
|
| El ping queda abierto a proposito: la PWA lo usa para distinguir "no hay
| servidor" de "el token vencio", y necesita poder preguntarlo antes de
| tener sesion. No revela ningun dato.
*/

Route::post('auth/login', [AuthController::class, 'login']);
Route::get('sync/ping', [SyncController::class, 'ping']);

Route::middleware('token')->group(function () {

    /* ---------- Sesion ---------- */
    Route::prefix('auth')->group(function () {
        Route::get('yo', [AuthController::class, 'yo']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::put('perfil', [AuthController::class, 'actualizarPerfil']);
        Route::put('contrasena', [AuthController::class, 'cambiarContrasena']);
    });

    /* ---------- Sincronizacion IndexedDB <-> PostgreSQL ---------- */
    Route::prefix('sync')->group(function () {
        Route::get('estado', [SyncController::class, 'estado']);
        Route::get('descargar', [SyncController::class, 'descargar']);
        Route::post('mantenimientos', [SyncController::class, 'mantenimientos']);
    });

    /* ---------- Importacion masiva del seguimiento ---------- */
    Route::prefix('importar')->group(function () {
        Route::get('plantilla', [ImportacionController::class, 'plantilla']);
        Route::post('excel', [ImportacionController::class, 'excel']);
    });

    /* ---------- Consecutivo de reportes ----------
    | Van antes del apiResource para que "siguiente" no se confunda
    | con un {id}.
    */
    Route::prefix('reportes')->group(function () {
        Route::get('siguiente', [MantenimientoController::class, 'siguienteReporte']);
        Route::get('previsualizar-insercion', [MantenimientoController::class, 'previsualizarInsercion']);
        Route::post('insertar', [MantenimientoController::class, 'insertarReporte']);
        Route::post('compactar', [MantenimientoController::class, 'compactarReportes']);
    });

    /* ---------- Mantenimientos ---------- */
    Route::get('mantenimientos/estadisticas', [MantenimientoController::class, 'estadisticas']);
    Route::apiResource('mantenimientos', MantenimientoController::class);

    /* ---------- Dispositivos ---------- */
    Route::get('dispositivos/proximos', [DispositivoController::class, 'proximos']);
    Route::apiResource('dispositivos', DispositivoController::class)->except(['destroy']);
});
