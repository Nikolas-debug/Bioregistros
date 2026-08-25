<?php

namespace App\Console\Commands;

use App\Models\Mantenimiento;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Ramsey\Uuid\Uuid;

/**
 * Pone el uuid deterministico a los registros que ya estaban.
 *
 * Desde que la PWA deriva el uuid del numero de reporte
 * (uuid5(NAMESPACE_URL, 'seguimiento:reporte:N'), igual que
 * RegistroSyncService), volver a cargar un seguimiento actualiza las filas
 * en vez de chocar contra "el reporte N ya existe".
 *
 * Los registros importados ANTES de ese cambio tienen un uuid aleatorio,
 * asi que una recarga del mismo mes se veria como un choque de numeros.
 * Este comando los pasa al uuid que les corresponde. Se corre una sola
 * vez, y conviene correrlo primero con --simular.
 *
 *   php artisan seguimiento:reindexar-uuid --simular
 *   php artisan seguimiento:reindexar-uuid
 */
class ReindexarUuidReportes extends Command
{
    protected $signature = 'seguimiento:reindexar-uuid
                            {--simular : Muestra que cambiaria, sin escribir nada}';

    protected $description = 'Reasigna el uuid deterministico derivado del numero de reporte';

    public function handle(): int
    {
        $simular = (bool) $this->option('simular');

        $registros = Mantenimiento::whereNotNull('numero_reporte')
            ->orderBy('numero_reporte')
            ->get(['id', 'uuid', 'numero_reporte']);

        if ($registros->isEmpty()) {
            $this->info('No hay registros con numero de reporte.');

            return self::SUCCESS;
        }

        $cambiados = 0;
        $yaEstaban = 0;
        $conflictos = [];

        foreach ($registros as $m) {
            $esperado = Uuid::uuid5(
                Uuid::NAMESPACE_URL,
                'seguimiento:reporte:' . (int) $m->numero_reporte,
            )->toString();

            if ($m->uuid === $esperado) {
                $yaEstaban++;
                continue;
            }

            // Si otro registro ya ocupa ese uuid, hay dos filas peleando
            // por el mismo numero de reporte. Eso se revisa a mano.
            $ocupado = Mantenimiento::where('uuid', $esperado)
                ->where('id', '!=', $m->id)
                ->exists();

            if ($ocupado) {
                $conflictos[] = $m->numero_reporte;
                continue;
            }

            $this->line(sprintf(
                '  reporte %-6s  %s -> %s',
                $m->numero_reporte,
                $m->uuid,
                $esperado,
            ));

            if (! $simular) {
                DB::table('mantenimientos')->where('id', $m->id)->update(['uuid' => $esperado]);
            }

            $cambiados++;
        }

        $this->newLine();
        $this->info(sprintf(
            '%s %d registro(s). %d ya estaban bien.',
            $simular ? 'Se cambiarian' : 'Se cambiaron',
            $cambiados,
            $yaEstaban,
        ));

        if ($conflictos) {
            $this->warn(sprintf(
                '%d reporte(s) con el numero repetido en la base, sin tocar: %s',
                count($conflictos),
                implode(', ', array_slice($conflictos, 0, 30)) . (count($conflictos) > 30 ? '...' : ''),
            ));
        }

        return self::SUCCESS;
    }
}
