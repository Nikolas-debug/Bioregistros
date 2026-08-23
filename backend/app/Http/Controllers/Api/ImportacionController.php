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
 * Los encabezados que reconoce salen del archivo real
 * "SEGUIMIENTO MAYO 2026": FECHA, REPORTE, EQUIPO, MARCA, MODELO, SERIE,
 * SERVICIO, UBICACION, INVENTARIO, PREVENTIVO, CORRECTIVO, OTRO,
 * DESCRIPCION, OBSERVACIONES, ESTADO, REPUESTOS.
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
        $encabezado = array_shift($filas);
        $mapa = [];
        $noReconocidas = [];

        foreach ($encabezado as $indice => $titulo) {
            $clave = $this->normalizarTitulo((string) $titulo);

            if ($clave === '' || in_array($clave, self::IGNORADAS, true)) {
                continue;
            }

            if (isset(self::COLUMNAS[$clave])) {
                $mapa[$indice] = self::COLUMNAS[$clave];
            } else {
                $noReconocidas[] = trim((string) $titulo);
            }
        }

        $detectadas = array_values($mapa);
        $faltantes = array_diff(['equipo', 'fecha'], $detectadas);

        if ($faltantes) {
            return response()->json([
                'mensaje'   => 'Al archivo le faltan columnas obligatorias: '
                    . implode(', ', array_map(fn ($f) => strtoupper($f), $faltantes)),
                'esperadas' => array_values(array_unique(self::COLUMNAS)),
                'recibidas' => array_values(array_filter($encabezado)),
            ], 422);
        }

        /* --- 2. Fila por fila --- */
        $importados = [];
        $errores = [];
        $vistaPrevia = [];
        $reportesVistos = [];

        foreach ($filas as $numero => $fila) {
            $numeroExcel = $numero + 2;

            if ($this->filaVacia($fila)) {
                continue;
            }

            $registro = [];
            foreach ($mapa as $indice => $campo) {
                $registro[$campo] = $fila[$indice] ?? null;
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
            'simulacion'          => $simular,
            'columnas_detectadas' => $detectadas,
            'columnas_ignoradas'  => $noReconocidas,
            'filas_procesadas'    => count($filas),
            'importados'          => count($importados),
            'reportes'            => $importados,
            'errores'             => $errores,
            'vista_previa'        => array_slice($vistaPrevia, 0, 100),
            'mensaje'             => $simular
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
