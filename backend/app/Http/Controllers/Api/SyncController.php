<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mantenimiento;
use App\Services\RegistroSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Puente entre la IndexedDB del celular y PostgreSQL.
 *
 * La PWA envia lo que tiene pendiente. El servidor responde que uuid
 * quedaron guardados y con que numero de reporte; solo esos se borran de
 * IndexedDB. Lo que falle se queda en el dispositivo y se reintenta.
 */
class SyncController extends Controller
{
    public function __construct(private RegistroSyncService $servicio) {}

    /** GET /api/sync/ping — para saber si hay servidor, no solo wifi. */
    public function ping(): JsonResponse
    {
        return response()->json([
            'ok'       => true,
            'servidor' => config('app.name'),
            'hora'     => now()->toIso8601String(),
            'zona'     => config('app.timezone'),
        ]);
    }

    /**
     * POST /api/sync/mantenimientos
     *
     * Body: { "registros": [ {...} ] }   (maximo 500 por lote)
     *
     * Cada registro debe traer su `uuid`, que es lo que hace idempotente la
     * operacion: reenviar el mismo uuid actualiza, nunca duplica.
     *
     * El `numero_reporte` lo asigna el servidor y viaja de vuelta, porque
     * el celular no puede saber cuantos reportes hay en total.
     */
    public function mantenimientos(Request $request): JsonResponse
    {
        $request->validate([
            'registros'   => ['required', 'array', 'min:1', 'max:500'],
            'registros.*' => ['required', 'array'],
        ], [
            'registros.required' => 'No se recibio ningun registro para sincronizar.',
            'registros.max'      => 'Envie maximo 500 registros por lote.',
        ]);

        $aceptados = [];
        $rechazados = [];

        foreach ($request->input('registros') as $indice => $registro) {
            $uuidLocal = $registro['uuid'] ?? $registro['idLocal'] ?? null;

            try {
                $mantenimiento = $this->servicio->guardar($registro, $registro['origen'] ?? 'offline');

                $aceptados[] = [
                    'uuid'           => $uuidLocal ?? $mantenimiento->uuid,
                    'id'             => $mantenimiento->id,
                    'numero_reporte' => $mantenimiento->numero_reporte,
                ];
            } catch (ValidationException $e) {
                $rechazados[] = [
                    'uuid'    => $uuidLocal,
                    'fila'    => $indice + 1,
                    'motivo'  => 'validacion',
                    'errores' => $e->errors(),
                ];
            } catch (\Throwable $e) {
                Log::error('Fallo sincronizando mantenimiento', [
                    'uuid'  => $uuidLocal,
                    'error' => $e->getMessage(),
                ]);

                $rechazados[] = [
                    'uuid'    => $uuidLocal,
                    'fila'    => $indice + 1,
                    'motivo'  => 'servidor',
                    'errores' => ['general' => [$e->getMessage()]],
                ];
            }
        }

        return response()->json([
            'aceptados'  => $aceptados,
            'rechazados' => $rechazados,
            'resumen'    => [
                'recibidos' => count($request->input('registros')),
                'guardados' => count($aceptados),
                'fallidos'  => count($rechazados),
            ],
        ], count($rechazados) > 0 ? 207 : 200);   // 207 = exito parcial
    }

    /** GET /api/sync/estado */
    public function estado(): JsonResponse
    {
        return response()->json([
            'total_mantenimientos' => Mantenimiento::count(),
            'ultimo_reporte'       => Mantenimiento::max('numero_reporte'),
            'ultimo_sincronizado'  => Mantenimiento::max('sincronizado_en'),
            'preventivos'          => Mantenimiento::where('preventivo', true)->count(),
            'correctivos'          => Mantenimiento::where('correctivo', true)->count(),
            'otros'                => Mantenimiento::where('otro', true)->count(),
        ]);
    }

    /**
     * GET /api/sync/descargar?desde=2026-05-01T12:00:00Z&limite=1000
     *
     * La otra direccion de la sincronizacion, y la que hace que la base
     * sea de verdad compartida: aqui no se filtra por usuario ni por
     * dispositivo. Quien tenga sesion ve el mismo historial, entre desde
     * el celular o desde el PC. IndexedDB es la copia local de cada
     * equipo; esto es lo que la pone al dia.
     *
     * Se devuelve ordenado por `updated_at` ascendente para poder
     * paginar: mientras `hay_mas` sea true, el cliente vuelve a pedir
     * desde `siguiente_desde`.
     *
     * Los nombres de los campos son los de MaintenanceRecord de la PWA
     * (`id`, `specificLocation`, `failureComments`...), no los de la
     * tabla: lo que sale de aqui se guarda tal cual en IndexedDB, y el
     * `id` es la llave de ese almacen.
     */
    public function descargar(Request $request): JsonResponse
    {
        $limite = max(1, min((int) $request->query('limite', 1000), 2000));
        $desde  = $request->query('desde');

        $consulta = Mantenimiento::with('dispositivo');

        if ($desde) {
            $consulta->where('updated_at', '>=', $desde);
        }

        // Se pide uno de mas para saber si quedaron registros por fuera.
        $registros = $consulta
            ->orderBy('updated_at')
            ->orderBy('id')
            ->limit($limite + 1)
            ->get();

        $hayMas = $registros->count() > $limite;
        $registros = $registros->take($limite);

        $siguienteDesde = $hayMas && $registros->isNotEmpty()
            ? optional($registros->last()->updated_at)->toIso8601String()
            : null;

        return response()->json([
            'total'           => $registros->count(),
            'hay_mas'         => $hayMas,
            'siguiente_desde' => $siguienteDesde,
            'registros'       => $registros->map(fn ($m) => [
                'id'                     => $m->uuid,
                'idServidor'             => $m->id,
                'numeroReporte'          => $m->numero_reporte,
                'equipment'              => $m->dispositivo?->equipo ?? '',
                'brand'                  => $m->dispositivo?->marca ?? '',
                'model'                  => $m->dispositivo?->modelo ?? '',
                'serialNumber'           => $m->dispositivo?->serie ?? '',
                'inventoryCode'          => $m->dispositivo?->inventario ?? '',
                'service'                => $m->servicio ?? $m->dispositivo?->servicio ?? '',
                'specificLocation'       => $m->ubicacion ?? $m->dispositivo?->ubicacion ?? '',
                'date'                   => $m->fecha?->format('Y-m-d') ?? '',
                'time'                   => $m->hora,
                'preventivo'             => (bool) $m->preventivo,
                'correctivo'             => (bool) $m->correctivo,
                'otro'                   => (bool) $m->otro,
                'failureComments'        => $m->descripcion ?? '',
                'additionalObservations' => $m->observaciones ?? '',
                'finalStatus'            => $m->estado ?? '',
                'spareParts'             => $m->repuestos ?? '',
                'technicianName'         => $m->tecnico ?? '',
                'origen'                 => $m->origen,
                'createdAt'              => ($m->creado_en_dispositivo ?? $m->created_at)->getTimestampMs(),
                'updatedAt'              => $m->updated_at->getTimestampMs(),
                'syncState'              => 'synced',
            ])->values(),
            'servidor_hora' => now()->toIso8601String(),
        ]);
    }
}
