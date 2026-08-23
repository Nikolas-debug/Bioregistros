/**
 * Base de datos local del dispositivo.
 *
 * Cumple dos papeles: guardar lo que el técnico registra para poder
 * consultarlo sin conexión, y mantener una bandeja de salida con lo que
 * todavía no ha llegado a PostgreSQL.
 *
 * Sobre los identificadores: aquí ya no se inventan códigos. Cada registro
 * lleva un UUID generado por el navegador, que es lo único que necesita el
 * servidor para no duplicar nada. El número visible del seguimiento
 * (`numeroReporte`) lo asigna PostgreSQL y vuelve en la respuesta de la
 * sincronización.
 */

import {
  MaintenanceRecord,
  Equipment,
  DatabaseStats,
  ElementoCola,
  grupoEstado,
} from '../types';

const DB_NAME = 'Bioregistros';

/**
 * Versión 4: los registros cambiaron de forma (uuid en vez de código
 * inventado, tres casillas de clase, estado como texto libre). Los datos
 * de las versiones anteriores eran de prueba y no se pueden migrar campo a
 * campo, así que se limpian al subir de versión.
 */
const DB_VERSION = 4;

const STORES = {
  RECORDS: 'maintenance_records',
  EQUIPMENTS: 'equipments',
  SETTINGS: 'app_settings',
  /** Bandeja de salida: lo que todavía no ha llegado a PostgreSQL. */
  QUEUE: 'cola_sincronizacion',
};

/** UUID del navegador, con respaldo para contextos sin crypto.randomUUID. */
export function nuevoUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  // Respaldo para navegadores viejos o páginas servidas sin HTTPS.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** El equipo se identifica por su serie; si no la tiene, por inventario. */
export function claveEquipo(serie?: string, inventario?: string): string {
  const s = (serie ?? '').trim();
  if (s) return `S:${s.toUpperCase()}`;

  const i = (inventario ?? '').trim();
  if (i) return `I:${i.toUpperCase()}`;

  return `X:${nuevoUuid()}`;
}

class IndexedDBManager {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const anterior = event.oldVersion;

        // Al pasar de una versión previa a la 4 se descartan los almacenes
        // con la forma antigua. Nunca se pierde trabajo real: en la versión
        // 4 no había todavía datos de la clínica.
        if (anterior > 0 && anterior < 4) {
          [STORES.RECORDS, STORES.EQUIPMENTS, STORES.QUEUE].forEach((nombre) => {
            if (db.objectStoreNames.contains(nombre)) {
              db.deleteObjectStore(nombre);
            }
          });
        }

