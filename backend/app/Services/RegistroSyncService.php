<?php

namespace App\Services;

use App\Models\Dispositivo;
use App\Models\Mantenimiento;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Ramsey\Uuid\Uuid;
use Illuminate\Validation\ValidationException;

/**
 * Traduce una fila -venga de la PWA o de un Excel de seguimiento- al modelo
 * Dispositivo + Mantenimiento y la guarda de forma idempotente.
 *
 * Es el unico lugar donde se decide como se mapea cada campo, para que la
 * sincronizacion y la importacion masiva nunca se desalineen.
 */
class RegistroSyncService
{
    public function __construct(private NumeroReporteService $reportes) {}

    /**
     * Guarda una fila. Devuelve el mantenimiento persistido.
     *
     * @throws ValidationException
     */
    public function guardar(array $entrada, string $origen = 'app'): Mantenimiento
    {
        $datos = $this->normalizar($entrada);

        $validador = Validator::make($datos, [
            'uuid'           => ['required', 'uuid'],
            'equipo'         => ['required', 'string', 'max:200'],
            'fecha'          => ['required', 'date_format:Y-m-d'],
            'hora'           => ['nullable', 'date_format:H:i'],
            'serie'          => ['nullable', 'string', 'max:160'],
            'inventario'     => ['nullable', 'string', 'max:120'],
            'marca'          => ['nullable', 'string', 'max:160'],
            'modelo'         => ['nullable', 'string', 'max:160'],
            'servicio'       => ['nullable', 'string', 'max:160'],
            'ubicacion'      => ['nullable', 'string', 'max:180'],
            'estado'         => ['nullable', 'string', 'max:200'],
            'tecnico'        => ['nullable', 'string', 'max:180'],
            'numero_reporte' => ['nullable', 'integer', 'min:1'],
        ], [
            'required'    => 'Falta :attribute.',
            'date_format' => 'El campo :attribute no tiene el formato esperado.',
            'integer'     => 'El campo :attribute debe ser un numero.',
        ], [
            'equipo'         => 'el nombre del equipo',
            'fecha'          => 'la fecha',
            'numero_reporte' => 'el numero de reporte',
        ]);

        if ($validador->fails()) {
            throw new ValidationException($validador);
        }

        return DB::transaction(function () use ($datos, $origen) {

            // --- 1. El equipo ---
            $dispositivo = Dispositivo::buscarPor($datos['serie'], $datos['inventario']);

            $camposEquipo = array_filter([
                'serie'      => $datos['serie'],
                'inventario' => $datos['inventario'],
                'equipo'     => $datos['equipo'],
                'marca'      => $datos['marca'],
                'modelo'     => $datos['modelo'],
                'servicio'   => $datos['servicio'],
                'ubicacion'  => $datos['ubicacion'],
            ], fn ($v) => $v !== null && $v !== '');

            if ($dispositivo) {
                $dispositivo->fill($camposEquipo);
            } else {
                $dispositivo = new Dispositivo($camposEquipo);
            }

            // El estado y la fecha del ultimo mantenimiento solo avanzan.
            // Un registro viejo que llega tarde no debe hacer retroceder la
            // ficha del equipo.
            if (! $dispositivo->ultimo_mantenimiento
                || $dispositivo->ultimo_mantenimiento->format('Y-m-d') <= $datos['fecha']) {
                $dispositivo->estado = $datos['estado'];
                $dispositivo->ultimo_mantenimiento = $datos['fecha'];
            }

            $dispositivo->save();

            // --- 2. El mantenimiento ---
            $existente = Mantenimiento::where('uuid', $datos['uuid'])->first();

            // El numero de reporte se asigna una sola vez. Si el registro ya
            // existe conserva el suyo; si viene uno explicito (importacion
            // de un seguimiento historico) se respeta tal cual.
            $numero = $existente?->numero_reporte
                ?? $datos['numero_reporte']
                ?? $this->reportes->siguiente();

            // Si el numero explicito ya lo tiene otro registro, se avisa en
            // vez de pisarlo o de renumerar en silencio.
            if (! $existente && $datos['numero_reporte']) {
                $ocupado = Mantenimiento::where('numero_reporte', $datos['numero_reporte'])->exists();
                if ($ocupado) {
                    throw ValidationException::withMessages([
                        'numero_reporte' => [
                            "El reporte {$datos['numero_reporte']} ya existe en la base de datos.",
                        ],
                    ]);
                }
            }

            $mantenimiento = $existente ?? new Mantenimiento(['uuid' => $datos['uuid']]);

            $mantenimiento->fill([
                'numero_reporte'        => $numero,
                'dispositivo_id'        => $dispositivo->id,
                'fecha'                 => $datos['fecha'],
                'hora'                  => $datos['hora'],
                'preventivo'            => $datos['preventivo'],
                'correctivo'            => $datos['correctivo'],
                'otro'                  => $datos['otro'],
                'descripcion'           => $datos['descripcion'],
                'observaciones'         => $datos['observaciones'],
                'estado'                => $datos['estado'],
                'repuestos'             => $datos['repuestos'],
                'servicio'              => $datos['servicio'],
                'ubicacion'             => $datos['ubicacion'],
                'tecnico'               => $datos['tecnico'],
                'origen'                => $origen,
                'creado_en_dispositivo' => $datos['creado_en_dispositivo'],
                'sincronizado_en'       => now(),
            ]);

            $mantenimiento->save();

            return $mantenimiento;
        });
    }

