<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CodigoAccesoTest extends TestCase
{
    use RefreshDatabase;

    /** El ultimo codigo que salio por el mailer de prueba (MAIL_MAILER=array). */
    private function ultimoCodigo(): ?string
    {
        $mensajes = app('mailer')->getSymfonyTransport()->messages();
        if ($mensajes->isEmpty()) {
            return null;
        }
        preg_match('/\b(\d{6})\b/', $mensajes->last()->getOriginalMessage()->getTextBody(), $m);

        return $m[1] ?? null;
    }

    public function test_pedir_y_usar_un_codigo(): void
    {
        User::factory()->create(['email' => 'lmachadoluna@gmail.com']);

        $this->postJson('/api/auth/codigo', ['email' => 'LMachadoLuna@gmail.com '])->assertOk();
        $codigo = $this->ultimoCodigo();
        $this->assertNotNull($codigo, 'no salio el correo');

        $this->postJson('/api/auth/codigo/verificar', ['email' => 'lmachadoluna@gmail.com', 'codigo' => $codigo])
            ->assertOk()->assertJsonStructure(['token', 'usuario']);

        // Sirve una sola vez.
        $this->postJson('/api/auth/codigo/verificar', ['email' => 'lmachadoluna@gmail.com', 'codigo' => $codigo])
            ->assertStatus(422);
    }

    public function test_un_correo_desconocido_responde_igual_y_no_envia_nada(): void
    {
        $this->postJson('/api/auth/codigo', ['email' => 'nadie@ejemplo.com'])
            ->assertOk()->assertJsonPath('mensaje', fn ($m) => str_starts_with($m, 'Si el correo está registrado'));

        $this->assertNull($this->ultimoCodigo());
    }

    public function test_un_codigo_vencido_no_sirve(): void
    {
        User::factory()->create(['email' => 'luis@ejemplo.com']);
        $this->postJson('/api/auth/codigo', ['email' => 'luis@ejemplo.com'])->assertOk();
        DB::table('codigos_acceso')->update(['expira_en' => now()->subMinute()]);

        $this->postJson('/api/auth/codigo/verificar', ['email' => 'luis@ejemplo.com', 'codigo' => $this->ultimoCodigo()])
            ->assertStatus(422);
    }

    public function test_cinco_fallos_queman_el_codigo(): void
    {
        User::factory()->create(['email' => 'luis@ejemplo.com']);
        $this->postJson('/api/auth/codigo', ['email' => 'luis@ejemplo.com'])->assertOk();
        $bueno = $this->ultimoCodigo();
        $malo = $bueno === '000000' ? '111111' : '000000';

        foreach (range(1, 5) as $i) {
            $this->postJson('/api/auth/codigo/verificar', ['email' => 'luis@ejemplo.com', 'codigo' => $malo])->assertStatus(422);
        }

        // Ni el correcto sirve ya.
        $this->postJson('/api/auth/codigo/verificar', ['email' => 'luis@ejemplo.com', 'codigo' => $bueno])
            ->assertStatus(422);
    }

    public function test_la_tabla_no_guarda_el_codigo(): void
    {
        User::factory()->create(['email' => 'luis@ejemplo.com']);
        $this->postJson('/api/auth/codigo', ['email' => 'luis@ejemplo.com'])->assertOk();

        $this->assertNotSame($this->ultimoCodigo(), DB::table('codigos_acceso')->value('codigo_hash'));
        $this->assertSame(64, strlen(DB::table('codigos_acceso')->value('codigo_hash')));
    }
}
