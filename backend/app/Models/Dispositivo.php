<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Dispositivo extends Model
{
    use HasFactory;

    protected $table = 'dispositivos';

    protected $fillable = [
        'serie',
        'inventario',
        'equipo',
        'marca',
        'modelo',
        'servicio',
        'ubicacion',
        'clase_riesgo',
        'estado',
        'frecuencia_meses',
        'ultimo_mantenimiento',
        'activo',
    ];

    protected $casts = [
        'ultimo_mantenimiento' => 'date:Y-m-d',
        'frecuencia_meses'     => 'integer',
        'activo'               => 'boolean',
    ];

    public function mantenimientos(): HasMany
    {
        return $this->hasMany(Mantenimiento::class);
    }

    /** Fecha estimada del proximo mantenimiento preventivo. */
    public function getProximoMantenimientoAttribute(): ?string
    {
        if (! $this->ultimo_mantenimiento) {
            return null;
        }

        return $this->ultimo_mantenimiento
            ->copy()
            ->addMonths($this->frecuencia_meses ?: 6)
            ->format('Y-m-d');
    }

    /**
     * Busca el equipo por serie y, si no la tiene, por codigo de
     * inventario. En el seguimiento real 26 de 149 filas vienen sin serie,
     * asi que hacer falta el segundo intento.
     */
    public static function buscarPor(?string $serie, ?string $inventario): ?self
    {
        if ($serie) {
            $porSerie = static::where('serie', $serie)->first();
            if ($porSerie) {
                return $porSerie;
            }
        }

        if ($inventario) {
            return static::where('inventario', $inventario)->first();
        }

        return null;
    }
}
