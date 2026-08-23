<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mantenimiento;
use App\Services\NumeroReporteService;
use App\Services\RegistroSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MantenimientoController extends Controller
{
    public function __construct(
        private RegistroSyncService $servicio,
        private NumeroReporteService $reportes,
    ) {}

    /** GET /api/mantenimientos?anio=&mes=&clase=&servicio=&buscar=&por_pagina= */
    public function index(Request $request): JsonResponse
    {
        $consulta = Mantenimiento::with('dispositivo')
            ->anio($request->integer('anio') ?: null)
            ->mes($request->integer('mes') ?: null)
            ->clase($request->query('clase'));

        if ($estado = $request->query('estado')) {
            $consulta->where('estado', 'ilike', "%{$estado}%");
        }

        if ($servicio = $request->query('servicio')) {
            $consulta->where('servicio', 'ilike', "%{$servicio}%");
        }

        if ($buscar = $request->query('buscar')) {
            $consulta->where(function ($q) use ($buscar) {
                $q->where('descripcion', 'ilike', "%{$buscar}%")
                    ->orWhere('observaciones', 'ilike', "%{$buscar}%")
                    ->orWhere('repuestos', 'ilike', "%{$buscar}%")
                    ->orWhereRaw('CAST(numero_reporte AS TEXT) = ?', [$buscar])
                    ->orWhereHas('dispositivo', fn ($d) => $d
                        ->where('equipo', 'ilike', "%{$buscar}%")
                        ->orWhere('serie', 'ilike', "%{$buscar}%")
                        ->orWhere('inventario', 'ilike', "%{$buscar}%"));
            });
        }

        return response()->json(
            $consulta->orderBy('numero_reporte', 'desc')
                ->paginate($request->integer('por_pagina') ?: 50)
        );
    }

    /** GET /api/mantenimientos/{id} */
    public function show(int $id): JsonResponse
    {
        return response()->json(
            Mantenimiento::with('dispositivo')->findOrFail($id)
        );
    }

    /** POST /api/mantenimientos — alta desde la app estando en linea. */
    public function store(Request $request): JsonResponse
    {
        $mantenimiento = $this->servicio->guardar($request->all(), 'app');

        return response()->json($mantenimiento->load('dispositivo'), 201);
    }

    /** PUT /api/mantenimientos/{id} */
    public function update(Request $request, int $id): JsonResponse
    {
        $actual = Mantenimiento::findOrFail($id);

        $datos = $request->all();
        $datos['uuid'] = $actual->uuid;                 // no se cambia la identidad
        $datos['numero_reporte'] = $actual->numero_reporte;

        $mantenimiento = $this->servicio->guardar($datos, 'manual');

        return response()->json($mantenimiento->load('dispositivo'));
    }

    /**
     * DELETE /api/mantenimientos/{id}?cerrar_hueco=1
     *
     * Por defecto el numero eliminado queda como hueco. Con cerrar_hueco=1
     * los reportes posteriores bajan en uno para que la secuencia siga
     * indicando cuantos hay antes.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $mantenimiento = Mantenimiento::findOrFail($id);
        $numero = $mantenimiento->numero_reporte;

        return DB::transaction(function () use ($mantenimiento, $numero, $request) {
            $mantenimiento->delete();

            $movidos = 0;
            if ($numero && $request->boolean('cerrar_hueco')) {
                $movidos = $this->reportes->cerrarHueco($numero);
            }

            return response()->json([
                'eliminado'       => $numero,
                'reportes_movidos' => $movidos,
            ]);
        });
    }

    /* ------------------------------------------------------------------ */
    /* Consecutivo de reportes                                             */
    /* ------------------------------------------------------------------ */

    /**
     * GET /api/reportes/siguiente
     * Que numero le tocaria a un registro nuevo.
     */
    public function siguienteReporte(): JsonResponse
    {
        return response()->json([
            'siguiente' => $this->reportes->siguiente(),
            'huecos'    => $this->reportes->huecos(),
        ]);
    }

    /**
     * GET /api/reportes/previsualizar-insercion?numero=3570
     * Cuantos reportes se moverian antes de decidir.
     */
    public function previsualizarInsercion(Request $request): JsonResponse
    {
        $numero = $request->integer('numero');

        if ($numero < 1) {
            return response()->json(['mensaje' => 'Indique un numero de reporte valido.'], 422);
        }

        return response()->json([
            'numero'      => $numero,
            'se_mueven'   => $this->reportes->cuantosSeMueven($numero),
            'ultimo'      => Mantenimiento::max('numero_reporte'),
        ]);
    }

    /**
     * POST /api/reportes/insertar
     * Body: el registro completo + numero_reporte deseado.
     *
     * Este es el unico camino que renumera reportes existentes, y solo
     * porque alguien lo pidio expresamente.
     */
    public function insertarReporte(Request $request): JsonResponse
    {
        $numero = $request->integer('numero_reporte');

        if ($numero < 1) {
            return response()->json([
                'mensaje' => 'Indique en que numero debe quedar el reporte.',
            ], 422);
        }

        return DB::transaction(function () use ($request, $numero) {
            $movidos = $this->reportes->abrirHueco($numero);

            $datos = $request->all();
            $datos['numero_reporte'] = $numero;

            $mantenimiento = $this->servicio->guardar($datos, 'manual');

            return response()->json([
                'mantenimiento'    => $mantenimiento->load('dispositivo'),
                'reportes_movidos' => $movidos,
                'mensaje'          => $movidos > 0
                    ? "Se insertó como reporte {$numero} y se corrieron {$movidos} reporte(s) posteriores."
                    : "Se insertó como reporte {$numero}.",
            ], 201);
        });
    }

    /**
     * POST /api/reportes/compactar
     * Body: { "desde": 1, "simular": true }
     *
     * Cierra todos los huecos de la numeracion. Con simular=true no escribe
     * nada y devuelve el listado de cambios que haria.
     */
    public function compactarReportes(Request $request): JsonResponse
    {
        $resultado = $this->reportes->compactar(
            $request->integer('desde') ?: 1,
            $request->boolean('simular')
        );

        return response()->json($resultado);
    }

    /** GET /api/mantenimientos/estadisticas?anio= */
    public function estadisticas(Request $request): JsonResponse
    {
        $anio = $request->integer('anio') ?: (int) date('Y');
        $base = Mantenimiento::whereYear('fecha', $anio);

        return response()->json([
            'anio'        => $anio,
            'total'       => (clone $base)->count(),
            'preventivos' => (clone $base)->where('preventivo', true)->count(),
            'correctivos' => (clone $base)->where('correctivo', true)->count(),
            'otros'       => (clone $base)->where('otro', true)->count(),
            'por_mes'     => (clone $base)
                ->selectRaw('EXTRACT(MONTH FROM fecha) as mes, count(*) as total')
                ->groupBy('mes')->orderBy('mes')->pluck('total', 'mes'),
            'por_servicio' => (clone $base)
                ->selectRaw("COALESCE(NULLIF(servicio, ''), 'Sin servicio') as servicio, count(*) as total")
                ->groupBy('servicio')->orderByDesc('total')->limit(20)
                ->pluck('total', 'servicio'),
        ]);
    }
}
