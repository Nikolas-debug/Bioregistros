import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, 
  Upload, 
  Download, 
  Edit3, 
  FileSpreadsheet, 
  Calendar, 
  Filter, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Printer,
  Trash2,
  Eye,
  Plus,
  CornerDownLeft
} from 'lucide-react';
import {
  MaintenanceRecord,
  Equipment,
  grupoEstado,
  etiquetaReporte,
} from '../types';
import { 
  exportMaintenanceRecordsToExcel, 
  exportSingleRecordToExcel, 
  exportAnnualReportToExcel 
} from '../utils/excelExport';

interface DocumentsTabProps {
  records: MaintenanceRecord[];
  onSelectRecord: (record: MaintenanceRecord) => void;
  onEditRecord: (record: MaintenanceRecord) => void;
  onDeleteRecord: (id: string) => Promise<void>;
  onImportBackup: (file: File) => Promise<void>;
  onOpenAnnualModal: () => void;
  onNewRecord: () => void;
  /** Abre el modal de carga masiva desde Excel. */
  onOpenBulkImport?: () => void;
  /** Abre el modal para insertar un reporte olvidado. */
  onOpenInsertarReporte?: () => void;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({
  records,
  onSelectRecord,
  onEditRecord,
  onDeleteRecord,
  onImportBackup,
  onOpenAnnualModal,
  onNewRecord,
  onOpenBulkImport,
  onOpenInsertarReporte
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedEquipmentType, setSelectedEquipmentType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract unique brands and equipment names for filters
  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    records.forEach(r => { if (r.brand) brands.add(r.brand); });
    return ['All', ...Array.from(brands)];
  }, [records]);

