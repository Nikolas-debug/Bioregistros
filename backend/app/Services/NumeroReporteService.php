<?php

namespace App\Services;

use App\Models\Mantenimiento;
use Illuminate\Support\Facades\DB;

/**
 * Maneja el consecutivo del seguimiento (columna REPORTE).
 *
 * La regla del negocio es que el numero indica cuantos reportes hay antes:
 * el 3566 es el reporte numero 3566. Para que eso se sostenga, insertar un
 * reporte olvidado obliga a correr en uno todos los posteriores.
 *
 * Ese corrimiento NO ocurre solo. Un registro normal se va al final con el
 * siguiente numero libre. Renumerar reportes que quiza ya se imprimieron o
 * se enviaron es una decision de la persona, no del programa.
 */
class NumeroReporteService
{
    /** El siguiente numero libre: se usa al registrar trabajo del dia. */
    public function siguiente(): int
    {
        return ((int) Mantenimiento::max('numero_reporte')) + 1;
    }

    /** Cuantos reportes se moverian si se inserta en esta posicion. */
    public function cuantosSeMueven(int $numero): int
    {
        return Mantenimiento::where('numero_reporte', '>=', $numero)->count();
    }

    /**
     * Abre un hueco en la posicion indicada corriendo en uno todos los
     * reportes de ahi en adelante. Devuelve cuantos se movieron.
     *
     * Funciona gracias a que la restriccion de unicidad es DEFERRABLE: el
     * UPDATE pasa transitoriamente por estados con numeros repetidos y
     * PostgreSQL solo verifica al cerrar la transaccion.
     */
    public function abrirHueco(int $numero): int
    {
        return DB::transaction(function () use ($numero) {
            $movidos = $this->cuantosSeMueven($numero);

            if ($movidos > 0) {
                DB::update(
                    'UPDATE mantenimientos
                     SET numero_reporte = numero_reporte + 1, updated_at = ?
                     WHERE numero_reporte >= ?',
                    [now(), $numero]
                );
            }

            return $movidos;
        });
    }

    /**
     * Cierra el hueco que deja un reporte eliminado: corre en menos uno
     * todos los posteriores. Devuelve cuantos se movieron.
     */
    public function cerrarHueco(int $numero): int
    {
        return DB::transaction(function () use ($numero) {
            $movidos = Mantenimiento::where('numero_reporte', '>', $numero)->count();

            if ($movidos > 0) {
                DB::update(
                    'UPDATE mantenimientos
                     SET numero_reporte = numero_reporte - 1, updated_at = ?
                     WHERE numero_reporte > ?',
                    [now(), $numero]
                );
            }

            return $movidos;
        });
    }

    /** Los numeros que faltan dentro del rango existente. */
    public function huecos(): array
    {
        $numeros = Mantenimiento::whereNotNull('numero_reporte')
            ->orderBy('numero_reporte')
            ->pluck('numero_reporte')
            ->map(fn ($n) => (int) $n)
            ->all();

        if (count($numeros) < 2) {
            return [];
        }

        $faltantes = [];
        for ($n = $numeros[0]; $n <= end($numeros); $n++) {
            $faltantes[$n] = true;
        }
        foreach ($numeros as $n) {
            unset($faltantes[$n]);
        }

        return array_keys($faltantes);
    }

    /**
     * Renumera todo de corrido a partir de `$desde`, en el orden actual
     * (fecha y luego numero), dejando la secuencia sin huecos.
     *
     * Es una operacion delicada: cambia numeros que ya pueden estar
     * impresos o enviados. Por eso solo se ejecuta cuando alguien la pide
     * expresamente, y antes se puede simular con $simular = true.
     */
    public function compactar(int $desde = 1, bool $simular = false): array
    {
        $registros = Mantenimiento::whereNotNull('numero_reporte')
            ->where('numero_reporte', '>=', $desde)
            ->orderBy('fecha')
            ->orderBy('numero_reporte')
            ->get(['id', 'numero_reporte', 'fecha']);

        $cambios = [];
        $siguiente = $desde;

        foreach ($registros as $registro) {
            if ((int) $registro->numero_reporte !== $siguiente) {
                $cambios[] = [
                    'id'      => $registro->id,
                    'fecha'   => $registro->fecha?->format('Y-m-d'),
                    'antes'   => (int) $registro->numero_reporte,
                    'despues' => $siguiente,
                ];
            }
            $siguiente++;
        }

        if (! $simular && $cambios) {
            DB::transaction(function () use ($cambios) {
                // Se apartan a un rango imposible y luego se bajan a su
                // destino. Asi ningun paso intermedio choca, incluso si la
                // restriccion no estuviera diferida.
                $apartado = ((int) Mantenimiento::max('numero_reporte')) + 1000;

                foreach ($cambios as $i => $c) {
                    Mantenimiento::where('id', $c['id'])
                        ->update(['numero_reporte' => $apartado + $i]);
                }

                foreach ($cambios as $c) {
                    Mantenimiento::where('id', $c['id'])
                        ->update(['numero_reporte' => $c['despues']]);
                }
            });
        }

        return [
            'simulacion' => $simular,
            'revisados'  => $registros->count(),
            'cambios'    => count($cambios),
            'detalle'    => array_slice($cambios, 0, 200),
        ];
    }
}
