/**
 * Lectura de un seguimiento mensual en Excel, dentro del navegador.
 *
 * Se hace del lado del cliente para que el técnico pueda cargar un archivo
 * estando sin conexión: las filas quedan en IndexedDB y suben cuando haya
 * red. El backend acepta exactamente los mismos encabezados.
 *
 * El mapa de columnas sale de los archivos reales de la clínica
 * (SEGUIMIENTO ENERO … JULIO 2026), no de un formato inventado. Por eso:
 *
 *  1. El encabezado NO siempre está en la primera fila: enero, febrero y
 *     marzo empiezan con un título ("INFORME DE GESTION Y SEGUIMIENTO").
 *     Se busca la fila que más se parezca a un encabezado.
 *  2. Hay columnas con el título borrado: en febrero la de SERIE, en abril
 *     la de INVENTARIO. Si una columna sin título cae justo en la posición
 *     que le corresponde en el formato de la clínica, se rescata.
 *  3. Cuando varias filas comparten el mismo día, la fecha solo se escribe
 *     en la primera. Las siguientes heredan la fecha de arriba en vez de
 *     perderse.
 *  4. Las fechas vienen como 08.01.2026 (con puntos), como 08/01/2026 y
 *     como fecha de Excel. Las tres se leen en día/mes/año, que es como se
 *     escriben en Colombia.
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

/**
 * El orden de columnas del seguimiento de la clínica, tal cual.
 * Solo se usa para rescatar una columna cuyo título quedó en blanco: si la
 * columna F no tiene título y `serialNumber` todavía no aparece en ningún
 * lado, esa columna F es la de SERIE.
 */
const ORDEN_CANONICO: (Campo | null)[] = [
  'date',             // A  FECHA
  'numeroReporte',    // B  REPORTE
  'equipment',        // C  EQUIPO
  'brand',            // D  MARCA
  'model',            // E  MODELO
  'serialNumber',     // F  SERIE
  'service',          // G  SERVICIO
  'specificLocation', // H  UBICACIÓN
  'inventoryCode',    // I  INVENTARIO
  null,               // J  REGISTRO  (siempre vacía)
  null,               // K  CLASE     (siempre vacía)
  'preventivo',       // L
  'correctivo',       // M
  'otro',             // N
  'failureComments',  // O  DESCRIPCION
  'additionalObservations', // P  OBSERVACIONES
  'finalStatus',      // Q  ESTADO
  'spareParts',       // R  REPUESTOS
];

/** Cuántas filas del principio se revisan buscando el encabezado. */
const FILAS_A_REVISAR = 15;

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

/**
 * Acepta Date, serial de Excel, AAAA-MM-DD, DD/MM/AAAA y DD.MM.AAAA.
 *
 * Ojo con los puntos: `new Date("08.01.2026")` en Chrome devuelve el 1 de
 * AGOSTO, no el 8 de enero. Por eso el formato con puntos se resuelve aquí
 * a mano y nunca se le entrega al navegador un texto que empiece por
 * números.
 */
export function normalizarFecha(valor: any): string | null {
  if (valor === null || valor === undefined || valor === '') return null;

  if (valor instanceof Date && !isNaN(valor.getTime())) return aISO(valor);

  // Serial de Excel: días desde 1899-12-30.
  if (typeof valor === 'number' && valor > 20000 && valor < 60000) {
    return aISO(new Date(Date.UTC(1899, 11, 30) + valor * 86400000));
  }

  // El punto o la coma sobrantes al final ("17-07-2026.") son de teclear
  // rápido, no cambian la fecha.
  const texto = String(valor).trim().replace(/[.,;\s]+$/, '');

  // AAAA-MM-DD, AAAA/MM/DD, AAAA.MM.DD
  let m = texto.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    return fechaValida(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
  }

  // DD/MM/AAAA y DD.MM.AAAA: formato colombiano, día primero.
  m = texto.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,5})$/);
  if (m) {
    let anio = m[3];
    if (anio.length === 2) anio = `20${anio}`;

    // "18.02.20026": un cero de más al teclear el año. No existe otra
    // lectura posible, así que se corrige en vez de perder la fila.
    if (anio.length === 5 && anio.startsWith('200')) anio = `20${anio.slice(3)}`;
    if (anio.length !== 4) return null;

    return fechaValida(parseInt(anio, 10), parseInt(m[2], 10), parseInt(m[1], 10));
  }

  // Al navegador solo se le pasa lo que no empieza por número: así no hay
  // manera de que interprete 08.01.2026 al revés.
  if (/^\d/.test(texto)) return null;

  const intento = new Date(texto);
  return isNaN(intento.getTime()) ? null : aISO(intento);
}

