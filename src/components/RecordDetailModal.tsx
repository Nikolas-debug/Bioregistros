import React, { useState } from 'react';
import { Download, Trash2, Pencil } from 'lucide-react';
import { EstadoBadge, Sheet } from './ui';
import { MaintenanceRecord, etiquetaClases, etiquetaReporte, fechaCorta } from '../types';
import { exportSingleRecordToExcel } from '../utils/excelExport';

interface RecordDetailModalProps {
  record: MaintenanceRecord;
  onClose: () => void;
  onEdit: (record: MaintenanceRecord) => void;
  onDelete: (id: string) => Promise<void>;
  onUpdateStatus: (record: MaintenanceRecord, newStatus: string) => Promise<void>;
}

export const RecordDetailModal: React.FC<RecordDetailModalProps> = ({
  record,
  onClose,
  onEdit,
  onDelete,
  onUpdateStatus
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(record.id);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Error al eliminar registro');
    } finally {
      setIsDeleting(false);
    }
  };

  const iniciales =
    record.technicianName
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?';

  const Dato: React.FC<{ etiqueta: string; valor?: string; mono?: boolean }> = ({ etiqueta, valor, mono }) => (
    <div>
      <dt className="kv-label">{etiqueta}</dt>
      <dd className={`kv-value ${mono ? 'font-mono text-sm' : ''}`}>{valor || '—'}</dd>
    </div>
  );

  return (
    <Sheet
      titulo={record.equipment}
      subtitulo={
        <>
          <span className="font-bold text-slate-700 tabular-nums">{etiquetaReporte(record)}</span> ·{' '}
          {record.brand} {record.model}
        </>
      }
      onClose={onClose}
      pie={
        <>
          <button type="button" onClick={() => onEdit(record)} className="btn btn-ghost flex-1">
            <Pencil className="size-4" /> Editar
          </button>
          <button type="button" onClick={() => exportSingleRecordToExcel(record)} className="btn btn-ink flex-1">
            <Download className="size-4" /> Exportar Excel
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <EstadoBadge estado={record.finalStatus} />
        <span className="badge badge-info">{etiquetaClases(record)}</span>
        {record.finalStatus && <span className="text-[13px] text-slate-500">{record.finalStatus}</span>}
      </div>

      <dl className="soft mt-5 grid grid-cols-2 gap-x-4 gap-y-4 p-5">
        <Dato etiqueta="N° de serie" valor={record.serialNumber} mono />
        <Dato etiqueta="Código inventario" valor={record.inventoryCode} mono />
        <Dato etiqueta="Servicio" valor={record.service} />
        <Dato etiqueta="Ubicación específica" valor={record.specificLocation} />
        <Dato etiqueta="Fecha" valor={fechaCorta(record.date)} />
        <Dato etiqueta="Hora" valor={record.time} />
      </dl>

      <div className="mt-6 space-y-5">
        <div>
          <h3 className="kv-label">Repuestos utilizados</h3>
          <p className="mt-1 text-[15px] text-slate-900">
            {record.spareParts || 'No se requirieron repuestos adicionales.'}
          </p>
        </div>
        <div>
          <h3 className="kv-label">Trabajo realizado / descripción de falla</h3>
          <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap text-slate-900">
            {record.failureComments || '—'}
          </p>
        </div>
        {record.additionalObservations && (
          <div>
            <h3 className="kv-label">Observaciones / recomendaciones</h3>
            <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap text-slate-900">
              {record.additionalObservations}
            </p>
          </div>
        )}
      </div>

      {/* Firma técnica */}
      <div className="mt-6 flex items-center gap-3 border-t border-slate-200 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
            {iniciales}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold text-slate-900">{record.technicianName}</span>
            <span className="block text-[13px] text-slate-500">Técnico responsable</span>
          </span>
        </div>
      </div>

      {/* Eliminar */}
      <div className="mt-6">
        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} className="btn-text text-rose-700 hover:bg-rose-50">
            <Trash2 className="size-4" /> Eliminar registro
          </button>
        ) : (
          <div className="rounded-3xl bg-rose-50 p-4">
            <p className="text-sm font-bold text-rose-900">¿Eliminar este registro?</p>
            <p className="mt-1 text-[13px] text-rose-800">Se borra en el servidor y en este dispositivo.</p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => setConfirmDelete(false)} className="btn btn-ghost bg-white">
                Cancelar
              </button>
              <button type="button" disabled={isDeleting} onClick={handleDelete} className="btn btn-danger">
                {isDeleting ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
};
