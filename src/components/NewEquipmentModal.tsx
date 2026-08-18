import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Plus, 
  Microscope, 
  MapPin, 
  ShieldCheck, 
  Building2,
  CheckCircle2
} from 'lucide-react';
import { Equipment, HospitalService, MaintenanceStatus } from '../types';

interface NewEquipmentModalProps {
  onClose: () => void;
  onSaveEquipment: (equipment: Equipment) => Promise<void>;
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

export const NewEquipmentModal: React.FC<NewEquipmentModalProps> = ({
  onClose,
  onSaveEquipment
}) => {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [inventoryCode, setInventoryCode] = useState(`CDN-BIO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [service, setService] = useState<HospitalService>('UCI');
  const [specificLocation, setSpecificLocation] = useState('');
  const [riskClass, setRiskClass] = useState<'I' | 'IIA' | 'IIB' | 'III'>('IIB');
  const [status, setStatus] = useState<MaintenanceStatus>('Operativo');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !serialNumber.trim()) {
      alert('Por favor ingrese el nombre del equipo y el número de serie.');
      return;
    }

    setIsSubmitting(true);
    try {
      const year = new Date().getFullYear();
      const newEquip: Equipment = {
        id: `EQ-${year}-${Math.floor(100 + Math.random() * 900)}`,
        name: name.trim(),
        brand: brand.trim() || 'Genérico',
        model: model.trim() || 'Estándar',
        serialNumber: serialNumber.trim(),
        inventoryCode: inventoryCode.trim(),
        service,
        specificLocation: specificLocation.trim() || 'Ubicación General',
        status,
        riskClass,
        lastMaintenanceDate: new Date().toISOString().split('T')[0],
        frequencyMonths: 6
      };

      await onSaveEquipment(newEquip);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error al guardar equipo en IndexedDB');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-blue-800 p-5 text-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-teal-300" />
            <div>
              <h3 className="font-bold text-base">Registrar Nuevo Equipo</h3>
              <p className="text-xs text-teal-100">Añadir al inventario biomédico hospitalario</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-teal-100 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
              Nombre del Equipo Médico *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Desfibrilador Bifásico, Ventilador Pulmonar"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Marca</label>
              <input
                type="text"
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="ej. Philips, GE"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Modelo</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="ej. V60, BeneVision"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">N° de Serie *</label>
              <input
                type="text"
                required
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="SN-XXXXX"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Código Inventario</label>
              <input
                type="text"
                value={inventoryCode}
                onChange={(e) => setInventoryCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Servicio</label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value as HospitalService)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white"
              >
                {SERVICES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Ubicación</label>
              <input
                type="text"
                value={specificLocation}
                onChange={(e) => setSpecificLocation(e.target.value)}
                placeholder="ej. Cama 4"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Clasificación Riesgo</label>
              <select
                value={riskClass}
                onChange={(e) => setRiskClass(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white"
              >
                <option value="I">Clase I (Bajo Riesgo)</option>
                <option value="IIA">Clase IIA (Riesgo Moderado)</option>
                <option value="IIB">Clase IIB (Alto Riesgo)</option>
                <option value="III">Clase III (Muy Alto / Soporte de Vida)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MaintenanceStatus)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white"
              >
                <option value="Operativo">Operativo</option>
                <option value="En Espera de Repuestos">En Espera de Repuestos</option>
                <option value="Fuera de Servicio">Fuera de Servicio</option>
                <option value="Calibrado">Calibrado</option>
              </select>
            </div>
          </div>

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
              <span>{isSubmitting ? 'Guardando...' : 'Guardar Equipo'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
