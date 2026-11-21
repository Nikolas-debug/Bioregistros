import React, { useState } from 'react';
import { FileSpreadsheet, Download, CheckCircle2 } from 'lucide-react';
import { Campo, Sheet } from './ui';
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
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Available years from records
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

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

  const nombrePeriodo =
    selectedMonth === 0 ? `Informe anual ${selectedYear}` : `${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`;

  return (
    <Sheet
      titulo="Descarga anual de registros"
      subtitulo="Informe oficial en formato Excel (.xlsx)"
      icono={<FileSpreadsheet className="size-5" />}
      onClose={onClose}
      pie={
        <>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cerrar
          </button>
          <button id="btn-download-annual-excel" type="button" onClick={handleDownload} className="btn btn-ink min-w-0 flex-1 px-4">
            <Download className="size-4 shrink-0" />
            <span className="truncate">
              Descargar <span className="hidden sm:inline">{nombrePeriodo}</span>
              <span className="sm:hidden">Excel</span>
            </span>
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Año de auditoría">
          {(id) => (
            <select id={id} value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="input">
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Periodo / mes">
          {(id) => (
            <select id={id} value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="input">
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.value === 0 ? 'Todo el año' : m.label}</option>
              ))}
            </select>
          )}
        </Campo>
      </div>

      <section className="soft mt-5 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-base font-medium text-slate-900">Resumen del periodo</h3>
          <span className="text-sm font-bold text-slate-900 tabular-nums">
            {periodRecords.length} intervenciones
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2.5">
          {[
            ['Preventivos', preventivos],
            ['Correctivos', correctivos],
            ['Operativos', operativos],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta} className="rounded-2xl bg-white p-3">
              <dt className="kv-label">{etiqueta}</dt>
              <dd className="mt-1 text-2xl font-medium text-slate-900 tabular-nums">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[13px] leading-relaxed text-slate-600">
          El archivo incluye la carátula institucional de la Clínica del Niño, la hoja completa de
          intervenciones y la hoja de indicadores para habilitación en salud.
        </p>
      </section>

      {downloadSuccess && (
        <div className="notice notice-ok mt-4" role="status">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-700" />
          <span>¡Archivo Excel generado y descargado en su dispositivo!</span>
        </div>
      )}
    </Sheet>
  );
};
