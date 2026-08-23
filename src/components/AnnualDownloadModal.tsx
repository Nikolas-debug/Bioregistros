import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  ShieldCheck, 
  BarChart3, 
  Building2,
  FileCheck
} from 'lucide-react';
import {
  MaintenanceRecord,
  grupoEstado,
} from '../types';
import { exportAnnualReportToExcel, exportMonthlyReportToExcel } from '../utils/excelExport';

interface AnnualDownloadModalProps {
  records: MaintenanceRecord[];
  onClose: () => void;
}

const MONTHS = [
  { value: 0, label: 'Todo el Año (Consolidado 12 Meses)' },
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

export const AnnualDownloadModal: React.FC<AnnualDownloadModalProps> = ({
  records,
  onClose
}) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(2023); // 2023 matches mock data year, user can change to 2024, 2025, 2026
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Available years from records
  const availableYears = [2026, 2025, 2024, 2023, 2022];

  // Filter records for preview stats
  const periodRecords = records.filter(r => {
    if (!r.date) return false;
    const parts = r.date.split('-');
    const rYear = parseInt(parts[0], 10);
    const rMonth = parseInt(parts[1], 10);

    if (rYear !== selectedYear) return false;
    if (selectedMonth !== 0 && rMonth !== selectedMonth) return false;
    return true;
  });

  // Las tres casillas son independientes: una fila puede contar en dos.
  const preventivos = periodRecords.filter(r => r.preventivo).length;
  const correctivos = periodRecords.filter(r => r.correctivo).length;
  const operativos = periodRecords.filter(r => grupoEstado(r.finalStatus) === 'funcional').length;

  const handleDownload = () => {
    if (selectedMonth === 0) {
      exportAnnualReportToExcel(periodRecords.length > 0 ? periodRecords : records, selectedYear);
    } else {
      exportMonthlyReportToExcel(periodRecords.length > 0 ? periodRecords : records, selectedYear, selectedMonth);
    }
    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-700/70 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h3 className="font-bold text-base">Descarga Anual de Registros</h3>
              <p className="text-xs text-blue-200">Informe oficial en formato Excel (.xlsx)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-blue-200 hover:text-white hover:bg-blue-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          
          {/* Year & Month Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Año de Auditoría
              </label>
              <select
                id="select-annual-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    Año {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Periodo / Mes
              </label>
              <select
                id="select-annual-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Period Preview Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-blue-600" /> Resumen del Periodo
              </span>
              <span className="font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                {periodRecords.length} intervenciones
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-medium block">Preventivos</span>
                <span className="text-sm font-bold text-emerald-600">{preventivos}</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-medium block">Correctivos</span>
                <span className="text-sm font-bold text-amber-600">{correctivos}</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-medium block">Operativos</span>
                <span className="text-sm font-bold text-blue-600">{operativos}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              El archivo Excel exportado incluirá: Carátula institucional de la Clínica del Niño, hoja completa de intervenciones, y hoja de indicadores estadísticos (KPIs) para habilitación en salud.
            </p>
          </div>

          {/* Download Success */}
          {downloadSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>¡Archivo Excel generado y descargado con éxito en su dispositivo!</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              id="btn-download-annual-excel"
              type="button"
              onClick={handleDownload}
              className="w-full py-3.5 px-4 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-700/20 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>
                {selectedMonth === 0
                  ? `Descargar Informe Anual ${selectedYear} (Excel)`
                  : `Descargar Reporte ${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear} (Excel)`}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-slate-500 hover:text-slate-800 font-medium text-xs text-center"
            >
              Cerrar
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
