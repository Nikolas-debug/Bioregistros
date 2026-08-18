export type MaintenanceStatus = 'Operativo' | 'En Espera de Repuestos' | 'Fuera de Servicio' | 'Calibrado';

export type MaintenanceType = 'Preventivo' | 'Correctivo' | 'Otro';

export type HospitalService = 
  | 'UCI'
  | 'UCI Neonatal'
  | 'UCI Pediátrica'
  | 'Urgencias'
  | 'Quirófano'
  | 'Hospitalización'
  | 'Imágenes Diagnósticas'
  | 'Laboratorio Clínico'
  | 'Consulta Externa'
  | 'Central de Esterilización';

export interface MaintenanceRecord {
  id: string; // e.g. "MN-2023-1142"
  equipmentId?: string; // e.g. "EQ-2023-081"
  equipment: string; // e.g. "Ventilator V60"
  brand: string; // e.g. "Philips"
  model: string; // e.g. "V60"
  serialNumber: string; // e.g. "SN-89234"
  service: HospitalService | string;
  specificLocation: string; // e.g. "Cama 4"
  inventoryCode: string; // e.g. "CDN-BIO-2023-089"
  date: string; // YYYY-MM-DD
  time?: string;
  finalStatus: MaintenanceStatus;
  maintenanceType: MaintenanceType;
  spareParts: string;
  failureComments: string;
  additionalObservations: string;
  technicianName: string;
  technicianCard?: string;
  createdAt: number;
  updatedAt: number;
  syncedOffline?: boolean;
}

export interface Equipment {
  id: string; // e.g. "EQ-2023-081"
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  inventoryCode: string;
  service: HospitalService | string;
  specificLocation: string;
  status: MaintenanceStatus;
  riskClass: 'I' | 'IIA' | 'IIB' | 'III';
  lastMaintenanceDate?: string;
  frequencyMonths: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  institution: string;
  professionalCard: string;
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
  lastSyncTimestamp: number;
}

export type ActiveTab = 'inicio' | 'registrar' | 'documentos';
