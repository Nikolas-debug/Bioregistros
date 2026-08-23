/**
 * Lectura de un seguimiento mensual en Excel, dentro del navegador.
 *
 * Se hace del lado del cliente para que el técnico pueda cargar un archivo
 * estando sin conexión: las filas quedan en IndexedDB y suben cuando haya
 * red. El backend acepta exactamente los mismos encabezados.
 *
 * El mapa de columnas sale del archivo real de la clínica, no de un formato
 * inventado. Por eso tolera dobles espacios, tildes, mayúsculas y hasta un
 * encabezado como "  INVENTARIO1532000224".
 */

import * as XLSX from 'xlsx';
import { FilaImportada, MaintenanceRecord } from '../types';
import { nuevoUuid } from '../db/indexedDB';

/* ------------------------------------------------------------------ */
/*  Mapa de encabezados                                                */
/*  Debe coincidir con ImportacionController::COLUMNAS del backend.     */
/* ------------------------------------------------------------------ */

type Campo =
  | 'numeroReporte' | 'date' | 'equipment' | 'brand' | 'model'
  | 'serialNumber' | 'service' | 'specificLocation' | 'inventoryCode'
  | 'preventivo' | 'correctivo' | 'otro'
  | 'failureComments' | 'additionalObservations' | 'finalStatus'
  | 'spareParts' | 'technicianName' | 'time';

const COLUMNAS: Record<string, Campo> = {
  fecha: 'date',
  reporte: 'numeroReporte',
  'no reporte': 'numeroReporte',
  'numero reporte': 'numeroReporte',
  equipo: 'equipment',
  marca: 'brand',
  modelo: 'model',
  serie: 'serialNumber',
  'n serie': 'serialNumber',
  'numero de serie': 'serialNumber',
  servicio: 'service',
  ubicacion: 'specificLocation',
  inventario: 'inventoryCode',
  'codigo inventario': 'inventoryCode',
  preventivo: 'preventivo',
  correctivo: 'correctivo',
  otro: 'otro',
  descripcion: 'failureComments',
  observaciones: 'additionalObservations',
  estado: 'finalStatus',
  repuestos: 'spareParts',
  tecnico: 'technicianName',
  responsable: 'technicianName',
  hora: 'time',
};

/** Columnas que el seguimiento trae siempre vacías. */
const IGNORADAS = ['registro', 'clase'];

/** Sin estas dos la fila no sirve. */
const OBLIGATORIAS: Campo[] = ['equipment', 'date'];

/* ------------------------------------------------------------------ */
/*  Normalizadores                                                     */
/* ------------------------------------------------------------------ */

/** Quita tildes, mayúsculas, símbolos, espacios dobles y números pegados. */
export function normalizarTitulo(titulo: any): string {
  let t = String(titulo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // "inventario1532000224" -> "inventario"
  t = t.replace(/^([a-z ]+?)\s*\d+$/, '$1').trim();

  return t;
}

/** Acepta Date, serial de Excel, AAAA-MM-DD y DD/MM/AAAA. */
export function normalizarFecha(valor: any): string | null {
  if (valor === null || valor === undefined || valor === '') return null;

  if (valor instanceof Date && !isNaN(valor.getTime())) return aISO(valor);

  // Serial de Excel: días desde 1899-12-30.
  if (typeof valor === 'number' && valor > 20000 && valor < 60000) {
    return aISO(new Date(Date.UTC(1899, 11, 30) + valor * 86400000));
  }

  const texto = String(valor).trim();

  let m = texto.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

  // DD/MM/AAAA: formato colombiano, día primero.
  m = texto.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    let anio = m[3];
    if (anio.length === 2) anio = `20${anio}`;
    const dia = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10);
    if (dia > 31 || mes > 12 || dia < 1 || mes < 1) return null;
    return `${anio}-${pad(mes)}-${pad(dia)}`;
  }

  const intento = new Date(texto);
  return isNaN(intento.getTime()) ? null : aISO(intento);
}

export function normalizarHora(valor: any): string | undefined {
  if (valor === null || valor === undefined || valor === '') return undefined;

  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return `${pad(valor.getUTCHours())}:${pad(valor.getUTCMinutes())}`;
  }

  // Fracción de día de Excel (0.5 = 12:00).
  if (typeof valor === 'number' && valor > 0 && valor < 1) {
    const segundos = Math.round(valor * 86400);
    return `${pad(Math.floor(segundos / 3600))}:${pad(Math.floor((segundos % 3600) / 60))}`;
  }

  const m = String(valor).match(/(\d{1,2}):(\d{2})/);
  return m ? `${pad(m[1])}:${pad(m[2])}` : undefined;
}

/** Reconoce X, x, SÍ, 1, true... como casilla marcada. */
export function estaMarcada(valor: any): boolean {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === 'boolean') return valor;

  const v = String(valor).trim().toLowerCase();
  return ['x', 'si', 'sí', '1', 'true', 'v', 'ok'].includes(v);
}

const pad = (n: string | number) => String(n).padStart(2, '0');
const aISO = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Los seguimientos vienen con dobles espacios por todas partes. */
const texto = (valor: any): string =>
  valor === null || valor === undefined
    ? ''
    : String(valor).replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ */
