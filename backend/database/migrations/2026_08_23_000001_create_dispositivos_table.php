<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tabla Dispositivo.
 *
 * Cambio frente a la primera version: la llave primaria ya no es la serie
 * sino un entero autoincremental. La razon la dio el archivo de
 * seguimiento real: de 149 filas, 26 no traen numero de serie. Una llave
 * primaria no admite vacios, asi que la serie no puede serlo.
 *
 * La serie sigue siendo unica cuando existe, mediante un indice parcial.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispositivos', function (Blueprint $table) {
            $table->id();                                   // BIGSERIAL

            $table->string('serie', 160)->nullable();
            $table->string('inventario', 120)->nullable();

            $table->string('equipo', 200);
            $table->string('marca', 160)->nullable();
            $table->string('modelo', 160)->nullable();

            // Texto libre a proposito: en el seguimiento aparecen
            // "HOSPITALISACION", "UCI NEO.", "TORRE B", "CKU.635"...
            // Cualquier lista cerrada rechazaria datos reales.
            $table->string('servicio', 160)->nullable();
            $table->string('ubicacion', 180)->nullable();

            $table->string('clase_riesgo', 10)->nullable();
            $table->string('estado', 200)->nullable();

            $table->unsignedSmallInteger('frecuencia_meses')->default(6);
            $table->date('ultimo_mantenimiento')->nullable();
            $table->boolean('activo')->default(true);

            $table->timestamps();

            $table->index('servicio');
            $table->index('equipo');
            $table->index('inventario');
        });

        // Indice unico parcial: PostgreSQL admite varios NULL, asi que los
        // equipos sin serie conviven sin chocar entre ellos.
        DB::statement(
            'CREATE UNIQUE INDEX dispositivos_serie_unico
             ON dispositivos (serie) WHERE serie IS NOT NULL'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('dispositivos');
    }
};
