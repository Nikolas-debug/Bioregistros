import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Upload,
  Download,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Plus,
  CornerDownLeft,
  CalendarRange,
} from 'lucide-react';
import { EstadoBadge } from './ui';
import { MaintenanceRecord, grupoEstado, etiquetaReporte, fechaCorta } from '../types';
import { exportMaintenanceRecordsToExcel } from '../utils/excelExport';

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

  const herramientas = [
    onOpenInsertarReporte && {
      id: 'insertar',
      Icono: CornerDownLeft,
      tono: 'bg-slate-900 text-white',
      titulo: 'Insertar un reporte olvidado',
      detalle: 'Se ubica en el número que usted indique y corre los siguientes',
      accion: onOpenInsertarReporte,
    },
    onOpenBulkImport && {
      id: 'masivo',
      Icono: FileSpreadsheet,
      tono: 'bg-slate-900 text-white',
      titulo: 'Registro masivo desde Excel',
      detalle: 'Importe muchos mantenimientos de una hoja de cálculo',
      accion: onOpenBulkImport,
    },
    {
      id: 'anual',
      Icono: CalendarRange,
      tono: 'bg-slate-900 text-white',
      titulo: 'Descarga anual de registros',
      detalle: 'Informe consolidado del año o de un mes en Excel',
      accion: onOpenAnnualModal,
    },
  ].filter(Boolean) as {
    id: string;
    Icono: typeof Search;
    tono: string;
    titulo: string;
    detalle: string;
    accion: () => void;
  }[];

  const FILTROS_ESTADO = [
    { id: 'All', etiqueta: 'Todos' },
    { id: 'funcional', etiqueta: 'Funcional' },
    { id: 'espera', etiqueta: 'Espera repuestos' },
    { id: 'fuera', etiqueta: 'Fuera de servicio' },
  ];

  return (
    <div className="space-y-5 px-4 pt-4 pb-32 lg:space-y-6 lg:px-8 lg:pt-6 lg:pb-12">

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="t-display">Registro de mantenimientos</h1>
          <p className="t-lead mt-2">Registra, filtra y exporta el historial de mantenimientos</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:flex">
          <button
            id="btn-import-records"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-ghost px-3"
          >
            <Upload className="size-4" />
            Importar
          </button>
          <button id="btn-download-excel" type="button" onClick={handleDownloadAllFiltered} className="btn btn-ink px-3">
            <Download className="size-4" />
            Descargar Excel
          </button>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json,.xlsx,.csv"
        className="hidden"
      />

      {/* Herramientas */}
      <div className="soft grid gap-1 p-2 lg:grid-cols-3">
        {herramientas.map(({ id, Icono, tono, titulo, detalle, accion }) => (
          <button
            key={id}
            id={id === 'anual' ? 'btn-open-annual-modal' : undefined}
            type="button"
            onClick={accion}
            className="flex items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-white active:bg-white"
          >
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tono}`}>
              <Icono className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-900">{titulo}</span>
              <span className="block text-[13px] leading-snug text-slate-500">{detalle}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-slate-400" />
          </button>
        ))}
      </div>

      {/* Búsqueda y filtros */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2.5 lg:flex-row">
          <label className="relative block flex-1">
            <span className="sr-only">Buscar registros</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-slate-500" />
            <input
              id="input-search-records"
              type="search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por equipo, serie, marca, servicio…"
              className="input rounded-full border-transparent bg-slate-100 pl-11 hover:border-transparent focus:bg-white"
            />
          </label>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:flex lg:w-[440px]">
            <label className="block lg:flex-1">
              <span className="sr-only">Marca</span>
              <select
                id="select-filter-brand"
                value={selectedBrand}
                onChange={(e) => {
                  setSelectedBrand(e.target.value);
                  setCurrentPage(1);
                }}
                className="input rounded-full"
              >
                <option value="All">Todas las marcas</option>
                {uniqueBrands.filter((b) => b !== 'All').map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>
            <label className="block lg:flex-1">
              <span className="sr-only">Equipo</span>
              <select
                id="select-filter-equipment"
                value={selectedEquipmentType}
                onChange={(e) => {
                  setSelectedEquipmentType(e.target.value);
                  setCurrentPage(1);
                }}
                className="input rounded-full"
              >
                <option value="All">Todos los equipos</option>
                {uniqueEquipments.filter((e) => e !== 'All').map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0" role="group" aria-label="Estado del equipo">
          {FILTROS_ESTADO.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={selectedStatus === f.id}
              onClick={() => {
                setSelectedStatus(f.id);
                setCurrentPage(1);
              }}
              className="pill-tab"
            >
              {f.etiqueta}
            </button>
          ))}
        </div>

        <p className="text-[13px] text-slate-500" aria-live="polite">
          <span className="font-bold text-slate-700 tabular-nums">{filteredRecords.length}</span> de{' '}
          <span className="tabular-nums">{records.length}</span> registros
        </p>
      </div>

      {/* Resultados */}
      {paginatedRecords.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <p className="text-[15px] font-bold text-slate-900">Sin resultados</p>
          <p className="mt-1 text-sm text-slate-500">
            No se encontraron registros que coincidan con la búsqueda.
          </p>
          <button onClick={onNewRecord} className="btn btn-primary mt-5">
            <Plus className="size-4" /> Crear nuevo registro
          </button>
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 overflow-hidden">
          {paginatedRecords.map((record) => (
            <li key={record.id} id={`card-record-${record.id}`}>
              <button
                id={`btn-view-${record.id}`}
                onClick={() => onSelectRecord(record)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 lg:px-6 lg:py-4"
              >
                <span className="w-10 shrink-0 text-[13px] font-bold text-slate-500 tabular-nums lg:w-12 lg:text-sm">
                  {etiquetaReporte(record)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[15px] leading-snug font-bold text-slate-900">{record.equipment}</span>
                  <span className="mt-0.5 block text-[13px] font-bold text-slate-700">{record.service || 'Sin servicio'}</span>
                  <span className="block text-[13px] text-slate-500">
                    {record.brand} · {fechaCorta(record.date)}
                  </span>
                </span>
                <span className="hidden sm:block">
                  <EstadoBadge estado={record.finalStatus} />
                </span>
                <span className="sm:hidden">
                  <EstadoBadge estado={record.finalStatus} corto />
                </span>
                <ChevronRight className="hidden size-4 shrink-0 text-slate-400 sm:block" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Paginación */}
      {filteredRecords.length > 0 && totalPages > 1 && (
        <nav aria-label="Páginas" className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-slate-500 tabular-nums">
            Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredRecords.length)}–
            {Math.min(currentPage * itemsPerPage, filteredRecords.length)} de {filteredRecords.length}
          </p>

          <div className="no-scrollbar flex max-w-full min-w-0 items-center gap-1 overflow-x-auto">
            <button
              id="btn-prev-page"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="btn-icon disabled:opacity-30"
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-5" />
            </button>

            {/* En el celular: primera, actual y última. Desde sm: también las vecinas. */}
            {[0, 1].map((vecinas) => (
              <div key={vecinas} className={`items-center gap-1 ${vecinas ? 'hidden sm:flex' : 'flex sm:hidden'}`}>
                {paginasVisibles(currentPage, totalPages, vecinas).map((pageNum, i) =>
                  pageNum === null ? (
                    <span key={`h${i}`} className="w-6 text-center text-sm text-slate-400" aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      aria-current={currentPage === pageNum ? 'page' : undefined}
                      aria-label={`Página ${pageNum}`}
                      className={`flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full px-2 text-sm font-bold tabular-nums transition-colors ${
                        currentPage === pageNum ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ),
                )}
              </div>
            ))}

            <button
              id="btn-next-page"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="btn-icon disabled:opacity-30"
              aria-label="Página siguiente"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};

/**
 * Qué números de página mostrar: la primera, la última, la actual y sus
 * `vecinas` a cada lado; null marca un salto (…). Con 98 páginas, pintarlas
 * todas desbordaba la pantalla.
 */
function paginasVisibles(actual: number, total: number, vecinas: number): (number | null)[] {
  const numeros = new Set([1, total]);
  for (let n = actual - vecinas; n <= actual + vecinas; n++) {
    if (n >= 1 && n <= total) numeros.add(n);
  }

  const orden = [...numeros].sort((x, y) => x - y);
  const salida: (number | null)[] = [];
  orden.forEach((n, i) => {
    if (i > 0 && n - orden[i - 1] > 1) salida.push(null);
    salida.push(n);
  });
  return salida;
}
