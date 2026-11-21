import React, { useState } from 'react';
import { CheckCircle2, Save, Check, FileSpreadsheet } from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  MaintenanceRecord,
  Equipment,
  ESTADOS_SUGERIDOS,
  SERVICIOS_SUGERIDOS,
} from '../types';
import { Campo } from './ui';

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
    <div className="px-4 pt-4 pb-[calc(96px+env(safe-area-inset-bottom))] lg:px-8 lg:pt-6 lg:pb-12">

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="t-display">Nuevo registro de mantenimiento</h1>
          <p className="t-lead mt-2">
            Complete los datos técnicos de la intervención en el equipo biomédico.
          </p>
        </div>

        {/* Registro masivo: atajo para cargar muchas filas desde un Excel */}
        {onOpenBulkImport && (
          <button type="button" onClick={onOpenBulkImport} className="btn btn-ghost self-start lg:self-auto">
            <FileSpreadsheet className="size-4" />
            Registro masivo desde Excel
          </button>
        )}
      </div>

      {/* Atajo: equipos ya conocidos */}
      {equipments.length > 0 && !equipment && (
        <div className="mt-5">
          <p className="field-label">Autocompletar desde inventario</p>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
            {equipments.slice(0, 6).map((eq) => (
              <button
                key={eq.id}
                type="button"
                onClick={() => handleSelectPreloadedEquipment(eq)}
                className="pill-tab"
              >
                {eq.name}
                <span className="font-medium text-slate-500">{eq.brand}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confirmación */}
      {showSuccessToast && (
        <div className="notice notice-ok mt-5" role="status">
          <CheckCircle2 className="size-6 shrink-0 text-emerald-700" />
          <div>
            <p className="font-bold">¡Registro guardado!</p>
            <p>Guardado localmente de forma segura y listo para el reporte anual.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 lg:grid-cols-2 lg:gap-6">

        {/* Equipo */}
        <section className="card p-5 lg:p-6">
          <h2 className="text-lg font-medium tracking-[-0.01em]">Información del dispositivo</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Equipo" className="sm:col-span-2">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  required
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  placeholder="Ej. Ventilador V60, Desfibrilador"
                  className="input"
                />
              )}
            </Campo>
            <Campo etiqueta="Marca">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ej. Philips, GE Healthcare"
                  className="input"
                />
              )}
            </Campo>
            <Campo etiqueta="Modelo">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Ej. V60, Optima 450w"
                  className="input"
                />
              )}
            </Campo>
            <Campo etiqueta="Número de serie" className="sm:col-span-2">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  required
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="SN-89234"
                  className="input font-mono tracking-normal"
                />
              )}
            </Campo>
          </div>
        </section>

        {/* Ubicación */}
        <section className="card p-5 lg:p-6">
          <h2 className="text-lg font-medium tracking-[-0.01em]">Ubicación</h2>
          <div className="mt-4 grid gap-4">
            <Campo etiqueta="Servicio">
              {(id) => (
                <>
                  <input
                    id={id}
                    type="text"
                    list="lista-servicios"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    placeholder="Ej. HOSPITALIZACIÓN, UCI NEONATAL, TORRE B"
                    className="input"
                  />
                  <datalist id="lista-servicios">
                    {SERVICES.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </>
              )}
            </Campo>
            <Campo etiqueta="Ubicación específica">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  value={specificLocation}
                  onChange={(e) => setSpecificLocation(e.target.value)}
                  placeholder="Ej. Cama 4, Box 2"
                  className="input"
                />
              )}
            </Campo>
            <Campo etiqueta="Código de inventario institucional">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  spellCheck={false}
                  value={inventoryCode}
                  onChange={(e) => setInventoryCode(e.target.value)}
                  placeholder="Ej. CDN-BIO-2023-089"
                  className="input font-mono tracking-normal"
                />
              )}
            </Campo>
          </div>
        </section>

        {/* Mantenimiento */}
        <section className="card p-5 lg:col-span-2 lg:p-6">
          <h2 className="text-lg font-medium tracking-[-0.01em]">Detalles del mantenimiento</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Fecha de intervención">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input"
                />
              )}
            </Campo>
            <Campo etiqueta="Estado final del equipo">
              {(id) => (
                <>
                  <input
                    id={id}
                    type="text"
                    list="lista-estados"
                    value={finalStatus}
                    onChange={(e) => setFinalStatus(e.target.value)}
                    placeholder="FUNCIONAL"
                    className="input"
                  />
                  <datalist id="lista-estados">
                    {ESTADOS_SUGERIDOS.map((e) => (
                      <option key={e} value={e} />
                    ))}
                  </datalist>
                  {/* Atajos de un toque: con guantes no se escribe. */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ESTADOS_SUGERIDOS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        aria-pressed={finalStatus.trim().toUpperCase() === e}
                        onClick={() => setFinalStatus(e)}
                        className="pill-tab min-h-10 px-3.5 text-[13px]"
                      >
                        {e.charAt(0) + e.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Campo>
          </div>

          {/* Clase de mantenimiento: tres casillas independientes,
              igual que en el seguimiento en papel. */}
          <fieldset className="mt-5">
            <legend className="field-label">
              Clase de mantenimiento{' '}
              <span className="font-medium text-slate-500">· puede marcar más de una</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              <CasillaClase id="btn-type-preventivo" activa={preventivo} onToggle={() => setPreventivo((v) => !v)} etiqueta="Preventivo" />
              <CasillaClase id="btn-type-correctivo" activa={correctivo} onToggle={() => setCorrectivo((v) => !v)} etiqueta="Correctivo" />
              <CasillaClase id="btn-type-otro" activa={otro} onToggle={() => setOtro((v) => !v)} etiqueta="Otro" />
            </div>
          </fieldset>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Campo etiqueta="Repuestos utilizados" ayuda="Separados por coma." className="lg:col-span-2">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  value={spareParts}
                  onChange={(e) => setSpareParts(e.target.value)}
                  placeholder="Ej. Cable sensor SpO2, Batería 12V"
                  className="input"
                />
              )}
            </Campo>
            <Campo etiqueta="Comentarios de falla / trabajo realizado">
              {(id) => (
                <textarea
                  id={id}
                  rows={3}
                  value={failureComments}
                  onChange={(e) => setFailureComments(e.target.value)}
                  className="input"
                />
              )}
            </Campo>
            <Campo etiqueta="Observaciones adicionales / recomendaciones">
              {(id) => (
                <textarea
                  id={id}
                  rows={3}
                  value={additionalObservations}
                  onChange={(e) => setAdditionalObservations(e.target.value)}
                  className="input"
                />
              )}
            </Campo>
          </div>
        </section>

        {/* Barra de guardado: fija sobre la navegación en el celular,
            al final del formulario en el portátil. */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] lg:static lg:col-span-2 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mx-auto flex max-w-md gap-2.5 lg:max-w-none lg:justify-end">
            <button type="button" id="btn-register-cancel" onClick={onCancel} className="btn btn-ghost px-5">
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-register-submit"
              disabled={isSubmitting}
              className="btn btn-primary min-w-0 flex-1 px-4 lg:flex-none lg:px-10"
            >
              <Save className="hidden size-4 sm:block" />
              {isSubmitting ? 'Guardando…' : 'Registrar mantenimiento'}
            </button>
          </div>
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
  etiqueta: string;
}> = ({ id, activa, onToggle, etiqueta }) => (
  <button type="button" id={id} onClick={onToggle} aria-pressed={activa} className="pill-tab px-5">
    {activa && <Check className="size-4" strokeWidth={3} />}
    {etiqueta}
  </button>
);