  const uniqueEquipments = useMemo(() => {
    const equips = new Set<string>();
    records.forEach(r => { if (r.equipment) equips.add(r.equipment); });
    return ['All', ...Array.from(equips)];
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Search
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        r.id.toLowerCase().includes(searchLower) ||
        r.equipment.toLowerCase().includes(searchLower) ||
        r.brand.toLowerCase().includes(searchLower) ||
        r.model.toLowerCase().includes(searchLower) ||
        r.serialNumber.toLowerCase().includes(searchLower) ||
        r.technicianName.toLowerCase().includes(searchLower) ||
        r.service.toLowerCase().includes(searchLower);

      // Brand filter
      const matchesBrand = selectedBrand === 'All' || r.brand === selectedBrand;

      // Equipment filter
      const matchesEquipment = selectedEquipmentType === 'All' || r.equipment === selectedEquipmentType;

      // Status filter
      // Se compara por grupo, no por texto exacto: el seguimiento trae
      // "FUNCIONAL" escrito de muchas formas y a veces con el nombre de un
      // repuesto en esa casilla.
      const matchesStatus =
        selectedStatus === 'All' || grupoEstado(r.finalStatus) === selectedStatus;

      return matchesSearch && matchesBrand && matchesEquipment && matchesStatus;
    });
  }, [records, searchTerm, selectedBrand, selectedEquipmentType, selectedStatus]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  const handleDownloadAllFiltered = () => {
    const currentYear = new Date().getFullYear();
    exportMaintenanceRecordsToExcel(
      filteredRecords,
      `Mantenimientos_Filtrados_ClinicaDelNino_${currentYear}.xlsx`,
      `Registros de Mantenimiento Biomédico - Exportación Filtrada`
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
    }
  };

  return (
    <div className="pb-28 lg:pb-10 pt-4 px-4 max-w-md lg:max-w-none mx-auto space-y-4.5 animate-in fade-in duration-200">
      
      {/* Title & Subtitle matching Image 3 */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Registro de mantenimientos
        </h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Registra, filtra y exporta el historial de mantenimientos
        </p>
      </div>

      {/* Insertar un reporte olvidado: renumera los posteriores, asi que
          va aparte del registro normal y con su propio color. */}
      {onOpenInsertarReporte && (
        <button
          type="button"
          onClick={onOpenInsertarReporte}
          className="w-full flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-left transition hover:bg-amber-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
            <CornerDownLeft className="h-4.5 w-4.5 text-amber-700" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-amber-900">
              Insertar un reporte olvidado
            </span>
            <span className="block text-[11px] text-amber-700/80">
              Se ubica en el número que usted indique y corre los siguientes
            </span>
          </span>
        </button>
      )}

      {/* Registro masivo desde Excel */}
      {onOpenBulkImport && (
        <button
          type="button"
          onClick={onOpenBulkImport}
          className="w-full flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-left transition hover:bg-emerald-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
            <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-700" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-emerald-900">
              Registro masivo desde Excel
            </span>
            <span className="block text-[11px] text-emerald-700/80">
              Importe muchos mantenimientos de una hoja de cálculo
            </span>
          </span>
        </button>
      )}

      {/* Hidden File Input for Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json,.xlsx,.csv"
        className="hidden"
      />

      {/* Top Action Buttons matching Image 3 */}
      <div className="grid grid-cols-2 gap-3">
        
        {/* Import Button */}
        <button
          id="btn-import-records"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="py-3 px-4 bg-white border border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-blue-900 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-2xs transition-colors"
        >
          <Upload className="w-4 h-4 text-blue-700" />
          <span>Importar</span>
        </button>

        {/* Download Excel Button */}
        <button
          id="btn-download-excel"
          type="button"
          onClick={handleDownloadAllFiltered}
          className="py-3 px-4 bg-blue-900 hover:bg-blue-950 active:bg-blue-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Descargar Excel</span>
        </button>
      </div>

      {/* Annual Consolidation Button banner */}
      <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 rounded-xl px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-blue-700" />
          <span className="text-xs font-bold text-blue-950">Descarga Anual de Registros</span>
        </div>
        <button
          id="btn-open-annual-modal"
          onClick={onOpenAnnualModal}
          className="text-xs bg-blue-700 hover:bg-blue-800 text-white font-bold px-3 py-1 rounded-lg transition-colors shadow-2xs"
        >
          Exportar Año
        </button>
      </div>

      {/* Search & Filter Container matching Image 3 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs space-y-2.5">
        
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="input-search-records"
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Busqueda por nombre, numero de serie, etc..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent font-medium"
          />
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 gap-2">
          
          {/* Brand Filter */}
          <div>
            <select
              id="select-filter-brand"
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            >
              <option value="All">Todas las marcas</option>
              {uniqueBrands.filter(b => b !== 'All').map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Equipment Filter */}
          <div>
            <select
              id="select-filter-equipment"
              value={selectedEquipmentType}
              onChange={(e) => {
                setSelectedEquipmentType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            >
              <option value="All">Todos los equipos</option>
              {uniqueEquipments.filter(e => e !== 'All').map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

        </div>

      </div>

      {/* Record Cards List matching Image 3 */}
      <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:items-start">
        {paginatedRecords.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
            <p className="text-xs text-slate-500">No se encontraron registros que coincidan con la búsqueda.</p>
            <button
              onClick={onNewRecord}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
            >
              <Plus className="w-3.5 h-3.5" /> Crear Nuevo Registro
            </button>
          </div>
        ) : (
          paginatedRecords.map((record) => {
            const isCompleted = grupoEstado(record.finalStatus) === 'funcional';
            const isPending = grupoEstado(record.finalStatus) === 'espera';
            
            return (
              <div
                key={record.id}
                id={`card-record-${record.id}`}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow space-y-3"
              >
                {/* Card Header: ID & Status Badge */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-900">
                    {etiquetaReporte(record)}
                  </span>
                  
                  {/* Status Pill Badge matching image */}
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle className="w-3 h-3" />
                      Operativo
                    </span>
                  ) : isPending ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      <AlertTriangle className="w-3 h-3" />
                      En espera de repuestos
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      <XCircle className="w-3 h-3" />
                      Fuera de servicio
                    </span>
                  )}
                </div>

                {/* Equipment Title and Brand • Date */}
                <div>
                  <h4 className="text-base font-bold text-slate-900 leading-snug">
                    {record.equipment}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {record.brand} • {record.date} • <span className="text-slate-700 font-medium">{record.service}</span>
                  </p>
                </div>

                {/* Subtle Divider */}
                <hr className="border-slate-100" />

                {/* Action Buttons: Edit & Export matching Image 3 */}
                <div className="flex items-center justify-end gap-2 pt-0.5">
                  <button
                    id={`btn-view-${record.id}`}
                    onClick={() => onSelectRecord(record)}
                    className="py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ver</span>
                  </button>

                  <button
                    id={`btn-edit-${record.id}`}
                    onClick={() => onEditRecord(record)}
                    className="py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                    <span>Editar</span>
                  </button>

                  <button
                    id={`btn-export-${record.id}`}
                    onClick={() => exportSingleRecordToExcel(record)}
                    className="py-1.5 px-3 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-700 text-slate-800 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                    title="Exportar hoja técnica a Excel"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-700" />
                    <span>Exportar</span>
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer matching Image 3 */}
      {filteredRecords.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center justify-between text-xs text-slate-600 shadow-2xs overflow-x-auto">
          <div>
            Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredRecords.length)}-
            {Math.min(currentPage * itemsPerPage, filteredRecords.length)} de {filteredRecords.length} registros
          </div>

          <div className="flex items-center gap-1">
            <button
              id="btn-prev-page"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1 rounded-md text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-7 h-7 rounded-md font-bold text-xs flex items-center justify-center transition-colors ${
                  currentPage === pageNum
                    ? 'bg-blue-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              id="btn-next-page"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-1 rounded-md text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
