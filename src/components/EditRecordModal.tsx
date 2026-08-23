import React, { useState } from 'react';
import { 
  X, 
  Save, 
  CheckCircle2, 
  Calendar as CalendarIcon, 
  Settings2, 
  MapPin, 
  Microscope,
  Wrench,
  ShieldCheck,
  MoreHorizontal
} from 'lucide-react';
import {
  MaintenanceRecord,
  ESTADOS_SUGERIDOS,
  SERVICIOS_SUGERIDOS,
} from '../types';

interface EditRecordModalProps {
  record: MaintenanceRecord;
  onClose: () => void;
  onSave: (updatedRecord: MaintenanceRecord) => Promise<void>;
}

/** Sugerencias, no lista cerrada: el seguimiento real trae servicios libres. */
const SERVICES = SERVICIOS_SUGERIDOS;

export const EditRecordModal: React.FC<EditRecordModalProps> = ({
  record,
  onClose,
  onSave
}) => {
  const [equipment, setEquipment] = useState(record.equipment);
  const [brand, setBrand] = useState(record.brand);
  const [model, setModel] = useState(record.model);
  const [serialNumber, setSerialNumber] = useState(record.serialNumber);
  const [service, setService] = useState(record.service || '');
  const [specificLocation, setSpecificLocation] = useState(record.specificLocation);
  const [inventoryCode, setInventoryCode] = useState(record.inventoryCode);
  const [date, setDate] = useState(record.date);
  const [finalStatus, setFinalStatus] = useState(record.finalStatus || '');

  // Tres casillas independientes, como en el seguimiento.
  const [preventivo, setPreventivo] = useState(!!record.preventivo);
  const [correctivo, setCorrectivo] = useState(!!record.correctivo);
  const [otro, setOtro] = useState(!!record.otro);
  const [spareParts, setSpareParts] = useState(record.spareParts || '');
  const [failureComments, setFailureComments] = useState(record.failureComments || '');
  const [additionalObservations, setAdditionalObservations] = useState(record.additionalObservations || '');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({
        ...record,
        equipment: equipment.trim(),
        brand: brand.trim(),
        model: model.trim(),
        serialNumber: serialNumber.trim(),
        service,
        specificLocation: specificLocation.trim(),
        inventoryCode: inventoryCode.trim(),
        date,
        finalStatus: finalStatus.trim(),
        preventivo,
        correctivo,
        otro,
        spareParts: spareParts.trim(),
        failureComments: failureComments.trim(),
        additionalObservations: additionalObservations.trim(),
        updatedAt: Date.now()
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error al actualizar en IndexedDB');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-5 text-white flex items-center justify-between sticky top-0 z-10">
          <div>
            <h3 className="font-bold text-base">Editar Registro de Mantenimiento</h3>
            <p className="text-xs text-blue-200 font-mono">{record.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-blue-200 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          
          {/* Equipment Info */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Microscope className="w-4 h-4 text-blue-600" /> Información del Equipo
            </h4>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Equipo</label>
                <input
                  type="text"
                  required
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Marca</label>
                <input
                  type="text"
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Modelo</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">N° de Serie</label>
                <input
                  type="text"
                  required
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-600" /> Ubicación
            </h4>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Servicio</label>
                <input
                  type="text"
                  list="edit-lista-servicios"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                />
                <datalist id="edit-lista-servicios">
                  {SERVICES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Ubicación Específica</label>
                <input
                  type="text"
                  value={specificLocation}
                  onChange={(e) => setSpecificLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>

          {/* Maintenance Details */}
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Settings2 className="w-4 h-4 text-blue-600" /> Estado e Intervención
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Fecha</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Estado Final</label>
                <input
                  type="text"
                  list="edit-lista-estados"
                  value={finalStatus}
                  onChange={(e) => setFinalStatus(e.target.value)}
                  placeholder="FUNCIONAL"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                />
                <datalist id="edit-lista-estados">
                  {ESTADOS_SUGERIDOS.map((e) => (
                    <option key={e} value={e} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">
                Clase de Mantenimiento <span className="font-normal text-slate-400">(puede marcar varias)</span>
              </label>
              <div className="flex gap-2">
                {([
                  ['Preventivo', preventivo, setPreventivo],
                  ['Correctivo', correctivo, setCorrectivo],
                  ['Otro', otro, setOtro],
                ] as const).map(([etiqueta, activa, cambiar]) => (
                  <button
                    key={etiqueta}
                    type="button"
                    aria-pressed={activa}
                    onClick={() => cambiar((v: boolean) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      activa ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">Repuestos Utilizados</label>
              <input
                type="text"
                value={spareParts}
                onChange={(e) => setSpareParts(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">Trabajo Realizado</label>
              <textarea
                rows={3}
                value={failureComments}
                onChange={(e) => setFailureComments(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">Observaciones / Recomendaciones</label>
              <textarea
                rows={2}
                value={additionalObservations}
                onChange={(e) => setAdditionalObservations(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-1/2 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
