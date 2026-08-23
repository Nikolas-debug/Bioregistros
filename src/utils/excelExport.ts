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
  // Las columnas siguen el seguimiento en papel de la clinica, para que el
  // archivo exportado se pueda pegar junto a los meses anteriores.
  const sheetData = records.map((r) => ({
    'FECHA': r.date,
    'REPORTE': r.numeroReporte ?? '',
    'EQUIPO': r.equipment,
    'MARCA': r.brand,
    'MODELO': r.model,
    'SERIE': r.serialNumber,
    'SERVICIO': r.service,
    'UBICACION': r.specificLocation,
    'INVENTARIO': r.inventoryCode,
    'PREVENTIVO': r.preventivo ? 'X' : '',
    'CORRECTIVO': r.correctivo ? 'X' : '',
    'OTRO': r.otro ? 'X' : '',
    'DESCRIPCION': r.failureComments,
    'OBSERVACIONES': r.additionalObservations,
    'ESTADO': r.finalStatus,
    'REPUESTOS': r.spareParts,
    'TECNICO': r.technicianName
  }));


  const ws = XLSX.utils.json_to_sheet(sheetData);

  // Set column widths for comfortable reading
  ws['!cols'] = [
    { wch: 12 },  // FECHA
    { wch: 10 },  // REPORTE
    { wch: 28 },  // EQUIPO
    { wch: 20 },  // MARCA
    { wch: 18 },  // MODELO
    { wch: 22 },  // SERIE
    { wch: 20 },  // SERVICIO
    { wch: 18 },  // UBICACION
    { wch: 18 },  // INVENTARIO
    { wch: 12 },  // PREVENTIVO
    { wch: 12 },  // CORRECTIVO
    { wch: 8 },   // OTRO
    { wch: 40 },  // DESCRIPCION
    { wch: 40 },  // OBSERVACIONES
    { wch: 22 },  // ESTADO
    { wch: 26 },  // REPUESTOS
    { wch: 22 }   // TECNICO
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Mantenimientos');

  // 2. Add KPI / Statistical Summary Sheet
  const total = records.length;
  // Independientes: una fila con dos casillas marcadas cuenta en las dos.
  const preventivos = records.filter(r => r.preventivo).length;
  const correctivos = records.filter(r => r.correctivo).length;
  const otros = records.filter(r => r.otro).length;
  
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
  const referencia = record.numeroReporte ? `Reporte_${record.numeroReporte}` : 'Sin_reporte';
  const fileName = `Ficha_${referencia}_${record.equipment.replace(/\s+/g, '_')}.xlsx`;

  exportMaintenanceRecordsToExcel(
    [record],
    fileName,
    record.numeroReporte
      ? `Ficha del reporte ${record.numeroReporte}`
      : 'Ficha de intervención (sin número de reporte asignado)'
  );
}
