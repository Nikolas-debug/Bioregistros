import { MaintenanceRecord, Equipment, DatabaseStats } from '../types';

const DB_NAME = 'Bioregistros';
const DB_VERSION = 1;

const STORES = {
  RECORDS: 'maintenance_records',
  EQUIPMENTS: 'equipments',
  SETTINGS: 'app_settings'
};

const INITIAL_RECORDS: MaintenanceRecord[] = [
  {
    id: 'MN-2023-1142',
    equipmentId: 'EQ-2023-001',
    equipment: 'Ventilator V60',
    brand: 'Philips',
    model: 'V60',
    serialNumber: 'SN-89234',
    service: 'UCI',
    specificLocation: 'Cama 4',
    inventoryCode: 'CDN-BIO-2023-089',
    date: '2023-10-27',
    time: '09:30',
    finalStatus: 'Operativo',
    maintenanceType: 'Preventivo',
    spareParts: 'Filtro bacteriano HEPA, Celda galvánica de O2',
    failureComments: 'Rutina preventiva semestral. Inspección de sellos y circuito neumático.',
    additionalObservations: 'Equipo calibrado y dentro de tolerancias de flujo y presión según norma IEC 60601.',
    technicianName: 'Luis Machado',
    technicianCard: 'T.P. BIO-88942',
    createdAt: new Date('2023-10-27T09:30:00').getTime(),
    updatedAt: new Date('2023-10-27T09:30:00').getTime(),
    syncedOffline: true
  },
  {
    id: 'MN-2023-1141',
    equipmentId: 'EQ-2023-002',
    equipment: 'MRI Optima 450w',
    brand: 'GE Healthcare',
    model: 'Optima 450w 1.5T',
    serialNumber: 'SN-78412',
    service: 'Imágenes Diagnósticas',
    specificLocation: 'Sala Resonancia 1',
    inventoryCode: 'CDN-BIO-2021-012',
    date: '2023-10-26',
    time: '14:15',
    finalStatus: 'En Espera de Repuestos',
    maintenanceType: 'Correctivo',
    spareParts: 'Cold Head cryocooler compressor adsorber',
    failureComments: 'Alarma de nivel de helio y compresor de enfriamiento con alta vibración en ciclo.',
    additionalObservations: 'Se solicitó reemplazo urgente a soporte de fábrica GE. Mantener monitorización criogénica.',
    technicianName: 'Luis Machado',
    technicianCard: 'T.P. BIO-88942',
    createdAt: new Date('2023-10-26T14:15:00').getTime(),
    updatedAt: new Date('2023-10-26T14:15:00').getTime(),
    syncedOffline: true
  },
  {
    id: 'MN-2023-1140',
    equipmentId: 'EQ-2023-081',
    equipment: 'Desfibrilador',
    brand: 'Zoll',
    model: 'R Series ALS',
    serialNumber: 'SN-44129',
    service: 'Urgencias',
    specificLocation: 'Carro de Paro Box 1',
    inventoryCode: 'CDN-BIO-2023-081',
    date: '2023-10-24',
    time: '11:00',
    finalStatus: 'Operativo',
    maintenanceType: 'Preventivo',
    spareParts: 'Electrodos multifunción pediátricos, Batería de Litio SurePower',
    failureComments: 'Prueba de descarga de 50J a 200J con analizador Fluke Impulse 7000DP exitosa.',
    additionalObservations: 'Sincronismo cardioversión probado. Tiempo de carga óptimo (< 5 seg a 200J).',
    technicianName: 'Luis Machado',
    technicianCard: 'T.P. BIO-88942',
    createdAt: new Date('2023-10-24T11:00:00').getTime(),
    updatedAt: new Date('2023-10-24T11:00:00').getTime(),
    syncedOffline: true
  },
  {
    id: 'MN-2023-1139',
    equipmentId: 'EQ-2023-112',
    equipment: 'Monitor de Signos Vitales',
    brand: 'Mindray',
    model: 'BeneVision N17',
    serialNumber: 'SN-91024',
    service: 'UCI Pediátrica',
    specificLocation: 'Cama 2',
    inventoryCode: 'CDN-BIO-2023-112',
    date: '2023-10-20',
    time: '16:40',
    finalStatus: 'Operativo',
    maintenanceType: 'Preventivo',
    spareParts: 'Manguera NIBP neonatal, Sensor SpO2 de clip blando',
    failureComments: 'Alineación de módulos ECG, PNI, SpO2 y Temperatura.',
    additionalObservations: 'Se ajustó hermeticidad de válvula neumática de presión arterial.',
    technicianName: 'Luis Machado',
    technicianCard: 'T.P. BIO-88942',
    createdAt: new Date('2023-10-20T16:40:00').getTime(),
    updatedAt: new Date('2023-10-20T16:40:00').getTime(),
    syncedOffline: true
  },
  {
    id: 'MN-2023-1138',
    equipmentId: 'EQ-2023-045',
    equipment: 'Bomba de Infusión',
    brand: 'Fresenius Kabi',
    model: 'Volumat MC Agilia',
    serialNumber: 'SN-33981',
    service: 'Hospitalización',
    specificLocation: 'Piso 3 Ala Norte',
    inventoryCode: 'CDN-BIO-2023-045',
    date: '2023-10-18',
    time: '10:15',
    finalStatus: 'Operativo',
    maintenanceType: 'Preventivo',
    spareParts: 'Sensor de oclusión peristáltico',
    failureComments: 'Calibración de caudal con balanza analítica y sistema de presión de infusión.',
    additionalObservations: 'Error de flujo menor al 1.2% (rango aceptable < 3%).',
    technicianName: 'Luis Machado',
    technicianCard: 'T.P. BIO-88942',
    createdAt: new Date('2023-10-18T10:15:00').getTime(),
    updatedAt: new Date('2023-10-18T10:15:00').getTime(),
    syncedOffline: true
  },
  {
    id: 'MN-2023-1137',
    equipmentId: 'EQ-2023-055',
    equipment: 'Incubadora Neonatal',
    brand: 'Dräger',
    model: 'Isolette C2000',
    serialNumber: 'SN-66710',
    service: 'UCI Neonatal',
    specificLocation: 'Puesto Neo 5',
    inventoryCode: 'CDN-BIO-2023-055',
    date: '2023-10-12',
    time: '15:20',
    finalStatus: 'Calibrado',
    maintenanceType: 'Preventivo',
    spareParts: 'Filtro de aire bacteriano, Sensor dual de temperatura piel',
    failureComments: 'Verificación de sensor de humedad servo-controlada y balance térmico con termómetros patrón.',
    additionalObservations: 'Alarma de hipertermia y corte automático de emergencia testeados con normalidad.',
    technicianName: 'Luis Machado',
    technicianCard: 'T.P. BIO-88942',
    createdAt: new Date('2023-10-12T15:20:00').getTime(),
    updatedAt: new Date('2023-10-12T15:20:00').getTime(),
    syncedOffline: true
  },
  {
    id: 'MN-2023-1136',
    equipmentId: 'EQ-2023-078',
    equipment: 'Máquina de Anestesia',
    brand: 'Dräger',
    model: 'Perseus A500',
    serialNumber: 'SN-11092',
    service: 'Quirófano',
    specificLocation: 'Quirófano Pediátrico 2',
    inventoryCode: 'CDN-BIO-2023-078',
    date: '2023-09-28',
    time: '08:00',
    finalStatus: 'Operativo',
    maintenanceType: 'Preventivo',
    spareParts: 'Vaporizador Sevoflurano junta de sellado, Trampa de agua WaterLock 2',
    failureComments: 'Prueba de fuga automática de baja y alta presión superada (0 ml/min fuga).',
    additionalObservations: 'Ventilador pistón turbo calibrado en modos PCV y VCV neonatal.',
    technicianName: 'Luis Machado',
    technicianCard: 'T.P. BIO-88942',
    createdAt: new Date('2023-09-28T08:00:00').getTime(),
    updatedAt: new Date('2023-09-28T08:00:00').getTime(),
    syncedOffline: true
  },
  {
    id: 'MN-2023-1135',
    equipmentId: 'EQ-2023-099',
    equipment: 'Electrocardiógrafo',
    brand: 'Philips',
    model: 'PageWriter TC50',
    serialNumber: 'SN-40291',
    service: 'Consulta Externa',
    specificLocation: 'Consultorio Cardiología 4',
    inventoryCode: 'CDN-BIO-2023-099',
    date: '2023-08-15',
    time: '11:45',
    finalStatus: 'Operativo',
    maintenanceType: 'Preventivo',
    spareParts: 'Cable paciente 10 derivaciones tipo banana',
    failureComments: 'Limpieza de cabezal térmico de impresión y verificación de filtros de 50Hz/60Hz.',
    additionalObservations: 'Simulación con generador de arritmias Fluke PS420 validada.',
    technicianName: 'Luis Machado',
    technicianCard: 'T.P. BIO-88942',
    createdAt: new Date('2023-08-15T11:45:00').getTime(),
    updatedAt: new Date('2023-08-15T11:45:00').getTime(),
    syncedOffline: true
  }
];

