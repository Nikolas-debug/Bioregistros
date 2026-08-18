import * as XLSX from 'xlsx';
import { MaintenanceRecord, Equipment } from '../types';

export interface ExportFilterOptions {
  year?: number;
  month?: number; // 1-12
  service?: string;
  brand?: string;
  type?: string;
}

export function exportMaintenanceRecordsToExcel(
  records: MaintenanceRecord[],
  fileName: string = 'Reporte_Mantenimiento_Biomedico.xlsx',
  customTitle?: string
) {
  const wb = XLSX.utils.book_new();

  // 1. Prepare Main Sheet Data
  const sheetData = records.map((r, index) => ({
    'Ítem': index + 1,
    'Código Registro': r.id,
    'Código Inventario': r.inventoryCode,
    'Equipo': r.equipment,
    'Marca': r.brand,
    'Modelo': r.model,
    'N° de Serie': r.serialNumber,
    'Servicio Hospitalario': r.service,
    'Ubicación Específica': r.specificLocation,
    'Fecha Intervención': r.date,
    'Hora': r.time || 'N/A',
    'Tipo Mantenimiento': r.maintenanceType,
    'Estado Final': r.finalStatus,
    'Repuestos Utilizados': r.spareParts || 'Ninguno',
    'Trabajo Realizado / Falla': r.failureComments,
    'Observaciones / Recomendaciones': r.additionalObservations || 'Ninguna',
    'Ingeniero Biomédico': r.technicianName,
    'Tarjeta Profesional': r.technicianCard || 'T.P. BIO-88942'
  }));

  const ws = XLSX.utils.json_to_sheet(sheetData);

  // Set column widths for comfortable reading
  ws['!cols'] = [
    { wch: 6 },  // Ítem
    { wch: 16 }, // Código Registro
    { wch: 20 }, // Código Inventario
    { wch: 26 }, // Equipo
    { wch: 18 }, // Marca
    { wch: 18 }, // Modelo
    { wch: 16 }, // N° de Serie
    { wch: 22 }, // Servicio Hospitalario
    { wch: 22 }, // Ubicación Específica
    { wch: 16 }, // Fecha Intervención
    { wch: 10 }, // Hora
    { wch: 18 }, // Tipo Mantenimiento
    { wch: 22 }, // Estado Final
    { wch: 30 }, // Repuestos
    { wch: 40 }, // Trabajo Realizado
    { wch: 35 }, // Observaciones
    { wch: 20 }, // Ingeniero
    { wch: 20 }  // Tarjeta Prof
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Mantenimientos');

  // 2. Add KPI / Statistical Summary Sheet
  const total = records.length;
  const preventivos = records.filter(r => r.maintenanceType === 'Preventivo').length;
  const correctivos = records.filter(r => r.maintenanceType === 'Correctivo').length;
  const otros = records.filter(r => r.maintenanceType === 'Otro').length;
  
  const operativos = records.filter(r => r.finalStatus === 'Operativo' || r.finalStatus === 'Calibrado').length;
  const esperaRepuestos = records.filter(r => r.finalStatus === 'En Espera de Repuestos').length;
  const fueraServicio = records.filter(r => r.finalStatus === 'Fuera de Servicio').length;

  const summaryData = [
    { 'Métrica de Control Biomédico': 'Institución', 'Valor': 'Clínica del Niño - Departamento Biomédico' },
    { 'Métrica de Control Biomédico': 'Título del Informe', 'Valor': customTitle || 'Historial de Mantenimientos' },
    { 'Métrica de Control Biomédico': 'Fecha de Generación', 'Valor': new Date().toLocaleDateString('es-ES', { dateStyle: 'full' }) },
    { 'Métrica de Control Biomédico': 'Total de Intervenciones Registradas', 'Valor': total },
    { 'Métrica de Control Biomédico': 'Mantenimientos Preventivos', 'Valor': `${preventivos} (${total ? ((preventivos / total) * 100).toFixed(1) : 0}%)` },
    { 'Métrica de Control Biomédico': 'Mantenimientos Correctivos', 'Valor': `${correctivos} (${total ? ((correctivos / total) * 100).toFixed(1) : 0}%)` },
    { 'Métrica de Control Biomédico': 'Otros Mantenimientos / Calibración', 'Valor': `${otros} (${total ? ((otros / total) * 100).toFixed(1) : 0}%)` },
    { 'Métrica de Control Biomédico': 'Equipos Operativos / Calibrados', 'Valor': `${operativos} (${total ? ((operativos / total) * 100).toFixed(1) : 0}%)` },
    { 'Métrica de Control Biomédico': 'Equipos en Espera de Repuestos', 'Valor': `${esperaRepuestos} (${total ? ((esperaRepuestos / total) * 100).toFixed(1) : 0}%)` },
    { 'Métrica de Control Biomédico': 'Equipos Fuera de Servicio', 'Valor': `${fueraServicio} (${total ? ((fueraServicio / total) * 100).toFixed(1) : 0}%)` }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Estadístico');

  // Trigger browser download
  XLSX.writeFile(wb, fileName);
}

export function exportAnnualReportToExcel(records: MaintenanceRecord[], year: number) {
  const filtered = records.filter(r => {
    if (!r.date) return false;
    const recYear = new Date(r.date).getFullYear();
    return recYear === year;
  });

  const fileName = `Informe_Anual_Mantenimiento_Biomedico_${year}_ClinicaDelNino.xlsx`;
  const customTitle = `Informe Consolidado Anual de Mantenimiento Biomédico - Año ${year}`;
  
  exportMaintenanceRecordsToExcel(
    filtered.length > 0 ? filtered : records,
    fileName,
    customTitle
  );
}

export function exportMonthlyReportToExcel(records: MaintenanceRecord[], year: number, month: number) {
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const filtered = records.filter(r => {
    if (!r.date) return false;
    const parts = r.date.split('-');
    const rYear = parseInt(parts[0], 10);
    const rMonth = parseInt(parts[1], 10);
    return rYear === year && rMonth === month;
  });

  const monthName = monthNames[month - 1] || `Mes_${month}`;
  const fileName = `Reporte_Mensual_${monthName}_${year}_ClinicaDelNino.xlsx`;
  const customTitle = `Registro Mensual de Mantenimiento Biomédico - ${monthName} ${year}`;

  exportMaintenanceRecordsToExcel(filtered, fileName, customTitle);
}

export function exportSingleRecordToExcel(record: MaintenanceRecord) {
  const fileName = `Ficha_Mantenimiento_${record.id.replace(/[^a-zA-Z0-9_-]/g, '_')}_${record.equipment.replace(/\s+/g, '_')}.xlsx`;
  exportMaintenanceRecordsToExcel([record], fileName, `Ficha Individual de Intervención: ${record.id}`);
}
