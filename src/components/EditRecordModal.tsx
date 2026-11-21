import React, { useState } from 'react';
import { Save, Check } from 'lucide-react';
import { Campo, Sheet } from './ui';
import { MaintenanceRecord, ESTADOS_SUGERIDOS, SERVICIOS_SUGERIDOS, etiquetaReporte } from '../types';

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

  const texto = (
    etiqueta: string,
    valor: string,
    cambiar: (v: string) => void,
    extra: { required?: boolean; mono?: boolean; list?: string; placeholder?: string; span?: boolean } = {},
  ) => (
    <Campo etiqueta={etiqueta} className={extra.span ? 'sm:col-span-2' : undefined}>
      {(id) => (
        <input
          id={id}
          type="text"
          required={extra.required}
          list={extra.list}
          placeholder={extra.placeholder}
          value={valor}
          onChange={(e) => cambiar(e.target.value)}
          className={`input ${extra.mono ? 'font-mono tracking-normal' : ''}`}
        />
      )}
    </Campo>
  );

  return (
    <Sheet
      titulo="Editar registro"
      subtitulo={<span className="tabular-nums">{etiquetaReporte(record)} · {record.equipment}</span>}
      onClose={onClose}
      ancho="lg"
      pie={
        <>
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1 sm:flex-none">
            Cancelar
          </button>
          <button type="submit" form="form-editar-registro" disabled={isSubmitting} className="btn btn-primary flex-1">
            <Save className="size-4" />
            {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <form id="form-editar-registro" onSubmit={handleSubmit} className="space-y-7">
        <section>
          <h3 className="text-base font-medium text-slate-900">Información del equipo</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {texto('Equipo', equipment, setEquipment, { required: true, span: true })}
            {texto('Marca', brand, setBrand, { required: true })}
            {texto('Modelo', model, setModel)}
            {texto('N° de serie', serialNumber, setSerialNumber, { required: true, mono: true })}
            {texto('Código inventario', inventoryCode, setInventoryCode, { mono: true })}
          </div>
        </section>

        <section>
          <h3 className="text-base font-medium text-slate-900">Ubicación</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {texto('Servicio', service, setService, { list: 'edit-lista-servicios' })}
            {texto('Ubicación específica', specificLocation, setSpecificLocation)}
          </div>
          <datalist id="edit-lista-servicios">
            {SERVICES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </section>

        <section>
          <h3 className="text-base font-medium text-slate-900">Estado e intervención</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Fecha">
              {(id) => (
                <input id={id} type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input" />
              )}
            </Campo>
            {texto('Estado final', finalStatus, setFinalStatus, { list: 'edit-lista-estados', placeholder: 'FUNCIONAL' })}
          </div>
          <datalist id="edit-lista-estados">
            {ESTADOS_SUGERIDOS.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>

          <fieldset className="mt-4">
            <legend className="field-label">
              Clase de mantenimiento <span className="font-medium text-slate-500">· puede marcar varias</span>
            </legend>
            <div className="flex flex-wrap gap-2">
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
                  className="pill-tab px-5"
                >
                  {activa && <Check className="size-4" strokeWidth={3} />}
                  {etiqueta}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 grid gap-4">
            {texto('Repuestos utilizados', spareParts, setSpareParts)}
            <Campo etiqueta="Trabajo realizado">
              {(id) => (
                <textarea id={id} rows={3} value={failureComments} onChange={(e) => setFailureComments(e.target.value)} className="input" />
              )}
            </Campo>
            <Campo etiqueta="Observaciones / recomendaciones">
              {(id) => (
                <textarea
                  id={id}
                  rows={2}
                  value={additionalObservations}
                  onChange={(e) => setAdditionalObservations(e.target.value)}
                  className="input"
                />
              )}
            </Campo>
          </div>
        </section>
      </form>
    </Sheet>
  );
};
