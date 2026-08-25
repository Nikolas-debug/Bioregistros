<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RegistroSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Importacion masiva de un seguimiento mensual.
 *
 * Los encabezados que reconoce salen de los archivos reales de la clinica
 * (SEGUIMIENTO ENERO ... JULIO 2026): FECHA, REPORTE, EQUIPO, MARCA,
 * MODELO, SERIE, SERVICIO, UBICACION, INVENTARIO, PREVENTIVO, CORRECTIVO,
 * OTRO, DESCRIPCION, OBSERVACIONES, ESTADO, REPUESTOS.
 *
 * Tres cosas que traen esos archivos y que aqui se resuelven, igual que en
 * src/utils/excelImport.ts del lado de la PWA:
 *
 *  1. El encabezado no siempre esta en la fila 1: enero, febrero y marzo
 *     abren con un titulo ("INFORME DE GESTION Y SEGUIMIENTO"). Se busca
 *     entre las primeras filas la que mas se parezca a un encabezado.
 *  2. Hay columnas con el titulo borrado (SERIE en febrero, INVENTARIO en
 *     abril). Una columna sin titulo que cae en la posicion que ese campo
 *     ocupa en el formato de la clinica se rescata.
 *  3. Cuando varias filas son del mismo dia, la fecha solo se escribe en
 *     la primera. Las siguientes heredan la de arriba en vez de perderse.
 *
 * Requiere:  composer require phpoffice/phpspreadsheet
 */
class ImportacionController extends Controller
{
    /**
     * Encabezado normalizado -> llave interna.
     * La comparacion ignora mayusculas, tildes, espacios dobles y numeros
     * pegados (el archivo real trae "  INVENTARIO1532000224").
     */
    private const COLUMNAS = [
        'fecha'              => 'fecha',
        'reporte'            => 'numero_reporte',
        'no reporte'         => 'numero_reporte',
        'numero reporte'     => 'numero_reporte',
        'equipo'             => 'equipo',
        'marca'              => 'marca',
        'modelo'             => 'modelo',
        'serie'              => 'serie',
        'n serie'            => 'serie',
        'numero de serie'    => 'serie',
        'servicio'           => 'servicio',
        'ubicacion'          => 'ubicacion',
        'inventario'         => 'inventario',
        'codigo inventario'  => 'inventario',
        'preventivo'         => 'preventivo',
        'correctivo'         => 'correctivo',
        'otro'               => 'otro',
        'descripcion'        => 'descripcion',
        'observaciones'      => 'observaciones',
        'estado'             => 'estado',
        'repuestos'          => 'repuestos',
        'tecnico'            => 'tecnico',
        'responsable'        => 'tecnico',
        'hora'               => 'hora',
    ];

    /** Columnas que el archivo trae vacias siempre y no aportan nada. */
    private const IGNORADAS = ['registro', 'clase'];

    /**
     * El orden de columnas del seguimiento de la clinica, tal cual.
     * Solo se usa para rescatar una columna cuyo titulo quedo en blanco.
     * Debe coincidir con ORDEN_CANONICO de src/utils/excelImport.ts.
     */
    private const ORDEN_CANONICO = [
        0  => 'fecha',
        1  => 'numero_reporte',
        2  => 'equipo',
        3  => 'marca',
        4  => 'modelo',
        5  => 'serie',
        6  => 'servicio',
        7  => 'ubicacion',
        8  => 'inventario',
        // 9 REGISTRO y 10 CLASE van siempre vacias
        11 => 'preventivo',
        12 => 'correctivo',
        13 => 'otro',
        14 => 'descripcion',
        15 => 'observaciones',
        16 => 'estado',
        17 => 'repuestos',
    ];

    /** Cuantas filas del principio se revisan buscando el encabezado. */
    private const FILAS_A_REVISAR = 15;

    public function __construct(private RegistroSyncService $servicio) {}

