/**
 * Tipos del seguimiento biomédico.
 *
 * La forma sigue el archivo real de la clínica ("SEGUIMIENTO MAYO 2026"),
 * no un modelo ideal: por eso el servicio y el estado son texto libre, y
 * las tres clases de mantenimiento son casillas independientes.
 */

/* ==================================================================== */
/*  Registro de mantenimiento                                           */
/* ==================================================================== */

export interface MaintenanceRecord {
  /**
   * Identificador local. Es un UUID que genera el dispositivo, y es lo que
   * hace idempotente la sincronización: reenviar el mismo uuid actualiza
   * el registro en PostgreSQL en vez de duplicarlo.
   *
   * Ya no se inventan códigos tipo MN-2026-1234. El número visible para la
   * clínica es `numeroReporte`, y ese lo asigna el servidor.
   */
  id: string;

  /** Id entero que asigna PostgreSQL. Solo existe después de sincronizar. */
  idServidor?: number;

  /**
   * El consecutivo del seguimiento (3566, 3567...). Lo asigna el servidor,
   * porque depende de cuántos reportes existan en total y el celular no
   * puede saberlo estando sin conexión.
   */
  numeroReporte?: number;

  /* --- Equipo --- */
  equipment: string;
  brand: string;
  model: string;
  serialNumber: string;
  inventoryCode: string;

  /** Texto libre: "HOSPITALISACION", "UCI NEO.", "TORRE B"... */
  service: string;
  specificLocation: string;

  /* --- Intervención --- */
  date: string;                 // YYYY-MM-DD
  time?: string;                // HH:MM

  /**
   * Las tres casillas del seguimiento. Son independientes: una fila puede
   * tener marcadas dos (en mayo hay una que es preventivo y correctivo).
   */
  preventivo: boolean;
  correctivo: boolean;
  otro: boolean;

  failureComments: string;          // columna DESCRIPCION
  additionalObservations: string;   // columna OBSERVACIONES

  /** Texto libre: "FUNCIONAL", "SENSOR SPO2", "DISPLEY"... */
  finalStatus: string;
  spareParts: string;

  technicianName: string;

  /* --- Control interno --- */
  createdAt: number;
  updatedAt: number;
  syncState?: SyncState;
  syncedAt?: number;
  syncError?: string;
  origen?: 'app' | 'offline' | 'excel' | 'manual';
}

/* ==================================================================== */
/*  Inventario                                                          */
/* ==================================================================== */

export interface Equipment {
  /** Local: se deriva de la serie o del inventario. */
  id: string;
  idServidor?: number;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  inventoryCode: string;
  service: string;
  specificLocation: string;
  status: string;
  riskClass?: string;
  lastMaintenanceDate?: string;
  frequencyMonths: number;
}

/* ==================================================================== */
/*  Usuario y estadísticas                                              */
/* ==================================================================== */

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  institution: string;
  avatarUrl: string;
  isLoggedIn: boolean;
}

export interface DatabaseStats {
  totalRecords: number;
  preventiveCount: number;
  correctiveCount: number;
  otherCount: number;
  operationalCount: number;
  pendingPartsCount: number;
  outOfServiceCount: number;
  totalEquipments: number;
  ultimoReporte?: number;
  lastSyncTimestamp: number;
}

export type ActiveTab = 'inicio' | 'registrar' | 'documentos';

/* ==================================================================== */
/*  Sugerencias para los formularios                                    */
/*  Son sugerencias, NO listas cerradas: el archivo real trae valores    */
/*  que ninguna lista fija habría aceptado.                              */
/* ==================================================================== */

export const ESTADOS_SUGERIDOS = [
  'FUNCIONAL',
  'EN ESPERA DE REPUESTOS',
  'FUERA DE SERVICIO',
  'CALIBRADO',
];

export const SERVICIOS_SUGERIDOS = [
  'HOSPITALIZACION',
  'URGENCIAS',
  'UCI NEONATAL',
  'UCI PEDIATRICA',
  'UCI ADULTO',
  'CIRUGIA',
  'IMAGENES',
  'LABORATORIO',
  'CONSULTA EXTERNA',
  'RESONANCIA',
];

/* ==================================================================== */
/*  Ayudas de lectura                                                   */
/* ==================================================================== */

/**
 * Agrupa un estado escrito a mano en una de cuatro categorías, para poder
 * contar y filtrar sin obligar a nadie a escribir exactamente igual.
 * "FUNCIONAL", "funcional" y "Operativo" caen todos en 'funcional'.
 */
export type GrupoEstado = 'funcional' | 'espera' | 'fuera' | 'sin-dato';

export function grupoEstado(estado?: string): GrupoEstado {
  const v = (estado ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (!v) return 'sin-dato';
  if (v.includes('repuesto') || v.includes('espera')) return 'espera';
  if (v.includes('fuera') || v.includes('baja') || v.includes('dan')) return 'fuera';
  if (v.includes('funcional') || v.includes('operativ') || v.includes('calibrad')) return 'funcional';

  // Cuando escriben el nombre de un repuesto en la casilla de estado
  // ("SENSOR SPO2", "DISPLEY"), en la práctica el equipo está esperando
  // esa pieza.
  return 'espera';
}

/** Las clases marcadas en un registro, como lista. */
export function clasesDe(r: Pick<MaintenanceRecord, 'preventivo' | 'correctivo' | 'otro'>): string[] {
  const clases: string[] = [];
  if (r.preventivo) clases.push('Preventivo');
  if (r.correctivo) clases.push('Correctivo');
  if (r.otro) clases.push('Otro');
  return clases;
}

/** Etiqueta corta para mostrar: "Preventivo" o "Preventivo + Correctivo". */
export function etiquetaClases(
  r: Pick<MaintenanceRecord, 'preventivo' | 'correctivo' | 'otro'>,
): string {
  const clases = clasesDe(r);
  return clases.length ? clases.join(' + ') : 'Sin clasificar';
}

/** El número que se le muestra al usuario mientras el servidor no asigna uno. */
export function etiquetaReporte(r: MaintenanceRecord): string {
  return r.numeroReporte ? `#${r.numeroReporte}` : 'Pendiente';
}

/* ==================================================================== */
/*  Sincronización                                                      */
/* ==================================================================== */

/**
 *  - pending : guardado en el celular, sin confirmar por el servidor.
 *  - synced  : PostgreSQL ya lo tiene. Salió de la cola.
 *  - error   : el servidor lo rechazó; sigue en la cola con el motivo.
 */
export type SyncState = 'pending' | 'synced' | 'error';

/** Un elemento de la bandeja de salida (store `cola_sincronizacion`). */
export interface ElementoCola {
  id: string;                       // mismo uuid del mantenimiento
  operacion: 'crear' | 'actualizar';
  payload: MaintenanceRecord;
  creadoEn: number;
  intentos: number;
  ultimoError: string | null;
  ultimoIntento?: number;
}

/** Resultado de una corrida de sincronización, para mostrar en pantalla. */
export interface ResultadoSync {
  ok: boolean;
  enviados: number;
  guardados: number;
  fallidos: number;
  pendientes: number;
  mensaje: string;
  errores?: { id: string; detalle: string }[];
}

/** Fila leída de un Excel de seguimiento, ya validada. */
export interface FilaImportada {
  fila: number;                     // número de fila en el Excel
  registro: MaintenanceRecord;
  errores: string[];
  advertencias: string[];
  duplicado: boolean;
}
