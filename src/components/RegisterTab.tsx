import React, { useState } from 'react';
import { 
  Microscope, 
  MapPin, 
  Settings2, 
  CheckCircle2, 
  Calendar as CalendarIcon, 
  Save, 
  X, 
  Wrench, 
  ShieldCheck, 
  MoreHorizontal,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  MaintenanceRecord,
  Equipment,
  ESTADOS_SUGERIDOS,
  SERVICIOS_SUGERIDOS,
} from '../types';

interface RegisterTabProps {
  onSaveRecord: (record: Omit<MaintenanceRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  equipments: Equipment[];
  technicianName: string;
  /** Abre el modal de carga masiva desde Excel. */
  onOpenBulkImport?: () => void;
}

/**
 * Sugerencias, no una lista cerrada. El seguimiento real trae servicios
 * como "TORRE B", "CKU.635" o "NNS364" que ninguna lista fija habria
 * aceptado, y rechazarlos obligaria al tecnico a mentir.
 */
const SERVICES = SERVICIOS_SUGERIDOS;

export const RegisterTab: React.FC<RegisterTabProps> = ({
  onSaveRecord,
  onCancel,
  equipments,
  technicianName,
  onOpenBulkImport
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Form State
  const [equipment, setEquipment] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  
  const [service, setService] = useState('');
  const [specificLocation, setSpecificLocation] = useState('');
  const [inventoryCode, setInventoryCode] = useState('');

  const [date, setDate] = useState(todayStr);
  const [finalStatus, setFinalStatus] = useState('FUNCIONAL');

  // Tres casillas independientes, como en el seguimiento en papel: una
  // intervencion puede ser preventiva y correctiva a la vez.
  const [preventivo, setPreventivo] = useState(true);
  const [correctivo, setCorrectivo] = useState(false);
  const [otro, setOtro] = useState(false);
  const [spareParts, setSpareParts] = useState('');
  const [failureComments, setFailureComments] = useState('');
  const [additionalObservations, setAdditionalObservations] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Quick autofill when selecting known equipment
  const handleSelectPreloadedEquipment = (eq: Equipment) => {
    setEquipment(eq.name);
    setBrand(eq.brand);
    setModel(eq.model);
    setSerialNumber(eq.serialNumber);
    setInventoryCode(eq.inventoryCode);
    setService(eq.service);
    setSpecificLocation(eq.specificLocation);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipment.trim()) {
      alert('Escriba al menos el nombre del equipo.');
      return;
    }

    // La serie identifica el equipo en la base. Se puede omitir, pero
    // conviene avisar: sin serie ni inventario se crea un equipo nuevo
    // cada vez, y la hoja de vida queda partida en pedazos.
    if (!serialNumber.trim() && !inventoryCode.trim()) {
      const seguir = window.confirm(
        'Este registro no tiene número de serie ni código de inventario.\n\n' +
        'Sin uno de los dos no se puede enlazar con el historial del equipo. ' +
        '¿Desea guardarlo así?'
      );
      if (!seguir) return;
    }

    if (!preventivo && !correctivo && !otro) {
      alert('Marque al menos una clase: preventivo, correctivo u otro.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSaveRecord({
        equipment: equipment.trim(),
        brand: brand.trim() || 'Genérico',
        model: model.trim() || 'N/A',
        serialNumber: serialNumber.trim(),
        service,
        specificLocation: specificLocation.trim() || 'Ubicación General',
        inventoryCode: inventoryCode.trim(),
        date,
        time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }),
        finalStatus: finalStatus.trim(),
        preventivo,
        correctivo,
        otro,
        spareParts: spareParts.trim(),
        failureComments: failureComments.trim(),
        additionalObservations: additionalObservations.trim(),
        // La firma sale del perfil de quien inicio sesion.
        technicianName
      });