    /**
     * POST /api/importar/excel
     * multipart/form-data: archivo=<.xlsx|.xls|.csv>, simular=1 (opcional)
     */
    public function excel(Request $request): JsonResponse
    {
        $request->validate([
            'archivo' => ['required', 'file', 'mimes:xlsx,xls,csv,txt', 'max:20480'],
        ], [
            'archivo.required' => 'Adjunte el archivo de seguimiento.',
            'archivo.mimes'    => 'El archivo debe ser .xlsx, .xls o .csv',
            'archivo.max'      => 'El archivo no puede superar 20 MB.',
        ]);

        $simular = $request->boolean('simular');

        try {
            $hoja = IOFactory::load($request->file('archivo')->getRealPath())->getActiveSheet();
        } catch (\Throwable $e) {
            return response()->json([
                'mensaje' => 'No se pudo leer el archivo. Verifique que sea un Excel valido.',
                'detalle' => $e->getMessage(),
            ], 422);
        }

        // formatData en false devuelve las fechas como el numero de serie
        // de Excel en vez de un texto que depende del idioma del equipo.
        // RegistroSyncService::fecha() sabe interpretarlo.
        $filas = $hoja->toArray(null, true, false, false);

        if (count($filas) < 2) {
            return response()->json([
                'mensaje' => 'El archivo no tiene filas de datos debajo del encabezado.',
            ], 422);
        }

        /* --- 1. Encabezados --- */
        // La fila de titulos no siempre es la primera.
        [$filaEncabezado, $mapa, $noReconocidas] = $this->buscarEncabezado($filas);

        // Columnas sin titulo que caen en su posicion canonica.
        $porPosicion = $this->completarPorPosicion($mapa, $this->ancho($filas));

        $detectadas = array_values($mapa);
        $faltantes = array_diff(['equipo', 'fecha'], $detectadas);

        if ($faltantes) {
            return response()->json([
                'mensaje'   => 'No se reconocio el encabezado del seguimiento: falta '
                    . implode(' y ', array_map(fn ($f) => strtoupper($f), $faltantes))
                    . '. Revise que la hoja tenga la fila de titulos (FECHA, REPORTE, EQUIPO...).',
                'esperadas' => array_values(array_unique(self::COLUMNAS)),
                'recibidas' => array_values(array_filter($filas[$filaEncabezado] ?? [])),
            ], 422);
        }

        // Las filas de datos son las que van debajo del encabezado.
        $datos = array_slice($filas, $filaEncabezado + 1, null, true);

        /* --- 2. Fila por fila --- */
        $importados = [];
        $errores = [];
        $advertencias = [];
        $vistaPrevia = [];
        $reportesVistos = [];
        $procesadas = 0;

        // La fecha de la ultima fila que si la traia.
        $fechaArrastrada = null;
        $fechasHeredadas = 0;

        foreach ($datos as $numero => $fila) {
            $numeroExcel = $numero + 1;

            if ($this->filaVacia($fila)) {
                continue;
            }

            $procesadas++;

            $registro = [];
            foreach ($mapa as $indice => $campo) {
                $registro[$campo] = $fila[$indice] ?? null;
            }

            /* --- Arrastre de la fecha ---
            | En el seguimiento, una celda de fecha vacia significa "el
            | mismo dia de la fila de arriba". Sin esto se perdian 17 de
            | las 106 filas de marzo.
            */
            $fechaCruda = $registro['fecha'] ?? null;
            $vacia = $fechaCruda === null
                || (! $fechaCruda instanceof \DateTimeInterface && trim((string) $fechaCruda) === '');

            if ($vacia) {
                if ($fechaArrastrada !== null) {
                    $registro['fecha'] = $fechaArrastrada;
                    $fechasHeredadas++;
                    $advertencias[] = [
                        'fila'   => $numeroExcel,
                        'aviso'  => "Sin fecha propia: se tomo la del {$fechaArrastrada}, de la fila anterior.",
                    ];
                }
            } else {
                $normalizada = $this->servicio->normalizar($registro)['fecha'] ?? null;
                if ($normalizada) {
                    $fechaArrastrada = $normalizada;
                }
            }

            // Un reporte repetido dentro del mismo archivo casi siempre es
            // un error de digitacion, y dejarlo pasar romperia la
            // numeracion. Se detiene la fila, no el archivo entero.
            $rep = $registro['numero_reporte'] ?? null;
            if (is_numeric($rep)) {
                $rep = (int) $rep;
                if (isset($reportesVistos[$rep])) {
                    $errores[] = [
                        'fila'    => $numeroExcel,
                        'equipo'  => (string) ($registro['equipo'] ?? ''),
                        'errores' => ["El reporte {$rep} ya aparece en la fila {$reportesVistos[$rep]}."],
                    ];
                    continue;
                }
                $reportesVistos[$rep] = $numeroExcel;
            }

            try {
                if ($simular) {
                    $vistaPrevia[] = ['fila' => $numeroExcel]
                        + $this->servicio->normalizar($registro);
                    continue;
                }

                $mantenimiento = $this->servicio->guardar($registro, 'excel');
                $importados[] = $mantenimiento->numero_reporte;
            } catch (ValidationException $e) {
                $errores[] = [
                    'fila'    => $numeroExcel,
                    'equipo'  => (string) ($registro['equipo'] ?? '(sin nombre)'),
                    'errores' => collect($e->errors())->flatten()->all(),
                ];
            } catch (\Throwable $e) {
                $errores[] = [
                    'fila'    => $numeroExcel,
                    'equipo'  => (string) ($registro['equipo'] ?? '(sin nombre)'),
                    'errores' => [$e->getMessage()],
                ];
            }
        }

        return response()->json([
            'simulacion'            => $simular,
            'fila_encabezado'       => $filaEncabezado + 1,
            'columnas_detectadas'   => $detectadas,
            'columnas_ignoradas'    => $noReconocidas,
            'columnas_por_posicion' => $porPosicion,
            'fechas_heredadas'      => $fechasHeredadas,
            'filas_procesadas'      => $procesadas,
            'importados'            => count($importados),
            'reportes'              => $importados,
            'errores'               => $errores,
            'advertencias'          => array_slice($advertencias, 0, 200),
            'vista_previa'          => array_slice($vistaPrevia, 0, 100),
            'mensaje'               => $simular
                ? 'Revision completada. Ningun dato fue guardado todavia.'
                : sprintf('Se importaron %d registros. %d filas con error.', count($importados), count($errores)),
        ], count($errores) > 0 ? 207 : 200);
    }

