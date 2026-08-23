<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tabla Mantenimiento (el "seguimiento").
 *
 * Tres decisiones que vale la pena entender:
 *
 * 1. `id` es un entero autoincremental y nada mas. No significa nada para
 *    el negocio; solo sirve para relacionar filas.
 *
 * 2. `numero_reporte` es el consecutivo del seguimiento (3566, 3567...).
 *    NO es la llave primaria justamente porque tiene que poder moverse:
 *    al insertar un reporte olvidado, los posteriores se corren en uno.
 *    Su restriccion de unicidad es DEFERRABLE, es decir, se verifica al
 *    cerrar la transaccion y no fila por fila. Sin eso, un
 *    "UPDATE ... SET numero_reporte = numero_reporte + 1" fallaria a mitad
 *    de camino porque chocaria consigo mismo.
 *
 * 3. `uuid` lo genera el celular y es lo que hace idempotente la
 *    sincronizacion. Antes ese papel lo cumplia un codigo de texto tipo
 *    MN-2026-XXXX; ya no hace falta inventar codigos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mantenimientos', function (Blueprint $table) {
            $table->id();                                   // BIGSERIAL

            // Clave de idempotencia: la trae el dispositivo que registro.
            $table->uuid('uuid')->unique();

            // Consecutivo del seguimiento. Nulo mientras el servidor no lo
            // asigna (un registro hecho sin conexion todavia no sabe que
            // numero le toca, porque eso depende de toda la tabla).
            $table->unsignedInteger('numero_reporte')->nullable();

            $table->foreignId('dispositivo_id')
                ->constrained('dispositivos')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            $table->date('fecha');
            $table->time('hora')->nullable();

            // El seguimiento marca con X tres casillas independientes, y en
            // la practica una fila puede tener dos marcadas. Por eso son
            // tres booleanos y no un solo valor.
            $table->boolean('preventivo')->default(false);
            $table->boolean('correctivo')->default(false);
            $table->boolean('otro')->default(false);

            $table->text('descripcion')->nullable();
            $table->text('observaciones')->nullable();

            // Texto libre: en el archivo real aparece "FUNCIONAL", pero
            // tambien "SENSOR SPO2 CABEL AC" o "DISPLEY".
            $table->string('estado', 200)->nullable();
            $table->text('repuestos')->nullable();

            // Servicio y ubicacion al momento del reporte. Se guardan aqui
            // ademas de en el dispositivo porque los equipos se trasladan,
            // y el seguimiento debe reflejar donde estaba ese dia.
            $table->string('servicio', 160)->nullable();
            $table->string('ubicacion', 180)->nullable();

            $table->string('tecnico', 180)->nullable();

            $table->string('origen', 20)->default('app');
            $table->timestamp('creado_en_dispositivo')->nullable();
            $table->timestamp('sincronizado_en')->nullable();

            $table->timestamps();

            $table->index('fecha');
            $table->index('numero_reporte');
            $table->index(['dispositivo_id', 'fecha']);
        });

        // Unicidad diferida: ver el punto 2 del comentario de arriba.
        DB::statement(
            'ALTER TABLE mantenimientos
             ADD CONSTRAINT mantenimientos_numero_reporte_unico
             UNIQUE (numero_reporte) DEFERRABLE INITIALLY DEFERRED'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('mantenimientos');
    }
};
