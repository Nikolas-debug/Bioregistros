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
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { MaintenanceRecord, MaintenanceStatus, MaintenanceType, HospitalService, Equipment } from '../types';

interface RegisterTabProps {
  onSaveRecord: (record: Omit<MaintenanceRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  equipments: Equipment[];
  technicianName: string;
}

const SERVICES: HospitalService[] = [
  'UCI',
  'UCI Neonatal',
  'UCI Pediátrica',
  'Urgencias',
  'Quirófano',
  'Hospitalización',
  'Imágenes Diagnósticas',
  'Laboratorio Clínico',
  'Consulta Externa',
  'Central de Esterilización'
];

export const RegisterTab: React.FC<RegisterTabProps> = ({
  onSaveRecord,
  onCancel,
  equipments,
  technicianName
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Form State
  const [equipment, setEquipment] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  
  const [service, setService] = useState<HospitalService>('UCI');
  const [specificLocation, setSpecificLocation] = useState('');
  const [inventoryCode, setInventoryCode] = useState('');

  const [date, setDate] = useState(todayStr);
  const [finalStatus, setFinalStatus] = useState<MaintenanceStatus>('Operativo');
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType>('Preventivo');
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
    setService(eq.service as HospitalService);
    setSpecificLocation(eq.specificLocation);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipment.trim() || !serialNumber.trim()) {
      alert('Por favor ingrese al menos el nombre del Equipo y el Número de Serie.');
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
        inventoryCode: inventoryCode.trim() || `CDN-${Math.floor(1000 + Math.random() * 9000)}`,
        date,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        finalStatus,
        maintenanceType,
        spareParts: spareParts.trim(),
        failureComments: failureComments.trim() || 'Mantenimiento preventivo / inspección técnica realizada.',
        additionalObservations: additionalObservations.trim(),
        technicianName: technicianName || 'Luis Machado',
        technicianCard: 'T.P. BIO-88942',
        syncedOffline: true
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
      }, 1500);

    } catch (err) {
      console.error(err);
      alert('Hubo un error al guardar en IndexedDB');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pb-28 pt-4 px-4 max-w-md mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Title & Description matching Image 1 */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Nuevo Registro de Mantenimiento
        </h2>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          Complete los datos técnicos de la intervención en el equipo biomédico.
        </p>
      </div>

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
              <select
                id="select-location-service"
                value={service}
                onChange={(e) => setService(e.target.value as HospitalService)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                {SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
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
              <select
                id="select-final-status"
                value={finalStatus}
                onChange={(e) => setFinalStatus(e.target.value as MaintenanceStatus)}
                className="w-full bg-transparent border-0 p-0 text-slate-900 text-sm font-semibold focus:outline-hidden focus:ring-0"
              >
                <option value="Operativo">Operativo</option>
                <option value="En Espera de Repuestos">En Espera de Repuestos</option>
                <option value="Fuera de Servicio">Fuera de Servicio</option>
                <option value="Calibrado">Calibrado</option>
              </select>
            </div>

            {/* Clase de Mantenimiento (Pill buttons matching image) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                Clase de Mantenimiento
              </label>
              <div className="flex flex-wrap gap-2">
                
                {/* Preventivo */}
                <button
                  type="button"
                  id="btn-type-preventivo"
                  onClick={() => setMaintenanceType('Preventivo')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    maintenanceType === 'Preventivo'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Preventivo</span>
                </button>

                {/* Correctivo */}
                <button
                  type="button"
                  id="btn-type-correctivo"
                  onClick={() => setMaintenanceType('Correctivo')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    maintenanceType === 'Correctivo'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Correctivo</span>
                </button>

                {/* Otro */}
                <button
                  type="button"
                  id="btn-type-otro"
                  onClick={() => setMaintenanceType('Otro')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    maintenanceType === 'Otro'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                  <span>Otro</span>
                </button>

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