      // Trigger celebratory confetti
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });

      setShowSuccessToast(true);
      setTimeout(() => {
        setShowSuccessToast(false);
        // Reset or leave clean
        setEquipment('');
        setBrand('');
        setModel('');
        setSerialNumber('');
        setSpecificLocation('');
        setInventoryCode('');
        setSpareParts('');
        setFailureComments('');
        setAdditionalObservations('');
        setPreventivo(true);
        setCorrectivo(false);
        setOtro(false);
      }, 1500);

    } catch (err) {
      console.error(err);
      alert('No se pudo guardar el registro en el dispositivo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pb-28 lg:pb-10 pt-4 px-4 max-w-md lg:max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Title & Description matching Image 1 */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Nuevo Registro de Mantenimiento
        </h2>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          Complete los datos técnicos de la intervención en el equipo biomédico.
        </p>
      </div>

      {/* Registro masivo: atajo para cargar muchas filas desde un Excel */}
      {onOpenBulkImport && (
        <button
          type="button"
          onClick={onOpenBulkImport}
          className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
            <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-700" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">
              Registro masivo desde Excel
            </span>
            <span className="block text-[11px] text-slate-500">
              Cargue varias intervenciones de una sola vez
            </span>
          </span>
        </button>
      )}

      {/* Quick Suggestions from inventory */}
      {equipments.length > 0 && !equipment && (
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-600" /> Autocompletar desde Inventario
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {equipments.slice(0, 4).map((eq) => (
              <button
                key={eq.id}
                type="button"
                onClick={() => handleSelectPreloadedEquipment(eq)}
                className="text-xs bg-white hover:bg-blue-100/70 border border-blue-200 text-blue-800 px-2.5 py-1 rounded-lg shrink-0 transition-colors font-medium"
              >
                {eq.name} ({eq.brand})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center gap-3 animate-in zoom-in-95 duration-200">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <div>
            <h4 className="font-bold text-sm">¡Registro Guardado en IndexedDB!</h4>
            <p className="text-xs text-emerald-100">Guardado localmente de forma segura y listo para reporte anual.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* CARD 1: INFORMACIÓN DEL DISPOSITIVO */}
        <div className="bg-slate-50/60 rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-800 tracking-wider uppercase">
            <Microscope className="w-4 h-4 text-blue-600" />
            <span>INFORMACIÓN DEL DISPOSITIVO</span>
          </div>

          <div className="p-4 space-y-3 bg-white">
            {/* Equipo */}
            <div>
              <input
                id="input-device-equipment"
                type="text"
                required
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="Equipo (ej. Ventilador V60, Desfibrilador)"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Marca */}
            <div>
              <input
                id="input-device-brand"
                type="text"
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Marca (ej. Philips, GE Healthcare)"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Modelo */}
            <div>
              <input
                id="input-device-model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Modelo (ej. V60, Optima 450w)"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Número de Serie with verified badge border matching image */}
            <div className="relative">
              <div className="border border-emerald-600 rounded-xl p-2.5 bg-emerald-50/20 flex items-center justify-between">
                <div className="w-full">
                  <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Número de Serie
                  </label>
                  <input
                    id="input-device-serial"
                    type="text"
                    required
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="SN-89234"
                    className="w-full bg-transparent border-0 p-0 text-slate-900 font-mono text-sm font-semibold focus:outline-hidden focus:ring-0"
                  />
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 ml-2" />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: UBICACIÓN */}
        <div className="bg-slate-50/60 rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-800 tracking-wider uppercase">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>UBICACIÓN</span>
          </div>

          <div className="p-4 space-y-3 bg-white">
            {/* SERVICIO Dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                SERVICIO
              </label>
              <input
                id="input-location-service"
                type="text"
                list="lista-servicios"
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="Ej. HOSPITALIZACION, UCI NEONATAL, TORRE B"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              <datalist id="lista-servicios">
                {SERVICES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* Ubicación Específica */}
            <div>
              <input
                id="input-location-specific"
                type="text"
                value={specificLocation}
                onChange={(e) => setSpecificLocation(e.target.value)}
                placeholder="Ubicación Específica (ej. Cama 4, Box 2)"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Código de Inventario Institucional */}
            <div>
              <input
                id="input-location-inventory-code"
                type="text"
                value={inventoryCode}
                onChange={(e) => setInventoryCode(e.target.value)}
                placeholder="Código de Inventario Institucional (ej. CDN-BIO-2023-089)"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent font-mono"
              />
            </div>
          </div>
        </div>

        {/* CARD 3: DETALLES DEL MANTENIMIENTO */}
        <div className="bg-slate-50/60 rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-800 tracking-wider uppercase">
            <Settings2 className="w-4 h-4 text-blue-600" />
            <span>DETALLES DEL MANTENIMIENTO</span>
          </div>

          <div className="p-4 space-y-4 bg-white">
            
            {/* FECHA DE INTERVENCIÓN */}
            <div className="border border-slate-300 rounded-xl p-2.5 bg-white">
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wide">
                FECHA DE INTERVENCIÓN
              </label>
              <div className="flex items-center justify-between mt-0.5">
                <input
                  id="input-date-intervention"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-transparent border-0 p-0 text-slate-900 text-sm font-medium focus:outline-hidden focus:ring-0"
                />
                <CalendarIcon className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
              </div>
            </div>

            {/* ESTADO FINAL DEL EQUIPO */}
            <div className="border border-slate-300 rounded-xl p-2.5 bg-white">
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                ESTADO FINAL DEL EQUIPO
              </label>
              <input
                id="input-final-status"
                type="text"
                list="lista-estados"
                value={finalStatus}
                onChange={(e) => setFinalStatus(e.target.value)}
                placeholder="FUNCIONAL"
                className="w-full bg-transparent border-0 p-0 text-slate-900 text-sm font-semibold placeholder:text-slate-400 focus:outline-hidden focus:ring-0"
              />
              <datalist id="lista-estados">
                {ESTADOS_SUGERIDOS.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </div>

            {/* Clase de mantenimiento: tres casillas independientes,
                igual que en el seguimiento en papel. Una intervencion
                puede ser preventiva y correctiva a la vez. */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Clase de Mantenimiento
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Puede marcar más de una.
              </p>
              <div className="flex flex-wrap gap-2">
                <CasillaClase
                  id="btn-type-preventivo"
                  activa={preventivo}
                  onToggle={() => setPreventivo((v) => !v)}
                  icono={<ShieldCheck className="w-3.5 h-3.5" />}
                  etiqueta="Preventivo"
                />
                <CasillaClase
                  id="btn-type-correctivo"
                  activa={correctivo}
                  onToggle={() => setCorrectivo((v) => !v)}
                  icono={<Wrench className="w-3.5 h-3.5" />}
                  etiqueta="Correctivo"
                />
                <CasillaClase
                  id="btn-type-otro"
                  activa={otro}
                  onToggle={() => setOtro((v) => !v)}
                  icono={<MoreHorizontal className="w-3.5 h-3.5" />}
                  etiqueta="Otro"
                />
              </div>
            </div>

            {/* Repuestos Utilizados */}
            <div>
              <input
                id="input-spare-parts"
                type="text"
                value={spareParts}
                onChange={(e) => setSpareParts(e.target.value)}
                placeholder="Repuestos Utilizados (Separados por coma)"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Comentarios de Falla / Trabajo Realizado */}
            <div>
              <textarea
                id="textarea-failure-comments"
                rows={3}
                value={failureComments}
                onChange={(e) => setFailureComments(e.target.value)}
                placeholder="Comentarios de Falla / Trabajo Realizado"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Observaciones Adicionales / Recomendaciones */}
            <div>
              <textarea
                id="textarea-additional-observations"
                rows={3}
                value={additionalObservations}
                onChange={(e) => setAdditionalObservations(e.target.value)}
                placeholder="Observaciones Adicionales / Recomendaciones"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

          </div>
        </div>

        {/* Action Buttons matching Image 1 */}
        <div className="space-y-2.5 pt-2">
          
          {/* Cancelar */}
          <button
            type="button"
            id="btn-register-cancel"
            onClick={onCancel}
            className="w-full py-3 px-4 bg-white border border-blue-600 text-blue-700 hover:bg-blue-50 active:bg-blue-100 font-semibold rounded-xl text-sm transition-colors text-center shadow-2xs"
          >
            Cancelar
          </button>

          {/* Registrar Mantenimiento */}
          <button
            type="submit"
            id="btn-register-submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-700/20 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Guardando en IndexedDB...' : 'Registrar Mantenimiento'}</span>
          </button>

        </div>

      </form>

    </div>
  );
};

/* ------------------------------------------------------------------ */

/** Una casilla de clase: se enciende y se apaga de forma independiente. */
const CasillaClase: React.FC<{
  id: string;
  activa: boolean;
  onToggle: () => void;
  icono: React.ReactNode;
  etiqueta: string;
}> = ({ id, activa, onToggle, icono, etiqueta }) => (
  <button
    type="button"
    id={id}
    onClick={onToggle}
    aria-pressed={activa}
    className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
      activa
        ? 'bg-blue-600 text-white shadow-xs'
        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
    }`}
  >
    {icono}
    <span>{etiqueta}</span>
  </button>
);
