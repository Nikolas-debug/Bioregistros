import React, { useState, useRef } from 'react';
import { 
  X, 
  Database, 
  HardDrive, 
  Download, 
  Upload, 
  RotateCcw, 
  User, 
  ShieldCheck, 
  Smartphone, 
  LogOut, 
  CheckCircle2, 
  Wifi, 
  WifiOff, 
  FileSpreadsheet,
  Building2,
  Info
} from 'lucide-react';
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
  const [professionalCard, setProfessionalCard] = useState(user.professionalCard || 'T.P. BIO-88942');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      name: name.trim(),
      institution: institution.trim(),
      role: role.trim(),
      professionalCard: professionalCard.trim()
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-5 text-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-sky-300" />
            <div>
              <h3 className="font-bold text-base">Configuración & IndexedDB</h3>
              <p className="text-xs text-blue-200">Gestión de datos offline y perfil</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-blue-200 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 text-xs">
          
          {/* IndexedDB Status Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <HardDrive className="w-4 h-4 text-blue-600" /> Estado de la Base de Datos Local
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                IndexedDB v1 Activo
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-700">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-medium">Registros de Mantenimiento</span>
                <span className="text-base font-bold text-blue-900 font-mono">{stats.totalRecords}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-medium">Equipos en Inventario</span>
                <span className="text-base font-bold text-blue-900 font-mono">{stats.totalEquipments}</span>
              </div>
            </div>

            {/* Offline readiness badge */}
            <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-blue-50/70 border border-blue-100 p-2 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
              <span>
                Todos los datos se almacenan localmente en su dispositivo y funcionan sin conexión a internet.
              </span>
            </div>
          </div>

          {/* Backup & Restore Section */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Download className="w-4 h-4 text-blue-600" /> Respaldo & Restauración de Datos
            </h4>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onExportBackup}
                className="py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-blue-700" />
                <span>Exportar JSON</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-blue-700" />
                <span>Restaurar JSON</span>
              </button>
            </div>
          </div>

          {/* User Profile Settings */}
          <form onSubmit={handleSaveProfile} className="space-y-3 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" /> Datos del Ingeniero / Institución
              </h4>
              {savedSuccess && (
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Guardado
                </span>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">Nombre Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">Institución / Clínica</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Cargo</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Tarjeta Profesional</label>
                <input
                  type="text"
                  value={professionalCard}
                  onChange={(e) => setProfessionalCard(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs transition-colors shadow-2xs"
            >
              Actualizar Perfil
            </button>
          </form>

          {/* Reset Demo Data & Logout */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="w-full py-2 text-slate-600 hover:text-slate-900 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Restablecer Registros Demo</span>
              </button>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 animate-in fade-in">
                <p className="text-[11px] text-amber-900 font-semibold text-center">
                  ¿Restablecer IndexedDB con los registros clínicos originales?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="py-1 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onResetData();
                      setConfirmReset(false);
                    }}
                    className="py-1 bg-amber-600 text-white font-bold rounded-lg text-xs"
                  >
                    Restablecer
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="w-full py-2 text-rose-600 hover:text-rose-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
