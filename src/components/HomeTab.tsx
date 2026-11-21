import React, { useState } from 'react';
import { Plus, ChevronRight, Download, CheckCircle2, HardDrive, FileText } from 'lucide-react';
import { MaintenanceRecord, Equipment, ActiveTab, UserProfile, etiquetaReporte, fechaCorta } from '../types';
import { exportMonthlyReportToExcel } from '../utils/excelExport';
import { EstadoBadge } from './ui';

interface HomeTabProps {
  user: UserProfile;
  records: MaintenanceRecord[];
  equipments: Equipment[];
  onNavigateTab: (tab: ActiveTab) => void;
  onSelectRecord: (record: MaintenanceRecord) => void;
  onOpenAnnualModal: () => void;
  onOpenNewEquipmentModal: () => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  user,
  records,
  onNavigateTab,
  onSelectRecord,
  onOpenAnnualModal,
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const recentRecords = records.slice(0, 6);

  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleQuickMonthlyDownload = () => {
    exportMonthlyReportToExcel(records, currentYear, currentMonth);
    setDownloadSuccess('Descargado el reporte del mes en curso en Excel.');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  return (
    <div className="grid gap-4 px-4 pt-4 pb-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6 lg:px-8 lg:pt-6 lg:pb-12">

      {/* Columna de acción */}
      <div className="space-y-4">
        <section className="soft px-5 pt-6 pb-5 lg:px-7 lg:pt-8 lg:pb-7">
          <h1 className="t-display">Bienvenido, {user.name}</h1>
          <p className="t-lead mt-2">Panel de control de ingeniería biomédica</p>

          <div className="mt-6 grid gap-2.5">
            <button
              id="btn-card-register-equipment"
              onClick={() => onNavigateTab('registrar')}
              className="btn btn-lg btn-primary w-full"
            >
              <Plus className="size-5" strokeWidth={2.5} />
              Registrar mantenimiento
            </button>
            <button
              id="btn-card-view-records-excel"
              onClick={() => onNavigateTab('documentos')}
              className="btn btn-outline w-full"
            >
              <FileText className="size-4" />
              Ver historial
            </button>
          </div>
        </section>

        {downloadSuccess && (
          <div className="notice notice-ok" role="status">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-700" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        {/* Franja de auditoría */}
        <section className="strip p-6 lg:p-7">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg leading-snug font-medium">Auditoría y habilitación anual</h2>
            <span className="badge bg-white/15 text-white tabular-nums">{currentYear}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Descargue el reporte consolidado anual o mensual de todos los mantenimientos para
            auditorías hospitalarias.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2.5 [&>.btn]:px-3">
            <button
              id="btn-quick-annual-excel"
              onClick={onOpenAnnualModal}
              className="btn bg-white text-slate-900 hover:bg-slate-100"
            >
              <Download className="size-4" />
              Descarga anual
            </button>
            <button
              id="btn-quick-monthly-excel"
              onClick={handleQuickMonthlyDownload}
              className="btn border-2 border-white/35 text-white hover:bg-white/10"
            >
              <Download className="size-4" />
              Descarga mes
            </button>
          </div>
        </section>
      </div>

      {/* Registros recientes */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2 lg:px-6 lg:pt-6">
          <h2 className="text-lg leading-tight font-medium tracking-[-0.015em] lg:text-2xl">Registros recientes</h2>
          <button onClick={() => onNavigateTab('documentos')} className="btn-text -mr-2">
            Ver todos <span className="tabular-nums">({records.length})</span>
          </button>
        </div>

        {recentRecords.length === 0 ? (
          <div className="px-5 pt-6 pb-8 text-center lg:px-6">
            <p className="text-sm text-slate-500">No hay registros aún.</p>
            <button onClick={() => onNavigateTab('registrar')} className="btn btn-primary mt-4">
              <Plus className="size-4" /> Registrar el primero
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 pb-2">
            {recentRecords.map((item, idx) => (
              <li key={item.id}>
                <button
                  id={`row-recent-record-${idx}`}
                  onClick={() => onSelectRecord(item)}
                  className="flex w-full items-center gap-2.5 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 lg:px-6"
                >
                  <span className="w-10 shrink-0 text-[13px] font-bold text-slate-500 tabular-nums lg:w-12 lg:text-sm">
                    {etiquetaReporte(item)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-slate-900">
                      {item.equipment}
                    </span>
                    <span className="block truncate text-[13px] text-slate-500">
                      {item.service || 'Sin servicio'} · {fechaCorta(item.date)}
                    </span>
                  </span>
                  <EstadoBadge estado={item.finalStatus} corto />
                  <ChevronRight className="hidden size-4 shrink-0 text-slate-400 sm:block" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-start gap-2 border-t border-slate-100 px-5 py-3.5 text-[13px] text-slate-500 lg:px-6">
          <HardDrive className="mt-px size-4 shrink-0" />
          <span>
            Base de datos local:{' '}
            <strong className="font-bold text-slate-700 tabular-nums">{records.length} registros</strong>{' '}
            guardados · funciona sin conexión
          </span>
        </p>
      </section>
    </div>
  );
};