/**
 * Devuelve la fecha en AAAA-MM-DD solo si el día existe de verdad.
 * Un 31 de febrero se rechaza aquí y no más adelante: el backend lo
 * rebotaría igual, pero con un mensaje que no dice nada.
 */
function fechaValida(anio: number, mes: number, dia: number): string | null {
  if (!anio || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const d = new Date(Date.UTC(anio, mes - 1, dia));

  const real =
    d.getUTCFullYear() === anio &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia;

  return real ? `${anio}-${pad(mes)}-${pad(dia)}` : null;
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

/**
 * Una casilla con cualquier otra letra suelta (la "Z" de enero, reporte
 * 3320) también cuenta como marcada, pero se avisa: casi siempre es la X
 * escrita con la tecla de al lado.
 */
function marcaRara(valor: any): boolean {
  if (valor === null || valor === undefined) return false;
  const v = String(valor).trim();
  return v.length === 1 && /[a-zA-Z]/.test(v) && !estaMarcada(v);
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
/*  Encabezado                                                         */
/* ------------------------------------------------------------------ */

interface Encabezado {
  /** Índice de la fila (0 = primera del archivo). */
  indice: number;
  mapa: Map<number, Campo>;
  ignoradas: string[];
  /** Columnas sin título que se rescataron por su posición. */
  porPosicion: { columna: string; campo: Campo }[];
}

function mapearFila(fila: any[]): { mapa: Map<number, Campo>; ignoradas: string[] } {
  const mapa = new Map<number, Campo>();
  const ignoradas: string[] = [];

  (fila || []).forEach((titulo: any, indice: number) => {
    const clave = normalizarTitulo(titulo);
    if (!clave || IGNORADAS.includes(clave)) return;

    const campo = COLUMNAS[clave];
    if (campo) {
      // El primer título gana: si el archivo repite "FECHA" al final, la
      // columna buena sigue siendo la de la izquierda.
      if (![...mapa.values()].includes(campo)) mapa.set(indice, campo);
    } else {
      ignoradas.push(texto(titulo));
    }
  });

  return { mapa, ignoradas };
}

/**
 * Busca la fila que hace de encabezado.
 *
 * Enero abre con "FECHA | REPORTE | INFORME DE GESTION…" en la fila 1 y el
 * encabezado de verdad en la 2; febrero y marzo abren con un título que
 * ocupa toda la fila. Se puntúa cada una de las primeras filas y gana la
 * que reconozca más columnas del seguimiento.
 */
function buscarEncabezado(matriz: any[][]): Encabezado {
  let mejor: Encabezado | null = null;
  let mejorPuntaje = -1;

  const limite = Math.min(matriz.length, FILAS_A_REVISAR);

  for (let i = 0; i < limite; i++) {
    const { mapa, ignoradas } = mapearFila(matriz[i]);
    const campos = new Set(mapa.values());

    // Reconocer muchas columnas suma; tener las dos obligatorias pesa más
    // que cualquier otra cosa.
    let puntaje = campos.size;
    if (campos.has('equipment') && campos.has('date')) puntaje += 10;

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = { indice: i, mapa, ignoradas, porPosicion: [] };
    }
  }

  return mejor ?? { indice: 0, mapa: new Map(), ignoradas: [], porPosicion: [] };
}

/**
 * Rescata columnas cuyo título quedó en blanco.
 *
 * En el seguimiento de febrero la celda del título de SERIE está vacía,
 * pero la columna trae las series igual; en abril pasa lo mismo con
 * INVENTARIO. Si la columna cae en la posición que ese campo ocupa en el
 * formato de la clínica, y ese campo no apareció en ninguna otra parte, se
 * asigna.
 */
function completarPorPosicion(enc: Encabezado, ancho: number): void {
  const usados = new Set(enc.mapa.values());
  const tope = Math.min(ancho, ORDEN_CANONICO.length);

  for (let i = 0; i < tope; i++) {
    if (enc.mapa.has(i)) continue;

    const campo = ORDEN_CANONICO[i];
    if (!campo || usados.has(campo)) continue;

    enc.mapa.set(i, campo);
    usados.add(campo);
    enc.porPosicion.push({ columna: letraColumna(i), campo });
  }
}

/** 0 -> "A", 5 -> "F", 26 -> "AA". */
function letraColumna(indice: number): string {
  let n = indice;
  let letras = '';
  do {
    letras = String.fromCharCode(65 + (n % 26)) + letras;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letras;
}

/* ------------------------------------------------------------------ */
/*  Identificador estable a partir del número de reporte               */
/* ------------------------------------------------------------------ */

const NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

/**
 * El mismo uuid que calcula el backend para ese número de reporte
 * (`Uuid::uuid5(NAMESPACE_URL, 'seguimiento:reporte:N')`).
 *
 * Sirve para que volver a cargar el mismo archivo —o cargar el de marzo
 * desde el celular y también desde el PC— actualice la fila en vez de
 * estrellarse contra "el reporte 3494 ya existe en la base de datos".
 *
 * Si el navegador no expone crypto.subtle (páginas servidas sin HTTPS) se
 * cae de vuelta a un uuid aleatorio: se pierde la idempotencia, no datos.
 */
export async function uuidDeReporte(numero: number): Promise<string> {
  try {
    const sub = (globalThis.crypto as any)?.subtle;
    if (!sub) return nuevoUuid();

    const nombre = `seguimiento:reporte:${numero}`;
    const ns = NAMESPACE_URL.replace(/-/g, '');

    const bytesNs = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytesNs[i] = parseInt(ns.slice(i * 2, i * 2 + 2), 16);
    }

    const bytesNombre = new TextEncoder().encode(nombre);
    const datos = new Uint8Array(bytesNs.length + bytesNombre.length);
    datos.set(bytesNs, 0);
    datos.set(bytesNombre, bytesNs.length);

    const hash = new Uint8Array(await sub.digest('SHA-1', datos));

    const b = hash.slice(0, 16);
    b[6] = (b[6] & 0x0f) | 0x50;   // versión 5
    b[8] = (b[8] & 0x3f) | 0x80;   // variante RFC 4122

    const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

    return [
      hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16),
      hex.slice(16, 20), hex.slice(20),
    ].join('-');
  } catch {
    return nuevoUuid();
  }
}

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
  /** Fila del Excel donde se encontró el encabezado (1 = la primera). */
  filaEncabezado: number;
  /** Columnas sin título que se rescataron por su posición. */
  columnasPorPosicion: { columna: string; campo: string }[];
  /** Cuántas filas tomaron la fecha de la fila de arriba. */
  fechasHeredadas: number;
  /** Rango de reportes que trae el archivo, si los trae. */
  reporteMin?: number;
  reporteMax?: number;
  /** Números que faltan dentro de ese rango. */
  reportesFaltantes: number[];
}

