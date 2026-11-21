import React, { useState, useRef } from 'react';
import { Download, Upload, RotateCcw, LogOut, CheckCircle2, Settings } from 'lucide-react';
import { Campo, Sheet } from './ui';
import { UserProfile, DatabaseStats } from '../types';

interface SettingsModalProps {
  user: UserProfile;
  stats: DatabaseStats;
  isOnline: boolean;
  onClose: () => void;
  onUpdateUser: (user: Partial<UserProfile>) => void;
  onExportBackup: () => Promise<void>;
  onImportBackup: (file: File) => Promise<void>;
  onResetData: () => Promise<void>;
  onLogout: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  user,
  stats,
  isOnline,
  onClose,
  onUpdateUser,
  onExportBackup,
  onImportBackup,
  onResetData,
  onLogout
}) => {
  const [name, setName] = useState(user.name);
  const [institution, setInstitution] = useState(user.institution);
  const [role, setRole] = useState(user.role);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      name: name.trim(),
      institution: institution.trim(),
      role: role.trim()
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
    }
  };

  return (
    <Sheet
      titulo="Configuración"
      subtitulo="Gestión de datos sin conexión y perfil"
      icono={<Settings className="size-5" />}
      onClose={onClose}
    >
      {/* Base de datos local */}
      <section className="soft p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-medium text-slate-900">Base de datos local</h3>
          <span className="badge badge-ok">Activa</span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4">
            <dt className="kv-label">Registros de mantenimiento</dt>
            <dd className="mt-1 text-2xl font-medium text-slate-900 tabular-nums">{stats.totalRecords}</dd>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <dt className="kv-label">Equipos en inventario</dt>
            <dd className="mt-1 text-2xl font-medium text-slate-900 tabular-nums">{stats.totalEquipments}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
          Todos los datos se almacenan localmente en su dispositivo y funcionan sin conexión a internet.
        </p>
      </section>

      {/* Respaldo */}
      <section className="mt-7">
        <h3 className="text-base font-medium text-slate-900">Respaldo y restauración</h3>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onExportBackup} className="btn btn-ghost px-3">
            <Download className="size-4" /> Exportar JSON
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-ghost px-3">
            <Upload className="size-4" /> Restaurar JSON
          </button>
        </div>
      </section>

      {/* Perfil */}
      <form onSubmit={handleSaveProfile} className="mt-7 border-t border-slate-200 pt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-medium text-slate-900">Datos del ingeniero e institución</h3>
          {savedSuccess && (
            <span className="badge badge-ok" role="status">
              <CheckCircle2 className="size-3.5" /> Guardado
            </span>
          )}
        </div>
        <div className="mt-3 grid gap-4">
          <Campo etiqueta="Nombre completo">
            {(id) => <input id={id} type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" />}
          </Campo>
          <Campo etiqueta="Institución / clínica">
            {(id) => (
              <input id={id} type="text" value={institution} onChange={(e) => setInstitution(e.target.value)} className="input" />
            )}
          </Campo>
          <Campo etiqueta="Cargo">
            {(id) => <input id={id} type="text" value={role} onChange={(e) => setRole(e.target.value)} className="input" />}
          </Campo>
        </div>
        <button type="submit" className="btn btn-ink mt-4 w-full">
          Actualizar perfil
        </button>
      </form>

      {/* Borrado y cierre de sesión */}
      <section className="mt-7 space-y-3 border-t border-slate-200 pt-6">
        {!confirmReset ? (
          <button type="button" onClick={() => setConfirmReset(true)} className="btn btn-ghost w-full">
            <RotateCcw className="size-4" /> Borrar todos los datos de este dispositivo
          </button>
        ) : (
          <div className="rounded-3xl bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-950">
              Se borrarán los registros y el inventario guardados aquí.
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-amber-900">
              Lo que ya se sincronizó sigue a salvo en el servidor. Lo que esté pendiente de subir se pierde.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => setConfirmReset(false)} className="btn btn-ghost bg-white">
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onResetData();
                  setConfirmReset(false);
                }}
                className="btn btn-danger"
              >
                Sí, borrar
              </button>
            </div>
          </div>
        )}

        <button type="button" onClick={onLogout} className="btn w-full border-2 border-rose-200 text-rose-700 hover:bg-rose-50">
          <LogOut className="size-4" /> Cerrar sesión
        </button>
      </section>
    </Sheet>
  );
};
