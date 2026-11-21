<?php

namespace Tests\Feature;

use App\Models\Mantenimiento;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class SincronizacionTest extends TestCase
{
    use RefreshDatabase;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->token = User::factory()->create()->generarToken();
    }

    private function fila(array $extra = []): array
    {
        return array_merge([
            'uuid'       => (string) Str::uuid(),
            'equipo'     => 'Monitor de signos vitales',
            'serie'      => 'SN-' . Str::random(6),
            'fecha'      => '2026-11-20',
            'preventivo' => true,
            'estado'     => 'FUNCIONAL',
        ], $extra);
    }

    private function subir(array $filas)
    {
        return $this->withToken($this->token)->postJson('/api/sync/mantenimientos', ['registros' => $filas]);
    }

    public function test_reenviar_el_mismo_uuid_actualiza_y_no_duplica(): void
    {
        $fila = $this->fila();

        $this->subir([$fila])->assertOk();
        $this->subir([array_merge($fila, ['estado' => 'FUERA DE SERVICIO'])])->assertOk();

        $this->assertSame(1, Mantenimiento::count());
        $this->assertSame('FUERA DE SERVICIO', Mantenimiento::first()->estado);
        $this->assertSame(1, Mantenimiento::first()->numero_reporte);
    }

    /** El celular manda la marca en UTC ("...Z"); la columna esta en hora de Bogota. */
    public function test_la_bajada_con_marca_utc_trae_lo_subido_hace_un_minuto(): void
    {
        $this->subir([$this->fila()])->assertOk();

        $marcaDelCelular = now()->subMinutes(2)->utc()->format('Y-m-d\TH:i:s.v\Z');

        $this->withToken($this->token)
            ->getJson('/api/sync/descargar?desde=' . urlencode($marcaDelCelular))
            ->assertOk()
            ->assertJsonPath('total', 1);
    }

    /** Una renumeracion deja cientos de filas con el mismo updated_at. */
    public function test_la_paginacion_avanza_aunque_todo_tenga_la_misma_hora(): void
    {
        $this->subir(array_map(fn () => $this->fila(), range(1, 5)))->assertOk();
        DB::table('mantenimientos')->update(['updated_at' => now()->startOfSecond()]);

        $desde = now()->subHour()->utc()->toIso8601ZuluString();
        $despuesDeId = null;
        $vistos = [];

        for ($vuelta = 0; $vuelta < 10; $vuelta++) {
            $r = $this->withToken($this->token)->getJson('/api/sync/descargar?' . http_build_query(array_filter([
                'desde'         => $desde,
                'limite'        => 2,
                'despues_de_id' => $despuesDeId,
            ])))->assertOk()->json();

            foreach ($r['registros'] as $m) {
                $vistos[$m['idServidor']] = true;
            }

            if (! $r['hay_mas']) {
                break;
            }
            $desde = $r['siguiente_desde'];
            $despuesDeId = $r['siguiente_id'];
        }

        $this->assertCount(5, $vistos);
        $this->assertLessThan(4, $vuelta, 'la paginacion no avanzaba');
    }

    /** Una fila rechazada no puede dejar en el lote un equipo que se deshizo. */
    public function test_una_fila_rechazada_no_rompe_las_siguientes_del_mismo_equipo(): void
    {
        $this->subir([$this->fila(['numero_reporte' => 100])])->assertOk();

        $respuesta = $this->subir([
            $this->fila(['serie' => 'NUEVO-1', 'numero_reporte' => 100]),   // numero ocupado
            $this->fila(['serie' => 'NUEVO-1']),                            // mismo equipo nuevo
        ])->assertStatus(207);

        $this->assertCount(1, $respuesta->json('aceptados'));
        $this->assertSame('validacion', $respuesta->json('rechazados.0.motivo'));
        $this->assertSame(101, $respuesta->json('aceptados.0.numero_reporte'));
    }

    /** Borrar en un equipo tiene que llegar a los demas, y no puede revivir. */
    public function test_un_borrado_viaja_en_la_bajada_y_no_revive(): void
    {
        $fila = $this->fila();
        $id = $this->subir([$fila])->assertOk()->json('aceptados.0.id');

        $this->withToken($this->token)->deleteJson("/api/mantenimientos/{$id}")->assertOk();

        $bajada = $this->withToken($this->token)
            ->getJson('/api/sync/descargar?desde=' . urlencode(now()->subHour()->utc()->toIso8601ZuluString()))
            ->assertOk();
        $bajada->assertJsonPath('registros.0.id', $fila['uuid']);
        $bajada->assertJsonPath('registros.0.eliminado', true);

        // Un celular atrasado reenvia una edicion del registro borrado.
        $this->subir([array_merge($fila, ['estado' => 'CALIBRADO'])])
            ->assertStatus(207)
            ->assertJsonPath('rechazados.0.motivo', 'validacion');

        // El numero 1 quedo libre para el siguiente registro.
        $this->subir([$this->fila()])->assertOk()->assertJsonPath('aceptados.0.numero_reporte', 1);
        $this->assertSame(1, Mantenimiento::count());
        $this->assertSame(2, Mantenimiento::withTrashed()->count());
    }

    /** Reenviar un registro sin serie ni inventario no deja equipos huerfanos. */
    public function test_reenviar_sin_identificador_no_crea_equipos_huerfanos(): void
    {
        $fila = $this->fila(['serie' => null]);

        foreach (range(1, 4) as $vez) {
            $this->subir([$fila])->assertOk();
        }

        $this->assertSame(1, \App\Models\Dispositivo::count());
    }

    /** "N/T" significa "no tiene": no puede volver un solo equipo a todos los que no tienen. */
    public function test_inventario_n_t_no_fusiona_equipos_distintos(): void
    {
        $this->subir([
            $this->fila(['serie' => null, 'inventario' => 'N/T', 'equipo' => 'LARINGOSCOPIO']),
            $this->fila(['serie' => 'NN', 'inventario' => 'N/T', 'equipo' => 'MESA DE PARTOS']),
            $this->fila(['serie' => null, 'inventario' => '15320000', 'equipo' => 'CAMA HOSPITALIZACION']),
        ])->assertOk();

        $this->assertSame(3, \App\Models\Dispositivo::count());
        $this->assertEqualsCanonicalizing(
            ['LARINGOSCOPIO', 'MESA DE PARTOS', 'CAMA HOSPITALIZACION'],
            Mantenimiento::with('dispositivo')->get()->pluck('dispositivo.equipo')->all(),
        );
    }

    /** Corregir un registro de un equipo ya fusionado lo separa sin renombrar a los demas. */
    public function test_editar_un_registro_fusionado_lo_separa(): void
    {
        $a = $this->fila(['serie' => 'TEMP-1', 'equipo' => 'LARINGOSCOPIO']);
        $b = $this->fila(['serie' => 'TEMP-1', 'equipo' => 'LARINGOSCOPIO']);
        $this->subir([$a, $b])->assertOk();
        DB::table('dispositivos')->update(['serie' => 'M/T', 'inventario' => 'N/T']);   // como quedo en produccion

        $this->subir([array_merge($a, ['serie' => 'M/T', 'inventario' => 'N/T', 'equipo' => 'MESA DE PARTOS'])])->assertOk();

        $porUuid = Mantenimiento::with('dispositivo')->get()->keyBy('uuid');
        $this->assertSame('MESA DE PARTOS', $porUuid[$a['uuid']]->dispositivo->equipo);
        $this->assertSame('LARINGOSCOPIO', $porUuid[$b['uuid']]->dispositivo->equipo);
    }
}