const INITIAL_EQUIPMENTS: Equipment[] = [
  {
    id: 'EQ-2023-081',
    name: 'Desfibrilador',
    brand: 'Zoll',
    model: 'R Series ALS',
    serialNumber: 'SN-44129',
    inventoryCode: 'CDN-BIO-2023-081',
    service: 'Urgencias',
    specificLocation: 'Carro de Paro Box 1',
    status: 'Operativo',
    riskClass: 'III',
    lastMaintenanceDate: '2023-10-24',
    frequencyMonths: 6
  },
  {
    id: 'EQ-2023-112',
    name: 'Monitor de Signos Vitales',
    brand: 'Mindray',
    model: 'BeneVision N17',
    serialNumber: 'SN-91024',
    inventoryCode: 'CDN-BIO-2023-112',
    service: 'UCI Pediátrica',
    specificLocation: 'Cama 2',
    status: 'Operativo',
    riskClass: 'IIB',
    lastMaintenanceDate: '2023-10-20',
    frequencyMonths: 6
  },
  {
    id: 'EQ-2023-045',
    name: 'Bomba de Infusión',
    brand: 'Fresenius Kabi',
    model: 'Volumat MC Agilia',
    serialNumber: 'SN-33981',
    inventoryCode: 'CDN-BIO-2023-045',
    service: 'Hospitalización',
    specificLocation: 'Piso 3 Ala Norte',
    status: 'Operativo',
    riskClass: 'IIB',
    lastMaintenanceDate: '2023-10-18',
    frequencyMonths: 6
  },
  {
    id: 'EQ-2023-001',
    name: 'Ventilator V60',
    brand: 'Philips',
    model: 'V60',
    serialNumber: 'SN-89234',
    inventoryCode: 'CDN-BIO-2023-089',
    service: 'UCI',
    specificLocation: 'Cama 4',
    status: 'Operativo',
    riskClass: 'III',
    lastMaintenanceDate: '2023-10-27',
    frequencyMonths: 6
  },
  {
    id: 'EQ-2023-002',
    name: 'MRI Optima 450w',
    brand: 'GE Healthcare',
    model: 'Optima 450w 1.5T',
    serialNumber: 'SN-78412',
    inventoryCode: 'CDN-BIO-2021-012',
    service: 'Imágenes Diagnósticas',
    specificLocation: 'Sala Resonancia 1',
    status: 'En Espera de Repuestos',
    riskClass: 'III',
    lastMaintenanceDate: '2023-10-26',
    frequencyMonths: 3
  }
];

