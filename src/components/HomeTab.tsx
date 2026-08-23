import React, { useState } from 'react';
import { 
  Plus, 
  FileText, 
  ChevronRight, 
  Download, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Activity, 
  Sparkles,
  Search,
  Building2,
  HardDrive
} from 'lucide-react';
import {
  MaintenanceRecord,
  Equipment,
  ActiveTab,
  UserProfile,
  grupoEstado,
  etiquetaReporte,
} from '../types';
import { exportAnnualReportToExcel, exportMonthlyReportToExcel, exportMaintenanceRecordsToExcel } from '../utils/excelExport';

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
  equipments,
  onNavigateTab,
  onSelectRecord,
  onOpenAnnualModal,
  onOpenNewEquipmentModal
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const recentRecords = records.slice(0, 6);

  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleQuickAnnualDownload = () => {
    exportAnnualReportToExcel(records, currentYear);
    setDownloadSuccess(`Descargado informe consolidado anual ${currentYear} en Excel.`);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleQuickMonthlyDownload = () => {
    exportMonthlyReportToExcel(records, currentYear, currentMonth);
    setDownloadSuccess(`Descargado reporte del mes en curso en Excel.`);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  return (
    <div className="pb-24 lg:pb-10 pt-4 px-4 max-w-md lg:max-w-none mx-auto space-y-5 animate-in fade-in duration-300">
      
      {/* Title & Greeting matching Image 7 */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Bienvenido, {user.name}
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Panel de control de ingeniería biomédica
        </p>
      </div>

      {/* Success Notification Alert */}
      {downloadSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{downloadSuccess}</span>
        </div>
      )}

      {/* Action Cards matching Image 7 */}
      <div className="space-y-3.5">
        
        {/* Card 1: Registrar equipo */}
        <button
          id="btn-card-register-equipment"
          onClick={() => onNavigateTab('registrar')}
          className="w-full text-left bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4.5 shadow-xs hover:shadow-md transition-all flex items-center justify-between group active:scale-[0.99]"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0 text-teal-600 group-hover:scale-105 transition-transform">
              <div className="w-7 h-7 rounded-full border-2 border-teal-500 flex items-center justify-center">
                <Plus className="w-4 h-4 text-teal-600 stroke-[3]" />
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                Registrar equipo
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Añadir nuevo equipamiento médico al inventario de la clínica.
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
        </button>

        {/* Card 2: Ver registros (Excel) */}
        <button
          id="btn-card-view-records-excel"
          onClick={() => onNavigateTab('documentos')}
          className="w-full text-left bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4.5 shadow-xs hover:shadow-md transition-all flex items-center justify-between group active:scale-[0.99]"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0 text-blue-600 group-hover:scale-105 transition-transform">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                Ver registros (Excel)
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Descargar o visualizar el historial completo en formato hoja de cálculo.
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
        </button>
      </div>

      {/* Quick Annual and Monthly Excel Download Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-300" />
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-200">
              Auditoría & Habilitación Anual
            </span>
          </div>
          <span className="px-2 py-0.5 bg-blue-700/80 text-[10px] font-bold rounded-full text-blue-100">
            Año {currentYear}
          </span>
        </div>
        <p className="text-xs text-blue-100/90 leading-relaxed">
          Descargue el reporte consolidado anual o mensual de todos los mantenimientos biomédicos para auditorías hospitalarias.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
          <button
            id="btn-quick-annual-excel"
            onClick={onOpenAnnualModal}
            className="w-full py-2 px-3 bg-white text-blue-900 hover:bg-sky-50 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Descarga Anual
          </button>
          <button
            id="btn-quick-monthly-excel"
            onClick={handleQuickMonthlyDownload}
            className="w-full py-2 px-3 bg-blue-700/80 hover:bg-blue-700 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Descarga Mes
          </button>
        </div>
      </div>

      {/* Section: Registros Recientes matching Image 7 */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">
            Registros Recientes
          </h3>
          <button
            onClick={() => onNavigateTab('documentos')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
          >
            Ver todos ({records.length})
          </button>
        </div>

        {/* Table representation matching screenshot Image 7 */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          
          {/* Table Header */}
          <div className="grid grid-cols-12 bg-slate-50/80 px-4 py-3 border-b border-slate-200 text-xs font-bold text-slate-600">
            <div className="col-span-5">ID Equipo</div>
            <div className="col-span-7">Tipo</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-slate-100">
            {recentRecords.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No hay registros aún. Presione "Registrar" para añadir uno.
              </div>
            ) : (
              recentRecords.map((item, idx) => (
                <div
                  key={item.id}
                  id={`row-recent-record-${idx}`}
                  onClick={() => onSelectRecord(item)}
                  className="grid grid-cols-12 px-4 py-3.5 items-center text-xs hover:bg-blue-50/40 cursor-pointer transition-colors"
                >
                  <div className="col-span-5 font-mono font-medium text-slate-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                    <span>{etiquetaReporte(item)}</span>
                  </div>
                  <div className="col-span-7 text-slate-700 flex items-center justify-between">
                    <span className="font-medium truncate pr-2">{item.equipment}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                        grupoEstado(item.finalStatus) === 'funcional'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : grupoEstado(item.finalStatus) === 'espera'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {({
                        funcional: 'Funcional',
                        espera: 'Repuestos',
                        fuera: 'Fuera serv.',
                        'sin-dato': 'Sin estado',
                      } as const)[grupoEstado(item.finalStatus)]}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>

      {/* Local IndexedDB Persistence Status Card */}
      <div className="bg-slate-100/80 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Base de datos local IndexedDB: <strong>{records.length} registros guardados</strong></span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded-md">
          <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-ping"></span>
          Offline OK
        </span>
      </div>

    </div>
  );
};