    /**
     * GET /api/importar/plantilla
     * Excel vacio con los encabezados del seguimiento.
     */
    public function plantilla(): StreamedResponse
    {
        $encabezados = [
            'FECHA', 'REPORTE', 'EQUIPO', 'MARCA', 'MODELO', 'SERIE',
            'SERVICIO', 'UBICACION', 'INVENTARIO',
            'PREVENTIVO', 'CORRECTIVO', 'OTRO',
            'DESCRIPCION', 'OBSERVACIONES', 'ESTADO', 'REPUESTOS',
        ];

        $ejemplo = [
            date('Y-m-d'), '', 'INCUBADORA ABIERTA', 'DAVID MEDICAL', 'HKN-90',
            '21090201003', 'UCI NEONATAL', 'PISO 2', '15320000224',
            '', 'X', '', 'CONECTOR AC Y SUICHE ABIERTOS',
            'CAMBIO DE SUICHE Y CONECTOR AC', 'FUNCIONAL', '',
        ];

        $libro = new Spreadsheet();
        $hoja = $libro->getActiveSheet();
        $hoja->setTitle('Seguimiento');

        $hoja->fromArray($encabezados, null, 'A1');
        $hoja->fromArray($ejemplo, null, 'A2');

        $ultima = $hoja->getHighestColumn();
        $hoja->getStyle("A1:{$ultima}1")->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
        $hoja->getStyle("A1:{$ultima}1")->getFill()
            ->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF0052CC');
        $hoja->getStyle("A1:{$ultima}1")->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER)->setWrapText(true);
        $hoja->getRowDimension(1)->setRowHeight(30);
        $hoja->freezePane('A2');

        foreach (range('A', $ultima) as $columna) {
            $hoja->getColumnDimension($columna)->setWidth(22);
        }

        $ayuda = $libro->createSheet();
        $ayuda->setTitle('Como llenarlo');
        $ayuda->fromArray([
            ['Columna', 'Que va ahi'],
            ['FECHA', 'AAAA-MM-DD o DD/MM/AAAA. Obligatoria.'],
            ['REPORTE', 'El consecutivo del seguimiento. Si lo deja vacio, el sistema asigna el siguiente libre. Si lo escribe y ese numero ya existe, la fila se rechaza en vez de pisar el registro anterior.'],
            ['EQUIPO', 'Nombre del equipo. Obligatoria.'],
            ['SERIE', 'Identifica el equipo. Si va vacia se usa INVENTARIO; si tampoco hay, se crea un equipo nuevo.'],
            ['PREVENTIVO / CORRECTIVO / OTRO', 'Marque con X la que corresponda. Puede marcar mas de una. Si no marca ninguna, la fila queda como OTRO.'],
            ['ESTADO', 'Texto libre: FUNCIONAL, EN ESPERA DE REPUESTOS, o lo que aplique.'],
            ['SERVICIO / UBICACION', 'Texto libre, como lo escriban en el seguimiento.'],
        ], null, 'A1');
        $ayuda->getStyle('A1:B1')->getFont()->setBold(true);
        $ayuda->getColumnDimension('A')->setWidth(32);
        $ayuda->getColumnDimension('B')->setWidth(90);
        $ayuda->getStyle('B1:B20')->getAlignment()->setWrapText(true);

        $libro->setActiveSheetIndex(0);

