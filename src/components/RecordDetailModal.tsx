import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  MapPin, 
  Calendar, 
  Clock, 
  User, 
  Wrench, 
  FileText,
  ShieldCheck,
  Building2,
  Share2
} from 'lucide-react';
import { MaintenanceRecord, MaintenanceStatus } from '../types';
import { exportSingleRecordToExcel } from '../utils/excelExport';

interface RecordDetailModalProps {
  record: MaintenanceRecord;
  onClose: () => void;
  onEdit: (record: MaintenanceRecord) => void;
  onDelete: (id: string) => Promise<void>;
  onUpdateStatus: (record: MaintenanceRecord, newStatus: MaintenanceStatus) => Promise<void>;
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

  const handlePrint = () => {
    window.print();
  };

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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header with Title & Action */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-sky-900 p-5 text-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-sky-300 font-bold block">
                Ficha Técnica de Mantenimiento
              </span>
              <h3 className="text-lg font-bold text-white leading-tight mt-0.5">
                {record.equipment}
              </h3>
              <p className="text-xs text-blue-100 font-mono mt-0.5">
                {record.id} • {record.brand} {record.model}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          
          {/* Status & Maintenance Type Banner */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Estado Técnico</span>
              <span className={`text-xs font-bold inline-flex items-center gap-1 mt-1 ${
                record.finalStatus === 'Operativo' || record.finalStatus === 'Calibrado'
                  ? 'text-emerald-700'
                  : record.finalStatus === 'En Espera de Repuestos'
                  ? 'text-amber-700'
                  : 'text-rose-700'
              }`}>
                {record.finalStatus}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Clase Intervención</span>
              <span className="text-xs font-bold text-blue-900 inline-flex items-center gap-1 mt-1">
                <Wrench className="w-3 h-3 text-blue-600" /> {record.maintenanceType}
              </span>
            </div>
          </div>

          {/* Section: Dispositivo */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-2xs">
            <h4 className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" /> Identificación del Equipo
            </h4>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-slate-400 text-[10px] block">N° de Serie</span>
                <span className="font-mono font-bold text-slate-800">{record.serialNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Código Inventario</span>
                <span className="font-mono font-bold text-slate-800">{record.inventoryCode}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Servicio</span>
                <span className="font-semibold text-slate-800">{record.service}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Ubicación Específica</span>
                <span className="font-semibold text-slate-800">{record.specificLocation || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Section: Detalles del Mantenimiento */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
            <h4 className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" /> Registro Cronológico & Repuestos
            </h4>
            
            <div className="flex items-center gap-4 text-slate-700">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Fecha: <strong>{record.date}</strong></span>
              </div>
              {record.time && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Hora: <strong>{record.time}</strong></span>
                </div>
              )}
            </div>

            <div>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Repuestos Utilizados:</span>
              <p className="text-slate-800 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                {record.spareParts || 'No se requirieron repuestos adicionales.'}
              </p>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Trabajo Realizado / Descripción de Falla:</span>
              <p className="text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-1 whitespace-pre-wrap leading-relaxed">
                {record.failureComments}
              </p>
            </div>

            {record.additionalObservations && (
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Observaciones / Recomendaciones:</span>
                <p className="text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-1 whitespace-pre-wrap leading-relaxed">
                  {record.additionalObservations}
                </p>
              </div>
            )}
          </div>

          {/* Section: Firma Técnica */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                LM
              </div>
              <div>
                <span className="font-bold text-slate-900 block">{record.technicianName}</span>
                <span className="text-[11px] text-slate-500 font-mono">{record.technicianCard || 'T.P. BIO-88942'}</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Verificado
            </span>
          </div>

          {/* Actions Bar */}
          <div className="pt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => exportSingleRecordToExcel(record)}
                className="py-2.5 px-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Excel</span>
              </button>

              <button
                type="button"
                onClick={() => onEdit(record)}
                className="py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                <span>Editar Registro</span>
              </button>
            </div>

            {/* Delete Record Section */}
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2 text-rose-600 hover:text-rose-800 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Registro</span>
              </button>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 animate-in fade-in">
                <p className="text-xs text-rose-800 font-semibold text-center">
                  ¿Confirmar eliminación de este registro en IndexedDB?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="py-1.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDelete}
                    className="py-1.5 bg-rose-600 text-white font-bold rounded-lg text-xs"
                  >
                    {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};
