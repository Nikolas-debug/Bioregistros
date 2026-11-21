import React, { useState } from 'react';
import { Save, Plus } from 'lucide-react';
import { Campo, Sheet } from './ui';
import { Equipment, ESTADOS_SUGERIDOS, SERVICIOS_SUGERIDOS } from '../types';

interface NewEquipmentModalProps {
  onClose: () => void;
  onSaveEquipment: (equipment: Equipment) => Promise<void>;
}

/** Sugerencias, no lista cerrada. */
const SERVICES = SERVICIOS_SUGERIDOS;

export const NewEquipmentModal: React.FC<NewEquipmentModalProps> = ({
  onClose,
  onSaveEquipment
}) => {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [inventoryCode, setInventoryCode] = useState(`CDN-BIO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [service, setService] = useState('');
  const [specificLocation, setSpecificLocation] = useState('');
  const [riskClass, setRiskClass] = useState<string>('IIB');
  const [status, setStatus] = useState('FUNCIONAL');
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
    <Sheet
      titulo="Registrar nuevo equipo"
      subtitulo="Añadir al inventario biomédico hospitalario"
      icono={<Plus className="size-5" />}
      onClose={onClose}
      pie={
        <>
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1 sm:flex-none">
            Cancelar
          </button>
          <button type="submit" form="form-nuevo-equipo" disabled={isSubmitting} className="btn btn-primary flex-1">
            <Save className="size-4" />
            {isSubmitting ? 'Guardando…' : 'Guardar equipo'}
          </button>
        </>
      }
    >
      <form id="form-nuevo-equipo" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre del equipo médico *" className="sm:col-span-2">
          {(id) => (
            <input
              id={id}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Desfibrilador bifásico, ventilador pulmonar"
              className="input"
            />
          )}
        </Campo>
        <Campo etiqueta="Marca">
          {(id) => (
            <input id={id} type="text" required value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ej. Philips, GE" className="input" />
          )}
        </Campo>
        <Campo etiqueta="Modelo">
          {(id) => (
            <input id={id} type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ej. V60, BeneVision" className="input" />
          )}
        </Campo>
        <Campo etiqueta="N° de serie *">
          {(id) => (
            <input
              id={id}
              type="text"
              required
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="SN-XXXXX"
              className="input font-mono tracking-normal"
            />
          )}
        </Campo>
        <Campo etiqueta="Código inventario">
          {(id) => (
            <input id={id} type="text" value={inventoryCode} onChange={(e) => setInventoryCode(e.target.value)} className="input font-mono tracking-normal" />
          )}
        </Campo>
        <Campo etiqueta="Servicio">
          {(id) => (
            <select id={id} value={service} onChange={(e) => setService(e.target.value)} className="input">
              {SERVICES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Ubicación">
          {(id) => (
            <input id={id} type="text" value={specificLocation} onChange={(e) => setSpecificLocation(e.target.value)} placeholder="Ej. Cama 4" className="input" />
          )}
        </Campo>
        <Campo etiqueta="Clasificación de riesgo">
          {(id) => (
            <select id={id} value={riskClass} onChange={(e) => setRiskClass(e.target.value)} className="input">
              <option value="I">Clase I (bajo riesgo)</option>
              <option value="IIA">Clase IIA (riesgo moderado)</option>
              <option value="IIB">Clase IIB (alto riesgo)</option>
              <option value="III">Clase III (muy alto / soporte de vida)</option>
            </select>
          )}
        </Campo>
        <Campo etiqueta="Estado">
          {(id) => (
            <select id={id} value={status} onChange={(e) => setStatus(e.target.value)} className="input">
              {ESTADOS_SUGERIDOS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          )}
        </Campo>
      </form>
    </Sheet>
  );
};
