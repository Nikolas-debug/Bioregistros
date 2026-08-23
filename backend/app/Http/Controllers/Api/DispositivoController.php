<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dispositivo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DispositivoController extends Controller
{
    /** GET /api/dispositivos?servicio=&buscar= */
    public function index(Request $request): JsonResponse
    {
        $consulta = Dispositivo::query()->where('activo', true);

        if ($servicio = $request->query('servicio')) {
            $consulta->where('servicio', 'ilike', "%{$servicio}%");
        }

        if ($buscar = $request->query('buscar')) {
            $consulta->where(function ($q) use ($buscar) {
                $q->where('equipo', 'ilike', "%{$buscar}%")
                    ->orWhere('serie', 'ilike', "%{$buscar}%")
                    ->orWhere('inventario', 'ilike', "%{$buscar}%")
                    ->orWhere('marca', 'ilike', "%{$buscar}%");
            });
        }

        return response()->json(
            $consulta->orderBy('equipo')->paginate($request->integer('por_pagina') ?: 100)
        );
    }

    /** GET /api/dispositivos/{id} — ficha y hoja de vida del equipo. */
    public function show(int $id): JsonResponse
    {
        $dispositivo = Dispositivo::with([
            'mantenimientos' => fn ($q) => $q->orderBy('fecha', 'desc'),
        ])->findOrFail($id);

        return response()->json([
            'dispositivo'           => $dispositivo,
            'proximo_mantenimiento' => $dispositivo->proximo_mantenimiento,
            'hoja_de_vida'          => $dispositivo->mantenimientos,
        ]);
    }

    /** POST /api/dispositivos */
    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'equipo'           => ['required', 'string', 'max:200'],
            'serie'            => ['nullable', 'string', 'max:160'],
            'inventario'       => ['nullable', 'string', 'max:120'],
            'marca'            => ['nullable', 'string', 'max:160'],
            'modelo'           => ['nullable', 'string', 'max:160'],
            'servicio'         => ['nullable', 'string', 'max:160'],
            'ubicacion'        => ['nullable', 'string', 'max:180'],
            'clase_riesgo'     => ['nullable', 'string', 'max:10'],
            'estado'           => ['nullable', 'string', 'max:200'],
            'frecuencia_meses' => ['nullable', 'integer', 'min:1', 'max:60'],
        ]);

        // Si el equipo ya existe por serie o inventario, se actualiza en vez
        // de crear un duplicado.
        $dispositivo = Dispositivo::buscarPor($datos['serie'] ?? null, $datos['inventario'] ?? null);

        if ($dispositivo) {
            $dispositivo->fill($datos)->save();

            return response()->json($dispositivo);
        }

        return response()->json(Dispositivo::create($datos), 201);
    }

    /** PUT /api/dispositivos/{id} */
    public function update(Request $request, int $id): JsonResponse
    {
        $dispositivo = Dispositivo::findOrFail($id);
        $dispositivo->fill($request->all())->save();

        return response()->json($dispositivo);
    }

    /**
     * GET /api/dispositivos/proximos
     * Equipos cuyo preventivo ya vencio o vence este mes.
     */
    public function proximos(): JsonResponse
    {
        $limite = now()->endOfMonth()->format('Y-m-d');
        $hoy = now()->format('Y-m-d');

        $equipos = Dispositivo::where('activo', true)
            ->whereNotNull('ultimo_mantenimiento')
            ->get()
            ->filter(fn ($d) => $d->proximo_mantenimiento && $d->proximo_mantenimiento <= $limite)
            ->sortBy('proximo_mantenimiento')
            ->values()
            ->map(fn ($d) => [
                'id'                    => $d->id,
                'equipo'                => $d->equipo,
                'serie'                 => $d->serie,
                'inventario'            => $d->inventario,
                'servicio'              => $d->servicio,
                'ubicacion'             => $d->ubicacion,
                'ultimo_mantenimiento'  => $d->ultimo_mantenimiento?->format('Y-m-d'),
                'proximo_mantenimiento' => $d->proximo_mantenimiento,
                'vencido'               => $d->proximo_mantenimiento < $hoy,
            ]);

        return response()->json(['equipos' => $equipos]);
    }
}