class IndexedDBManager {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store: Maintenance Records
        if (!db.objectStoreNames.contains(STORES.RECORDS)) {
          const recordStore = db.createObjectStore(STORES.RECORDS, { keyPath: 'id' });
          recordStore.createIndex('date', 'date', { unique: false });
          recordStore.createIndex('equipment', 'equipment', { unique: false });
          recordStore.createIndex('brand', 'brand', { unique: false });
          recordStore.createIndex('service', 'service', { unique: false });
          recordStore.createIndex('finalStatus', 'finalStatus', { unique: false });
          recordStore.createIndex('maintenanceType', 'maintenanceType', { unique: false });
          recordStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Store: Equipments Inventory
        if (!db.objectStoreNames.contains(STORES.EQUIPMENTS)) {
          const equipStore = db.createObjectStore(STORES.EQUIPMENTS, { keyPath: 'id' });
          equipStore.createIndex('serialNumber', 'serialNumber', { unique: false });
          equipStore.createIndex('inventoryCode', 'inventoryCode', { unique: false });
          equipStore.createIndex('service', 'service', { unique: false });
        }

        // Store: Settings
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }
      };

      request.onsuccess = async (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Check if database needs seeding
        await this.seedInitialDataIfNeeded(db);
        resolve(db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  private async seedInitialDataIfNeeded(db: IDBDatabase): Promise<void> {
    return new Promise((resolve) => {
      const tx = db.transaction([STORES.RECORDS, STORES.EQUIPMENTS], 'readwrite');
      const recordStore = tx.objectStore(STORES.RECORDS);
      const countReq = recordStore.count();

      countReq.onsuccess = () => {
        if (countReq.result === 0) {
          // Populate initial records
          INITIAL_RECORDS.forEach((rec) => recordStore.put(rec));
          const equipStore = tx.objectStore(STORES.EQUIPMENTS);
          INITIAL_EQUIPMENTS.forEach((eq) => equipStore.put(eq));
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // continue gracefully
    });
  }

  // --- Records Operations ---
  async getAllRecords(): Promise<MaintenanceRecord[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.RECORDS, 'readonly');
      const store = tx.objectStore(STORES.RECORDS);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = (request.result as MaintenanceRecord[]).sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        );
        resolve(records);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getRecordById(id: string): Promise<MaintenanceRecord | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.RECORDS, 'readonly');
      const store = tx.objectStore(STORES.RECORDS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async addRecord(record: Omit<MaintenanceRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<MaintenanceRecord> {
    const db = await this.openDB();
    const now = Date.now();
    const year = new Date().getFullYear();
    
    // Generate sequential or random realistic ID like #MN-2023-XXXX
    const generatedId = record.id || `#MN-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

    const fullRecord: MaintenanceRecord = {
      ...record,
      id: generatedId,
      createdAt: now,
      updatedAt: now,
      syncedOffline: true
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.RECORDS, STORES.EQUIPMENTS], 'readwrite');
      const store = tx.objectStore(STORES.RECORDS);
      const request = store.put(fullRecord);

      // Also ensure equipment is recorded/updated
      const equipStore = tx.objectStore(STORES.EQUIPMENTS);
      const eqId = record.equipmentId || `EQ-${year}-${Math.floor(100 + Math.random() * 900)}`;
      
      const equipObj: Equipment = {
        id: eqId,
        name: record.equipment,
        brand: record.brand,
        model: record.model,
        serialNumber: record.serialNumber,
        inventoryCode: record.inventoryCode,
        service: record.service,
        specificLocation: record.specificLocation,
        status: record.finalStatus,
        riskClass: 'IIB',
        lastMaintenanceDate: record.date,
        frequencyMonths: 6
      };
      equipStore.put(equipObj);

      tx.oncomplete = () => resolve(fullRecord);
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateRecord(record: MaintenanceRecord): Promise<MaintenanceRecord> {
    const db = await this.openDB();
    const updatedRecord: MaintenanceRecord = {
      ...record,
      updatedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.RECORDS, 'readwrite');
      const store = tx.objectStore(STORES.RECORDS);
      const request = store.put(updatedRecord);

      request.onsuccess = () => resolve(updatedRecord);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecord(id: string): Promise<boolean> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.RECORDS, 'readwrite');
      const store = tx.objectStore(STORES.RECORDS);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Equipment Operations ---
  async getAllEquipments(): Promise<Equipment[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.EQUIPMENTS, 'readonly');
      const store = tx.objectStore(STORES.EQUIPMENTS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async addEquipment(equipment: Equipment): Promise<Equipment> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.EQUIPMENTS, 'readwrite');
      const store = tx.objectStore(STORES.EQUIPMENTS);
      const request = store.put(equipment);

      request.onsuccess = () => resolve(equipment);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Stats and Analytics ---
  async getDatabaseStats(): Promise<DatabaseStats> {
    const records = await this.getAllRecords();
    const equipments = await this.getAllEquipments();

    let preventive = 0;
    let corrective = 0;
    let other = 0;
    let operational = 0;
    let pendingParts = 0;
    let outOfService = 0;

    records.forEach((r) => {
      if (r.maintenanceType === 'Preventivo') preventive++;
      else if (r.maintenanceType === 'Correctivo') corrective++;
      else other++;

      if (r.finalStatus === 'Operativo' || r.finalStatus === 'Calibrado') operational++;
      else if (r.finalStatus === 'En Espera de Repuestos') pendingParts++;
      else if (r.finalStatus === 'Fuera de Servicio') outOfService++;
    });

    return {
      totalRecords: records.length,
      preventiveCount: preventive,
      correctiveCount: corrective,
      otherCount: other,
      operationalCount: operational,
      pendingPartsCount: pendingParts,
      outOfServiceCount: outOfService,
      totalEquipments: equipments.length,
      lastSyncTimestamp: Date.now()
    };
  }

  // --- Backup & Restore ---
  async exportBackupJSON(): Promise<string> {
    const records = await this.getAllRecords();
    const equipments = await this.getAllEquipments();
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      institution: 'Clínica del Niño',
      records,
      equipments
    };
    return JSON.stringify(backup, null, 2);
  }

  async importBackupJSON(jsonString: string): Promise<{ recordsImported: number; equipmentsImported: number }> {
    const data = JSON.parse(jsonString);
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.RECORDS, STORES.EQUIPMENTS], 'readwrite');
      const recordStore = tx.objectStore(STORES.RECORDS);
      const equipStore = tx.objectStore(STORES.EQUIPMENTS);

      let rCount = 0;
      let eCount = 0;

      if (Array.isArray(data.records)) {
        data.records.forEach((rec: MaintenanceRecord) => {
          recordStore.put(rec);
          rCount++;
        });
      }

      if (Array.isArray(data.equipments)) {
        data.equipments.forEach((eq: Equipment) => {
          equipStore.put(eq);
          eCount++;
        });
      }

      tx.oncomplete = () => resolve({ recordsImported: rCount, equipmentsImported: eCount });
      tx.onerror = () => reject(tx.error);
    });
  }

  async resetToDemoData(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.RECORDS, STORES.EQUIPMENTS], 'readwrite');
      const recordStore = tx.objectStore(STORES.RECORDS);
      const equipStore = tx.objectStore(STORES.EQUIPMENTS);

      recordStore.clear();
      equipStore.clear();

      INITIAL_RECORDS.forEach((rec) => recordStore.put(rec));
      INITIAL_EQUIPMENTS.forEach((eq) => equipStore.put(eq));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const dbManager = new IndexedDBManager();
