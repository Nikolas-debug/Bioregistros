<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Codigos de acceso por correo.
 *
 * Se guarda la huella del codigo, nunca el codigo: quien lea la tabla no
 * puede entrar. Cada codigo vence a los pocos minutos, sirve una sola vez y
 * admite pocos intentos. Solo crea una tabla nueva: no toca datos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('codigos_acceso', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->char('codigo_hash', 64);
            $table->unsignedTinyInteger('intentos')->default(0);
            $table->timestamp('expira_en');
            $table->timestamp('usado_en')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'usado_en']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('codigos_acceso');
    }
};
