<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Varios tokens por usuario: la misma cuenta se usa desde varios portatiles
 * y celulares, y con un solo token cada ingreso cerraba la sesion en los
 * demas. Se conservan los User::MAX_SESIONES mas recientes.
 *
 * Los tokens vigentes se copian para que nadie tenga que volver a ingresar.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->char('token_hash', 64)->unique();
            $table->timestamps();
        });

        DB::table('users')->whereNotNull('api_token_hash')->orderBy('id')
            ->each(fn ($u) => DB::table('api_tokens')->insert([
                'user_id'    => $u->id,
                'token_hash' => $u->api_token_hash,
                'created_at' => $u->token_creado_en ?? now(),
                'updated_at' => now(),
            ]));
    }

    public function down(): void
    {
        Schema::dropIfExists('api_tokens');
    }
};