        if (!db.objectStoreNames.contains(STORES.RECORDS)) {
          const registros = db.createObjectStore(STORES.RECORDS, { keyPath: 'id' });
          registros.createIndex('date', 'date', { unique: false });
          registros.createIndex('numeroReporte', 'numeroReporte', { unique: false });
          registros.createIndex('equipment', 'equipment', { unique: false });
          registros.createIndex('service', 'service', { unique: false });
          registros.createIndex('createdAt', 'createdAt', { unique: false });
          registros.createIndex('syncState', 'syncState', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.EQUIPMENTS)) {
          const equipos = db.createObjectStore(STORES.EQUIPMENTS, { keyPath: 'id' });
          equipos.createIndex('serialNumber', 'serialNumber', { unique: false });
          equipos.createIndex('inventoryCode', 'inventoryCode', { unique: false });
          equipos.createIndex('service', 'service', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.QUEUE)) {
          const cola = db.createObjectStore(STORES.QUEUE, { keyPath: 'id' });
          cola.createIndex('creadoEn', 'creadoEn', { unique: false });
          cola.createIndex('intentos', 'intentos', { unique: false });
        }
      };

      request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /* ================================================================== */
  /*  Registros                                                          */
  /* ================================================================== */

  async getAllRecords(): Promise<MaintenanceRecord[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(STORES.RECORDS, 'readonly')
        .objectStore(STORES.RECORDS)
        .getAll();

      request.onsuccess = () => {
        const registros = (request.result as MaintenanceRecord[]).sort((a, b) => {
          // Primero por número de reporte, que es el orden del seguimiento.
          // Los que aún no tienen número (recién registrados sin conexión)
          // van arriba, para que el técnico los vea de una.
          if (a.numeroReporte && b.numeroReporte) return b.numeroReporte - a.numeroReporte;
          if (a.numeroReporte) return 1;
          if (b.numeroReporte) return -1;
          return (b.createdAt || 0) - (a.createdAt || 0);
        });
        resolve(registros);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getRecordById(id: string): Promise<MaintenanceRecord | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(STORES.RECORDS, 'readonly')
        .objectStore(STORES.RECORDS)
        .get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Alta de un mantenimiento.
   * Se guarda y se encola en la MISMA transacción: o quedan las dos cosas,
   * o no queda ninguna.
   */
  async addRecord(
    datos: Omit<MaintenanceRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ): Promise<MaintenanceRecord> {
    const db = await this.openDB();
    const ahora = Date.now();

    const registro: MaintenanceRecord = {
      ...datos,
      id: datos.id || nuevoUuid(),
      createdAt: ahora,
      updatedAt: ahora,
      syncState: 'pending',
      origen: datos.origen || 'app',
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORES.RECORDS, STORES.EQUIPMENTS, STORES.QUEUE],
        'readwrite',
      );

      tx.objectStore(STORES.RECORDS).put(registro);
      tx.objectStore(STORES.EQUIPMENTS).put(this.equipoDesde(registro));
      tx.objectStore(STORES.QUEUE).put(this.elementoCola(registro, 'crear', ahora));

      tx.oncomplete = () => resolve(registro);
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateRecord(registro: MaintenanceRecord): Promise<MaintenanceRecord> {
    const db = await this.openDB();
    const ahora = Date.now();

    const actualizado: MaintenanceRecord = {
      ...registro,
      updatedAt: ahora,
      syncState: 'pending',
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.RECORDS, STORES.QUEUE], 'readwrite');

      tx.objectStore(STORES.RECORDS).put(actualizado);
      // Reenviar el mismo uuid actualiza en PostgreSQL, no duplica.
      tx.objectStore(STORES.QUEUE).put(this.elementoCola(actualizado, 'actualizar', ahora));

      tx.oncomplete = () => resolve(actualizado);
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteRecord(id: string): Promise<boolean> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.RECORDS, STORES.QUEUE], 'readwrite');
      tx.objectStore(STORES.RECORDS).delete(id);
      tx.objectStore(STORES.QUEUE).delete(id);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Alta masiva desde un seguimiento en Excel.
   * Todas las filas entran en una sola transacción.
   */
  async agregarRegistrosEnLote(
    registros: MaintenanceRecord[],
  ): Promise<{ guardados: number }> {
    const db = await this.openDB();
    const ahora = Date.now();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORES.RECORDS, STORES.EQUIPMENTS, STORES.QUEUE],
        'readwrite',
      );

      const almacenRegistros = tx.objectStore(STORES.RECORDS);
      const almacenEquipos = tx.objectStore(STORES.EQUIPMENTS);
      const cola = tx.objectStore(STORES.QUEUE);

      registros.forEach((r) => {
        const completo: MaintenanceRecord = {
          ...r,
          id: r.id || nuevoUuid(),
          createdAt: r.createdAt || ahora,
          updatedAt: ahora,
          syncState: 'pending',
          origen: 'excel',
        };

        almacenRegistros.put(completo);
        almacenEquipos.put(this.equipoDesde(completo));
        cola.put(this.elementoCola(completo, 'crear', ahora));
      });

      tx.oncomplete = () => resolve({ guardados: registros.length });
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ================================================================== */
  /*  Inventario                                                         */
  /* ================================================================== */

  async getAllEquipments(): Promise<Equipment[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(STORES.EQUIPMENTS, 'readonly')
        .objectStore(STORES.EQUIPMENTS)
        .getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async addEquipment(equipo: Equipment): Promise<Equipment> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.EQUIPMENTS, 'readwrite');
      tx.objectStore(STORES.EQUIPMENTS).put({
        ...equipo,
        id: equipo.id || claveEquipo(equipo.serialNumber, equipo.inventoryCode),
      });

      tx.oncomplete = () => resolve(equipo);
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ================================================================== */
  /*  Cola de sincronización                                             */
  /* ================================================================== */

  async obtenerCola(limite = 500): Promise<ElementoCola[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(STORES.QUEUE, 'readonly')
        .objectStore(STORES.QUEUE)
        .getAll();

      request.onsuccess = () => {
        const cola = (request.result as ElementoCola[])
          .sort((a, b) => (a.creadoEn || 0) - (b.creadoEn || 0))
          .slice(0, limite);
        resolve(cola);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async contarPendientes(): Promise<number> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(STORES.QUEUE, 'readonly')
        .objectStore(STORES.QUEUE)
        .count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * El servidor confirmó estos registros: salen de la cola.
   *
   * Además guarda el número de reporte que asignó PostgreSQL, que es el
   * dato que la clínica realmente usa.
   */
  async confirmarSincronizados(
    confirmaciones: {
      uuid: string;
      id?: number | null;
      numero_reporte?: number | null;
    }[],
    borrarDelHistorial = false,
  ): Promise<void> {
    if (confirmaciones.length === 0) return;
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.QUEUE, STORES.RECORDS], 'readwrite');
      const cola = tx.objectStore(STORES.QUEUE);
      const registros = tx.objectStore(STORES.RECORDS);

      confirmaciones.forEach(({ uuid, id, numero_reporte }) => {
        cola.delete(uuid);

        if (borrarDelHistorial) {
          registros.delete(uuid);
          return;
        }

        const lectura = registros.get(uuid);
        lectura.onsuccess = () => {
          const registro = lectura.result as MaintenanceRecord | undefined;
          if (registro) {
            registros.put({
              ...registro,
              idServidor: id ?? registro.idServidor,
              numeroReporte: numero_reporte ?? registro.numeroReporte,
              syncState: 'synced',
              syncedAt: Date.now(),
              syncError: undefined,
            });
          }
        };
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async marcarFallidos(fallos: { id: string; error: string }[]): Promise<void> {
    if (fallos.length === 0) return;
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.QUEUE, STORES.RECORDS], 'readwrite');
      const cola = tx.objectStore(STORES.QUEUE);
      const registros = tx.objectStore(STORES.RECORDS);

      fallos.forEach(({ id, error }) => {
        const lectura = cola.get(id);
        lectura.onsuccess = () => {
          const item = lectura.result as ElementoCola | undefined;
          if (item) {
            cola.put({
              ...item,
              intentos: (item.intentos || 0) + 1,
              ultimoError: error,
              ultimoIntento: Date.now(),
            });
          }
        };

        const lecturaRegistro = registros.get(id);
        lecturaRegistro.onsuccess = () => {
          const registro = lecturaRegistro.result as MaintenanceRecord | undefined;
          if (registro) {
            registros.put({ ...registro, syncState: 'error', syncError: error });
          }
        };
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Pone en cero los contadores, para el botón "Sincronizar ahora". */
  async reiniciarIntentos(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.QUEUE, 'readwrite');
      const cola = tx.objectStore(STORES.QUEUE);
      const lectura = cola.getAll();

      lectura.onsuccess = () => {
        (lectura.result as ElementoCola[]).forEach((item) => {
          if ((item.intentos || 0) > 0) {
            cola.put({ ...item, intentos: 0, ultimoIntento: 0 });
          }
        });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ================================================================== */
  /*  Estadísticas, preferencias y respaldos                             */
  /* ================================================================== */

  async getDatabaseStats(): Promise<DatabaseStats> {
    const registros = await this.getAllRecords();
    const equipos = await this.getAllEquipments();

    let preventivos = 0;
    let correctivos = 0;
    let otros = 0;
    let funcionales = 0;
    let esperando = 0;
    let fuera = 0;
    let ultimoReporte = 0;

    registros.forEach((r) => {
      if (r.preventivo) preventivos++;
      if (r.correctivo) correctivos++;
      if (r.otro) otros++;

      switch (grupoEstado(r.finalStatus)) {
        case 'funcional': funcionales++; break;
        case 'espera':    esperando++;   break;
        case 'fuera':     fuera++;       break;
      }

      if (r.numeroReporte && r.numeroReporte > ultimoReporte) {
        ultimoReporte = r.numeroReporte;
      }
    });

    return {
      totalRecords: registros.length,
      preventiveCount: preventivos,
      correctiveCount: correctivos,
      otherCount: otros,
      operationalCount: funcionales,
      pendingPartsCount: esperando,
      outOfServiceCount: fuera,
      totalEquipments: equipos.length,
      ultimoReporte: ultimoReporte || undefined,
      lastSyncTimestamp: Date.now(),
    };
  }

  async guardarPreferencia(clave: string, valor: any): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETTINGS, 'readwrite');
      tx.objectStore(STORES.SETTINGS).put({ key: clave, value: valor });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async leerPreferencia<T = any>(clave: string, porDefecto: T): Promise<T> {
    const db = await this.openDB();
    return new Promise((resolve) => {
      const request = db
        .transaction(STORES.SETTINGS, 'readonly')
        .objectStore(STORES.SETTINGS)
        .get(clave);

      request.onsuccess = () => resolve(request.result ? request.result.value : porDefecto);
      request.onerror = () => resolve(porDefecto);
    });
  }

  /** Los uuid que ya existen, para no reimportar el mismo archivo dos veces. */
  async idsExistentes(): Promise<Set<string>> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(STORES.RECORDS, 'readonly')
        .objectStore(STORES.RECORDS)
        .getAllKeys();

      request.onsuccess = () => resolve(new Set(request.result as string[]));
      request.onerror = () => reject(request.error);
    });
  }

  /** Los números de reporte ya presentes en el dispositivo. */
  async reportesExistentes(): Promise<Set<number>> {
    const registros = await this.getAllRecords();
    return new Set(
      registros.map((r) => r.numeroReporte).filter((n): n is number => typeof n === 'number'),
    );
  }

  async exportBackupJSON(): Promise<string> {
    const registros = await this.getAllRecords();
    const equipos = await this.getAllEquipments();

    return JSON.stringify(
      {
        version: DB_VERSION,
        exportedAt: new Date().toISOString(),
        records: registros,
        equipments: equipos,
      },
      null,
      2,
    );
  }

  async importBackupJSON(
    json: string,
  ): Promise<{ recordsImported: number; equipmentsImported: number }> {
    const datos = JSON.parse(json);
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.RECORDS, STORES.EQUIPMENTS], 'readwrite');
      const registros = tx.objectStore(STORES.RECORDS);
      const equipos = tx.objectStore(STORES.EQUIPMENTS);

      let r = 0;
      let e = 0;

      if (Array.isArray(datos.records)) {
        datos.records.forEach((registro: MaintenanceRecord) => {
          registros.put(registro);
          r++;
        });
      }

      if (Array.isArray(datos.equipments)) {
        datos.equipments.forEach((equipo: Equipment) => {
          equipos.put(equipo);
          e++;
        });
      }

      tx.oncomplete = () => resolve({ recordsImported: r, equipmentsImported: e });
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Borra TODO lo del dispositivo. Lo que esté en la cola sin sincronizar
   * se pierde; por eso la interfaz avisa antes cuántos hay.
   */
  async borrarTodosLosDatos(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORES.RECORDS, STORES.EQUIPMENTS, STORES.QUEUE],
        'readwrite',
      );

      tx.objectStore(STORES.RECORDS).clear();
      tx.objectStore(STORES.EQUIPMENTS).clear();
      tx.objectStore(STORES.QUEUE).clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ------------------------------------------------------------------ */

  private equipoDesde(r: MaintenanceRecord): Equipment {
    return {
      id: claveEquipo(r.serialNumber, r.inventoryCode),
      name: r.equipment,
      brand: r.brand,
      model: r.model,
      serialNumber: r.serialNumber,
      inventoryCode: r.inventoryCode,
      service: r.service,
      specificLocation: r.specificLocation,
      status: r.finalStatus,
      lastMaintenanceDate: r.date,
      frequencyMonths: 6,
    };
  }

  private elementoCola(
    r: MaintenanceRecord,
    operacion: 'crear' | 'actualizar',
    ahora: number,
  ): ElementoCola {
    return {
      id: r.id,
      operacion,
      payload: r,
      creadoEn: ahora,
      intentos: 0,
      ultimoError: null,
    };
  }
}

export const dbManager = new IndexedDBManager();
