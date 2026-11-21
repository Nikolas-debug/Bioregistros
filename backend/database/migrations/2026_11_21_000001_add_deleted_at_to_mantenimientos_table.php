<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Borrado suave de mantenimientos.
 *
 * Al borrar de verdad la fila, los demas dispositivos nunca se enteraban:
 * la bajada solo trae lo que existe. Con deleted_at la fila queda como
 * "lapida" (sin numero de reporte, para no ocupar el consecutivo) y viaja
 * en la bajada para que cada equipo la quite de su copia local.
 *
 * Solo agrega una columna nula: no toca ninguna fila existente.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mantenimientos', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('mantenimientos', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