/*  Lectura del archivo                                                */
/* ------------------------------------------------------------------ */

export interface ResultadoLectura {
  filas: FilaImportada[];
  columnasDetectadas: string[];
  columnasIgnoradas: string[];
  totalFilas: number;
  validas: number;
  conError: number;
  duplicadas: number;
  hojas: string[];
  hojaLeida: string;
  /** Rango de reportes que trae el archivo, si los trae. */
  reporteMin?: number;
  reporteMax?: number;
  /** Números que faltan dentro de ese rango. */
  reportesFaltantes: number[];
}

export async function leerExcel(
  archivo: File,
  opciones: {
    reportesExistentes?: Set<number>;
    tecnicoPorDefecto?: string;
    nombreHoja?: string;
  } = {},
): Promise<ResultadoLectura> {
  const buffer = await archivo.arrayBuffer();
  const libro = XLSX.read(buffer, { type: 'array', cellDates: true });

  if (!libro.SheetNames.length) {
    throw new Error('El archivo no contiene ninguna hoja de cálculo.');
  }

  const nombreHoja = opciones.nombreHoja || libro.SheetNames[0];
  const hoja = libro.Sheets[nombreHoja];

  if (!hoja) {
    throw new Error(`No se encontró la hoja "${nombreHoja}" en el archivo.`);
  }

  const matriz: any[][] = XLSX.utils.sheet_to_json(hoja, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: true,
  });

  if (matriz.length < 2) {
    throw new Error('El archivo no tiene filas de datos debajo del encabezado.');
  }

  /* --- 1. Encabezados --- */
  const mapa = new Map<number, Campo>();
  const columnasIgnoradas: string[] = [];

  matriz[0].forEach((titulo: any, indice: number) => {
    const clave = normalizarTitulo(titulo);
    if (!clave || IGNORADAS.includes(clave)) return;

    const campo = COLUMNAS[clave];
    if (campo) {
      mapa.set(indice, campo);
    } else {
      columnasIgnoradas.push(texto(titulo));
    }
  });

  const detectadas = [...new Set(mapa.values())];
  const faltantes = OBLIGATORIAS.filter((c) => !detectadas.includes(c));

  if (faltantes.length) {
    const nombres = faltantes.map((f) => (f === 'equipment' ? 'EQUIPO' : 'FECHA'));
    throw new Error(
      `Al archivo le faltan columnas obligatorias: ${nombres.join(', ')}. ` +
        'Descargue la plantilla para ver el formato esperado.',
    );
  }

  /* --- 2. Filas --- */
  const reportesExistentes = opciones.reportesExistentes ?? new Set<number>();
  const reportesDelArchivo = new Map<number, number>();   // numero -> fila
  const filas: FilaImportada[] = [];
  const ahora = Date.now();
  const hoy = aISO(new Date());

  for (let i = 1; i < matriz.length; i++) {
    const fila = matriz[i];
    const numeroExcel = i + 1;

    if (filaVacia(fila)) continue;

    const bruto: Partial<Record<Campo, any>> = {};
    mapa.forEach((campo, indice) => {
      bruto[campo] = fila[indice];
    });

    const errores: string[] = [];
    const advertencias: string[] = [];

    const equipo = texto(bruto.equipment);
    if (!equipo) errores.push('Falta el nombre del equipo.');

    const fecha = normalizarFecha(bruto.date);
    if (!fecha) {
      errores.push(
        `La fecha "${texto(bruto.date)}" no se entiende. Use AAAA-MM-DD o DD/MM/AAAA.`,
      );
    } else if (fecha > hoy) {
      advertencias.push('La fecha es futura.');
    }

    /* --- Número de reporte --- */
    let numeroReporte: number | undefined;
    let duplicado = false;

    const repBruto = bruto.numeroReporte;
    if (repBruto !== undefined && texto(repBruto) !== '') {
      const n = Number(String(repBruto).replace(/\D/g, ''));

      if (!Number.isFinite(n) || n <= 0) {
        errores.push(`El reporte "${texto(repBruto)}" no es un número válido.`);
      } else {
        numeroReporte = n;

        const filaPrevia = reportesDelArchivo.get(n);
        if (filaPrevia) {
          duplicado = true;
          errores.push(`El reporte ${n} ya aparece en la fila ${filaPrevia} de este archivo.`);
        } else if (reportesExistentes.has(n)) {
          duplicado = true;
          advertencias.push(`El reporte ${n} ya existe; se actualizará en vez de crearse.`);
        }

        reportesDelArchivo.set(n, numeroExcel);
      }
    } else {
      advertencias.push('Sin número de reporte: el servidor le asignará el siguiente libre.');
    }

    /* --- Las tres casillas --- */
    let preventivo = estaMarcada(bruto.preventivo);
    let correctivo = estaMarcada(bruto.correctivo);
    let otro = estaMarcada(bruto.otro);

    if (!preventivo && !correctivo && !otro) {
      otro = true;
      advertencias.push('Sin casilla marcada: queda clasificado como Otro.');
    }

    const serie = texto(bruto.serialNumber);
    const inventario = texto(bruto.inventoryCode);

    if (!serie && !inventario) {
      advertencias.push('Sin serie ni inventario: se creará un equipo nuevo.');
    }

    const registro: MaintenanceRecord = {
      id: nuevoUuid(),
      numeroReporte,
      equipment: equipo,
      brand: texto(bruto.brand),
      model: texto(bruto.model),
      serialNumber: serie,
      inventoryCode: inventario,
      service: texto(bruto.service),
      specificLocation: texto(bruto.specificLocation),
      date: fecha || '',
      time: normalizarHora(bruto.time),
      preventivo,
      correctivo,
      otro,
      failureComments: texto(bruto.failureComments),
      additionalObservations: texto(bruto.additionalObservations),
      finalStatus: texto(bruto.finalStatus),
      spareParts: texto(bruto.spareParts),
      technicianName: texto(bruto.technicianName) || opciones.tecnicoPorDefecto || '',
      createdAt: ahora,
      updatedAt: ahora,
      syncState: 'pending',
      origen: 'excel',
    };

    filas.push({ fila: numeroExcel, registro, errores, advertencias, duplicado });
  }

  /* --- 3. Continuidad de los reportes --- */
  const numeros = [...reportesDelArchivo.keys()].sort((a, b) => a - b);
  const reportesFaltantes: number[] = [];

  if (numeros.length > 1) {
    const presentes = new Set(numeros);
    for (let n = numeros[0]; n <= numeros[numeros.length - 1]; n++) {
      if (!presentes.has(n)) reportesFaltantes.push(n);
    }
  }

  return {
    filas,
    columnasDetectadas: detectadas,
    columnasIgnoradas,
    totalFilas: filas.length,
    validas: filas.filter((f) => f.errores.length === 0).length,
    conError: filas.filter((f) => f.errores.length > 0).length,
    duplicadas: filas.filter((f) => f.duplicado).length,
    hojas: libro.SheetNames,
    hojaLeida: nombreHoja,
    reporteMin: numeros[0],
    reporteMax: numeros[numeros.length - 1],
    reportesFaltantes,
  };
}