        return response()->streamDownload(function () use ($libro) {
            (new Xlsx($libro))->save('php://output');
        }, 'Plantilla_Seguimiento.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /* ------------------------------------------------------------------ */
    /* Encabezado                                                          */
    /* ------------------------------------------------------------------ */

    /**
     * Mapea una fila como si fuera el encabezado.
     *
     * @return array{0: array<int,string>, 1: array<int,string>}
     */
    private function mapearFila(array $fila): array
    {
        $mapa = [];
        $noReconocidas = [];

        foreach ($fila as $indice => $titulo) {
            $clave = $this->normalizarTitulo((string) $titulo);

            if ($clave === '' || in_array($clave, self::IGNORADAS, true)) {
                continue;
            }

            if (isset(self::COLUMNAS[$clave])) {
                // El primer titulo gana: si el archivo repite FECHA al
                // final, la columna buena sigue siendo la de la izquierda.
                if (! in_array(self::COLUMNAS[$clave], $mapa, true)) {
                    $mapa[$indice] = self::COLUMNAS[$clave];
                }
            } else {
                $noReconocidas[] = trim((string) $titulo);
            }
        }

        return [$mapa, $noReconocidas];
    }

    /**
     * Busca entre las primeras filas la que hace de encabezado.
     *
     * Gana la que reconozca mas columnas del seguimiento; tener EQUIPO y
     * FECHA a la vez pesa mas que cualquier otra cosa.
     *
     * @return array{0: int, 1: array<int,string>, 2: array<int,string>}
     */
    private function buscarEncabezado(array $filas): array
    {
        $mejor = [0, [], []];
        $mejorPuntaje = -1;

        $indices = array_slice(array_keys($filas), 0, self::FILAS_A_REVISAR);

        foreach ($indices as $i) {
            [$mapa, $noReconocidas] = $this->mapearFila($filas[$i] ?? []);
            $campos = array_unique($mapa);

            $puntaje = count($campos);
            if (in_array('equipo', $campos, true) && in_array('fecha', $campos, true)) {
                $puntaje += 10;
            }

            if ($puntaje > $mejorPuntaje) {
                $mejorPuntaje = $puntaje;
                $mejor = [$i, $mapa, $noReconocidas];
            }
        }

        return $mejor;
    }

    /**
     * Rescata columnas cuyo titulo quedo en blanco.
     *
     * En febrero la celda del titulo de SERIE esta vacia y la columna trae
     * las series igual; en abril pasa lo mismo con INVENTARIO.
     *
     * @param  array<int,string>  $mapa  se modifica en sitio
     * @return array<int,array{columna:string,campo:string}>
     */
    private function completarPorPosicion(array &$mapa, int $ancho): array
    {
        $usados = array_values($mapa);
        $rescatadas = [];

        foreach (self::ORDEN_CANONICO as $indice => $campo) {
            if ($indice >= $ancho || isset($mapa[$indice]) || in_array($campo, $usados, true)) {
                continue;
            }

            $mapa[$indice] = $campo;
            $usados[] = $campo;
            $rescatadas[] = [
                'columna' => $this->letraColumna($indice),
                'campo'   => strtoupper($campo),
            ];
        }

        ksort($mapa);

        return $rescatadas;
    }

    /** El ancho real de la hoja, en columnas. */
    private function ancho(array $filas): int
    {
        $ancho = 0;
        foreach ($filas as $fila) {
            $ancho = max($ancho, is_array($fila) ? count($fila) : 0);
        }

        return $ancho;
    }

    /** 0 -> "A", 5 -> "F", 26 -> "AA". */
    private function letraColumna(int $indice): string
    {
        $letras = '';
        $n = $indice;

        do {
            $letras = chr(65 + ($n % 26)) . $letras;
            $n = intdiv($n, 26) - 1;
        } while ($n >= 0);

        return $letras;
    }

    /**
     * Quita tildes, mayusculas, simbolos, espacios dobles y los numeros
     * pegados al final del titulo.
     */
    private function normalizarTitulo(string $titulo): string
    {
        $titulo = mb_strtolower(trim($titulo));
        $titulo = strtr($titulo, [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u',
            'ñ' => 'n', 'ü' => 'u', '°' => '', 'º' => '',
        ]);
        $titulo = preg_replace('/[^a-z0-9 ]/', ' ', $titulo);
        $titulo = trim(preg_replace('/\s+/', ' ', $titulo));

        // "inventario1532000224" -> "inventario"
        $titulo = preg_replace('/^([a-z ]+?)\s*\d+$/', '$1', $titulo);

        return trim($titulo);
    }

    private function filaVacia(array $fila): bool
    {
        foreach ($fila as $celda) {
            if ($celda instanceof \DateTimeInterface) {
                return false;
            }
            if ($celda !== null && trim((string) $celda) !== '') {
                return false;
            }
        }

        return true;
    }
}
