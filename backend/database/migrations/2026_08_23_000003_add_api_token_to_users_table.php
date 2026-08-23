<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Autenticacion por token para la API.
 *
 * Se guarda el SHA-256 del token, nunca el token en claro: si alguien lee
 * la base de datos no puede suplantar a nadie. No hace falta bcrypt aqui
 * porque el token ya es aleatorio de 256 bits; bcrypt protege contra
 * fuerza bruta sobre secretos que las personas eligen, y este no lo es.
 *
 * Tambien se agregan el cargo y la institucion, que la app venia guardando
 * solo en el celular y se perdian al cambiar de dispositivo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->char('api_token_hash', 64)->nullable()->unique();
            $table->timestamp('token_creado_en')->nullable();
            $table->timestamp('ultimo_acceso')->nullable();

            $table->string('cargo', 120)->nullable();
            $table->string('institucion', 180)->nullable();
            $table->boolean('activo')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'api_token_hash', 'token_creado_en', 'ultimo_acceso',
                'cargo', 'institucion', 'activo',
            ]);
        });
    }
};