    /**
     * Acepta el camelCase de la PWA, el snake_case de la base y los
     * encabezados en mayusculas del Excel de seguimiento.
     */
    public function normalizar(array $e): array
    {
        $tomar = fn (array $llaves) => collect($llaves)
            ->map(fn ($k) => $e[$k] ?? null)
            ->first(fn ($v) => $v !== null && $v !== '');

        $fecha = $this->fecha($tomar(['fecha', 'date', 'FECHA']));

        $creado = $tomar(['creado_en_dispositivo', 'createdAt']);
        if (is_numeric($creado)) {
            // La PWA manda milisegundos desde epoch. Se convierte a la zona
            // horaria de la aplicacion para que la columna se lea igual que
            // la hora del reloj de quien registro.
            $creado = Carbon::createFromTimestampMs((int) $creado)
                ->setTimezone(config('app.timezone'))
                ->toDateTimeString();
        }

        // Las tres casillas del seguimiento. Se aceptan tanto los booleanos
        // que manda la PWA como la "X" del Excel.
        $preventivo = $this->marcada($tomar(['preventivo', 'PREVENTIVO']));
        $correctivo = $this->marcada($tomar(['correctivo', 'CORRECTIVO']));
        $otro       = $this->marcada($tomar(['otro', 'OTRO']));

        // Si el origen manda un solo valor de clase, se traduce a casillas.
        $claseSuelta = $tomar(['clase', 'maintenanceType', 'CLASE']);
        if (! $preventivo && ! $correctivo && ! $otro && $claseSuelta) {
            $v = mb_strtolower((string) $claseSuelta);
            $preventivo = str_contains($v, 'prev');
            $correctivo = str_contains($v, 'corr');
            $otro       = ! $preventivo && ! $correctivo;
        }

        // Una fila sin ninguna marca queda como "Otro": en el seguimiento de
        // mayo hay tres asi, y descartarlas seria peor que clasificarlas.
        if (! $preventivo && ! $correctivo && ! $otro) {
            $otro = true;
        }

        $numero = $tomar(['numero_reporte', 'numeroReporte', 'REPORTE', 'reporte']);

        return [
            'uuid'                  => $this->uuid($e, $numero),
            'numero_reporte'        => is_numeric($numero) ? (int) $numero : null,
            'serie'                 => $this->limpiar($tomar(['serie', 'serialNumber', 'SERIE'])),
            'inventario'            => $this->limpiar($tomar(['inventario', 'inventoryCode', 'INVENTARIO'])),
            'equipo'                => $this->limpiar($tomar(['equipo', 'equipment', 'EQUIPO'])) ?? '',
            'marca'                 => $this->limpiar($tomar(['marca', 'brand', 'MARCA'])),
            'modelo'                => $this->limpiar($tomar(['modelo', 'model', 'MODELO'])),
            'servicio'              => $this->limpiar($tomar(['servicio', 'service', 'SERVICIO'])),
            'ubicacion'             => $this->limpiar($tomar([
                'ubicacion', 'specificLocation', 'UBICACION', 'UBICACIÓN',
            ])),
            'fecha'                 => $fecha,
            'hora'                  => $this->hora($tomar(['hora', 'time', 'HORA'])),
            'preventivo'            => $preventivo,
            'correctivo'            => $correctivo,
            'otro'                  => $otro,
            'descripcion'           => $this->limpiar($tomar([
                'descripcion', 'failureComments', 'DESCRIPCION', 'DESCRIPCIÓN',
            ])),
            'observaciones'         => $this->limpiar($tomar([
                'observaciones', 'additionalObservations', 'OBSERVACIONES',
            ])),
            'estado'                => $this->limpiar($tomar(['estado', 'finalStatus', 'ESTADO'])),
            'repuestos'             => $this->limpiar($tomar(['repuestos', 'spareParts', 'REPUESTOS'])),
            'tecnico'               => $this->limpiar($tomar([
                'tecnico', 'technicianName', 'TECNICO', 'TÉCNICO', 'RESPONSABLE',
            ])),
            'creado_en_dispositivo' => $creado,
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Ayudas de normalizacion                                             */
    /* ------------------------------------------------------------------ */

    /**
     * La clave de idempotencia.
     *
     * Si la fila trae uuid (viene de la PWA) se usa ese. Si no, pero trae
     * numero de reporte (viene de un Excel de seguimiento), se deriva un
     * uuid estable de ese numero: asi volver a importar el mismo archivo
     * actualiza las filas en vez de duplicarlas.
     */
    private function uuid(array $e, $numero): string
    {
        $recibido = $e['uuid'] ?? $e['idLocal'] ?? null;

        if ($recibido && Str::isUuid($recibido)) {
            return $recibido;
        }

        if (is_numeric($numero)) {
            // uuid5 es determinista: el mismo numero de reporte produce
            // siempre el mismo uuid, sin guardar nada intermedio.
            return Uuid::uuid5(Uuid::NAMESPACE_URL, 'seguimiento:reporte:' . (int) $numero)->toString();
        }

        return (string) Str::uuid();
    }

    private function limpiar($valor): ?string
    {
        if ($valor === null) {
            return null;
        }

        // Los seguimientos vienen con dobles espacios por todas partes.
        $valor = preg_replace('/\s+/u', ' ', trim((string) $valor));

        return $valor === '' ? null : $valor;
    }

    /** Reconoce X, x, SI, 1, true... como casilla marcada. */
    private function marcada($valor): bool
    {
        if ($valor === null) {
            return false;
        }
        if (is_bool($valor)) {
            return $valor;
        }

        $v = mb_strtolower(trim((string) $valor));

        return in_array($v, ['x', 'si', 'sí', '1', 'true', 'v', 'ok'], true);
    }

    /** Acepta serial de Excel, d/m/Y, Y-m-d y objetos de fecha. */
    private function fecha($valor): ?string
    {
        if ($valor === null || $valor === '') {
            return null;
        }

        if ($valor instanceof \DateTimeInterface) {
            return $valor->format('Y-m-d');
        }

        if (is_numeric($valor) && $valor > 20000 && $valor < 60000) {
            return Carbon::create(1899, 12, 30)->addDays((int) $valor)->format('Y-m-d');
        }

        $valor = trim((string) $valor);

        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y', 'Y/m/d', 'd/m/y'] as $formato) {
            try {
                $fecha = Carbon::createFromFormat($formato, $valor);
                if ($fecha && $fecha->format($formato) === $valor) {
                    return $fecha->format('Y-m-d');
                }
            } catch (\Throwable) {
                // sigue con el siguiente formato
            }
        }

        try {
            return Carbon::parse($valor)->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }

    private function hora($valor): ?string
    {
        if ($valor === null || $valor === '') {
            return null;
        }

        if ($valor instanceof \DateTimeInterface) {
            return $valor->format('H:i');
        }

        if (is_numeric($valor) && $valor < 1) {
            $segundos = (int) round($valor * 86400);

            return sprintf('%02d:%02d', intdiv($segundos, 3600), intdiv($segundos % 3600, 60));
        }

        if (preg_match('/(\d{1,2}):(\d{2})/', (string) $valor, $m)) {
            return sprintf('%02d:%02d', (int) $m[1], (int) $m[2]);
        }

        return null;
    }
}