/* ------------------------------------------------------------------ */
/*  Plantilla descargable (funciona sin conexión)                      */
/* ------------------------------------------------------------------ */

export function descargarPlantilla(): void {
  const encabezados = [
    'FECHA', 'REPORTE', 'EQUIPO', 'MARCA', 'MODELO', 'SERIE',
    'SERVICIO', 'UBICACION', 'INVENTARIO',
    'PREVENTIVO', 'CORRECTIVO', 'OTRO',
    'DESCRIPCION', 'OBSERVACIONES', 'ESTADO', 'REPUESTOS',
  ];

  const ejemplo = [
    new Date().toISOString().split('T')[0], '', 'INCUBADORA ABIERTA',
    'DAVID MEDICAL', 'HKN-90', '21090201003', 'UCI NEONATAL', 'PISO 2',
    '15320000224', '', 'X', '', 'CONECTOR AC Y SUICHE ABIERTOS',
    'CAMBIO DE SUICHE Y CONECTOR AC', 'FUNCIONAL', '',
  ];

  const libro = XLSX.utils.book_new();

  const hoja = XLSX.utils.aoa_to_sheet([encabezados, ejemplo]);
  hoja['!cols'] = encabezados.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(libro, hoja, 'Seguimiento');

  const ayuda = XLSX.utils.aoa_to_sheet([
    ['Columna', 'Qué va ahí'],
    ['FECHA', 'AAAA-MM-DD o DD/MM/AAAA. Obligatoria.'],
    ['REPORTE', 'El consecutivo del seguimiento. Si lo deja vacío, el servidor asigna el siguiente libre. Si lo escribe y ese número ya existe, la fila se rechaza en vez de pisar el registro anterior.'],
    ['EQUIPO', 'Nombre del equipo. Obligatoria.'],
    ['SERIE', 'Identifica el equipo. Si va vacía se usa INVENTARIO; si tampoco hay, se crea un equipo nuevo.'],
    ['PREVENTIVO / CORRECTIVO / OTRO', 'Marque con X la que corresponda. Puede marcar más de una. Si no marca ninguna, la fila queda como OTRO.'],
    ['ESTADO', 'Texto libre: FUNCIONAL, EN ESPERA DE REPUESTOS, o lo que aplique.'],
    ['SERVICIO / UBICACION', 'Texto libre, tal como lo escriban en el seguimiento.'],
    ['', ''],
    ['Nota', 'Las columnas REGISTRO y CLASE del formato antiguo se ignoran: vienen siempre vacías.'],
  ]);
  ayuda['!cols'] = [{ wch: 32 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(libro, ayuda, 'Cómo llenarlo');

  XLSX.writeFile(libro, 'Plantilla_Seguimiento.xlsx');
}

/* ------------------------------------------------------------------ */

function filaVacia(fila: any[]): boolean {
  return (
    !fila ||
    fila.every(
      (c) =>
        c === null ||
        c === undefined ||
        (!(c instanceof Date) && String(c).trim() === ''),
    )
  );
}