/** Nombre legible de cada campo, para los mensajes de la interfaz. */
const NOMBRE_CAMPO: Record<string, string> = {
  date: 'FECHA',
  numeroReporte: 'REPORTE',
  equipment: 'EQUIPO',
  brand: 'MARCA',
  model: 'MODELO',
  serialNumber: 'SERIE',
  service: 'SERVICIO',
  specificLocation: 'UBICACIÓN',
  inventoryCode: 'INVENTARIO',
  preventivo: 'PREVENTIVO',
  correctivo: 'CORRECTIVO',
  otro: 'OTRO',
  failureComments: 'DESCRIPCIÓN',
  additionalObservations: 'OBSERVACIONES',
  finalStatus: 'ESTADO',
  spareParts: 'REPUESTOS',
  technicianName: 'TÉCNICO',
  time: 'HORA',
};

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

  // blankrows en true a propósito: así el índice de cada fila sigue siendo
  // el número de fila del Excel y los mensajes de error apuntan a la fila
  // que el técnico ve en pantalla.
  const matriz: any[][] = XLSX.utils.sheet_to_json(hoja, {
    header: 1,
    blankrows: true,
    defval: '',
    raw: true,
  });

  if (matriz.length < 2) {
    throw new Error('El archivo no tiene filas de datos debajo del encabezado.');
  }

  /* --- 1. Encabezado --- */
  const encabezado = buscarEncabezado(matriz);
  const ancho = matriz.reduce((max, f) => Math.max(max, (f || []).length), 0);
  completarPorPosicion(encabezado, ancho);

  const mapa = encabezado.mapa;
  const detectadas = [...new Set(mapa.values())];
  const faltantes = OBLIGATORIAS.filter((c) => !detectadas.includes(c));

  if (faltantes.length) {
    const nombres = faltantes.map((f) => NOMBRE_CAMPO[f] ?? f);
    throw new Error(
      `No se reconoció el encabezado del seguimiento: falta ${nombres.join(' y ')}. ` +
        'Revise que la hoja tenga la fila de títulos (FECHA, REPORTE, EQUIPO…), ' +
        'o descargue la plantilla para ver el formato esperado.',
    );
  }

  /* --- 2. Filas --- */
  const reportesExistentes = opciones.reportesExistentes ?? new Set<number>();
  const reportesDelArchivo = new Map<number, number>();   // numero -> fila
  const filas: FilaImportada[] = [];
  const ahora = Date.now();
  const hoy = aISO(new Date());

  /** La fecha de la última fila que sí la traía. */
  let fechaArrastrada: string | null = null;
  let fechasHeredadas = 0;

  for (let i = encabezado.indice + 1; i < matriz.length; i++) {
    const fila = matriz[i] || [];
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

    /* --- Fecha, con arrastre --- */
    let fecha = normalizarFecha(bruto.date);

    if (!fecha) {
      const escrita = texto(bruto.date);

      if (escrita) {
        // Hay algo escrito y no se entiende: eso sí es un error.
        errores.push(
          `La fecha "${escrita}" no se entiende. Use AAAA-MM-DD o DD/MM/AAAA.`,
        );
      } else if (fechaArrastrada) {
        // Celda vacía: en el seguimiento eso significa "el mismo día de la
        // fila de arriba". Es el caso de casi todo marzo.
        fecha = fechaArrastrada;
        fechasHeredadas++;
        advertencias.push(
          `Sin fecha propia: se tomó la del ${fecha}, de la fila anterior.`,
        );
      } else {
        errores.push('Falta la fecha y no hay ninguna fila anterior de dónde tomarla.');
      }
    } else {
      fechaArrastrada = fecha;
      if (fecha > hoy) advertencias.push('La fecha es futura.');
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

    // Una letra distinta de X en la casilla se toma como marca, con aviso:
    // descartarla clasificaría mal el mantenimiento.
    if (!preventivo && marcaRara(bruto.preventivo)) {
      preventivo = true;
      advertencias.push(
        `La casilla PREVENTIVO dice "${texto(bruto.preventivo)}"; se tomó como marcada.`,
      );
    }
    if (!correctivo && marcaRara(bruto.correctivo)) {
      correctivo = true;
      advertencias.push(
        `La casilla CORRECTIVO dice "${texto(bruto.correctivo)}"; se tomó como marcada.`,
      );
    }
    if (!otro && marcaRara(bruto.otro)) {
      otro = true;
      advertencias.push(
        `La casilla OTRO dice "${texto(bruto.otro)}"; se tomó como marcada.`,
      );
    }

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
      // Provisional: si la fila trae número de reporte, más abajo se
      // reemplaza por el uuid derivado de ese número.
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

  /* --- 3. Identificador estable para las filas con reporte --- */
  // Se hace al final y en bloque porque el cálculo del uuid es asíncrono.
  await Promise.all(
    filas.map(async (f) => {
      if (f.registro.numeroReporte) {
        f.registro.id = await uuidDeReporte(f.registro.numeroReporte);
      }
    }),
  );

  /* --- 4. Continuidad de los reportes --- */
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
    columnasIgnoradas: encabezado.ignoradas,
    totalFilas: filas.length,
    validas: filas.filter((f) => f.errores.length === 0).length,
    conError: filas.filter((f) => f.errores.length > 0).length,
    duplicadas: filas.filter((f) => f.duplicado).length,
    hojas: libro.SheetNames,
    hojaLeida: nombreHoja,
    filaEncabezado: encabezado.indice + 1,
    columnasPorPosicion: encabezado.porPosicion.map((p) => ({
      columna: p.columna,
      campo: NOMBRE_CAMPO[p.campo] ?? p.campo,
    })),
    fechasHeredadas,
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
    ['FECHA', 'AAAA-MM-DD, DD/MM/AAAA o DD.MM.AAAA. Si la deja vacía, la fila toma la fecha de la fila de arriba, como en el seguimiento en papel.'],
    ['REPORTE', 'El consecutivo del seguimiento. Si lo deja vacío, el servidor asigna el siguiente libre. Si ese número ya existe, la fila actualiza el registro que ya está, no lo duplica.'],
    ['EQUIPO', 'Nombre del equipo. Obligatoria.'],
    ['SERIE', 'Identifica el equipo. Si va vacía se usa INVENTARIO; si tampoco hay, se crea un equipo nuevo.'],
    ['PREVENTIVO / CORRECTIVO / OTRO', 'Marque con X la que corresponda. Puede marcar más de una. Si no marca ninguna, la fila queda como OTRO.'],
    ['ESTADO', 'Texto libre: FUNCIONAL, EN ESPERA DE REPUESTOS, o lo que aplique.'],
    ['SERVICIO / UBICACION', 'Texto libre, tal como lo escriban en el seguimiento.'],
    ['', ''],
    ['Nota', 'Las columnas REGISTRO y CLASE del formato antiguo se ignoran: vienen siempre vacías.'],
    ['Nota', 'El archivo puede traer un título arriba del encabezado (INFORME DE GESTION…): se detecta solo.'],
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
