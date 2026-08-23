<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Mantenimiento extends Model
{
    use HasFactory;

    protected $table = 'mantenimientos';

    protected $fillable = [
        'uuid',
        'numero_reporte',
        'dispositivo_id',
        'fecha',
        'hora',
        'preventivo',
        'correctivo',
        'otro',
        'descripcion',
        'observaciones',
        'estado',
        'repuestos',
        'servicio',
        'ubicacion',
        'tecnico',
        'origen',
        'creado_en_dispositivo',
        'sincronizado_en',
    ];

    protected $casts = [
        'fecha'                 => 'date:Y-m-d',
        'numero_reporte'        => 'integer',
        'preventivo'            => 'boolean',
        'correctivo'            => 'boolean',
        'otro'                  => 'boolean',
        'creado_en_dispositivo' => 'datetime',
        'sincronizado_en'       => 'datetime',
    ];

    protected $appends = ['clases'];

    public function dispositivo(): BelongsTo
    {
        return $this->belongsTo(Dispositivo::class);
    }

    /**
     * Las casillas marcadas, como lista legible.
     * Una fila puede tener dos: en el seguimiento de mayo hay una marcada
     * como preventivo y correctivo a la vez.
     */
    public function getClasesAttribute(): array
    {
        return array_values(array_filter([
            $this->preventivo ? 'Preventivo' : null,
            $this->correctivo ? 'Correctivo' : null,
            $this->otro       ? 'Otro'       : null,
        ]));
    }

    /* ------------------------------------------------------------------ */
    /* Scopes                                                              */
    /* ------------------------------------------------------------------ */

    public function scopeAnio($query, ?int $anio)
    {
        return $anio ? $query->whereYear('fecha', $anio) : $query;
    }

    public function scopeMes($query, ?int $mes)
    {
        return $mes ? $query->whereMonth('fecha', $mes) : $query;
    }

    public function scopeClase($query, ?string $clase)
    {
        return match (mb_strtolower((string) $clase)) {
            'preventivo' => $query->where('preventivo', true),
            'correctivo' => $query->where('correctivo', true),
            'otro'       => $query->where('otro', true),
            default      => $query,
        };
    }
}
