import React from 'react';
import { Settings, WifiOff, Database, LayoutGrid, PlusCircle, FileText } from 'lucide-react';
import { ActiveTab, UserProfile } from '../types';

interface HeaderProps {
  user: UserProfile;
  onOpenSettings: () => void;
  isOnline: boolean;
  totalRecordsCount: number;
  /** En pantallas grandes la navegación vive aquí, no abajo. */
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

const PESTANAS: { id: ActiveTab; etiqueta: string; Icono: typeof LayoutGrid }[] = [
  { id: 'inicio', etiqueta: 'Inicio', Icono: LayoutGrid },
  { id: 'registrar', etiqueta: 'Registrar', Icono: PlusCircle },
  { id: 'documentos', etiqueta: 'Documentos', Icono: FileText },
];


function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenSettings,
  isOnline,
  totalRecordsCount,
  activeTab,
  onTabChange,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 shadow-xs">
      <div className="max-w-md lg:max-w-6xl mx-auto flex items-center justify-between gap-4">

        {/* Identidad */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div
              className="w-10 h-10 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-sm border-2 border-blue-600 shadow-xs"
              aria-hidden="true"
            >
              {iniciales(user.name)}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                isOnline ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              title={isOnline ? 'Con conexión' : 'Sin conexión (los registros se guardan igual)'}
            />
          </div>

          <div className="min-w-0">
            <h1 className="text-base lg:text-lg font-bold text-slate-900 leading-tight truncate">
              {user.institution || 'Gestión Biomédica'}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-medium text-slate-700 truncate">{user.name}</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:flex items-center gap-1">
                <Database className="w-3 h-3 text-blue-600" />
                <span className="font-mono text-[11px] font-semibold">
                  {totalRecordsCount} reg.
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Navegación de escritorio: en el celular esto vive abajo */}
        <nav className="hidden lg:flex items-center gap-1">
          {PESTANAS.map(({ id, etiqueta, Icono }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              aria-current={activeTab === id ? 'page' : undefined}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icono className="w-4 h-4" />
              {etiqueta}
            </button>
          ))}
        </nav>

        {/* Acciones */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isOnline && (
            <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              <span className="hidden sm:inline">Sin conexión</span>
            </span>
          )}
          <button
            id="btn-header-settings"
            onClick={onOpenSettings}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            title="Ajustes"
            aria-label="Ajustes"
          >
            <Settings className="w-6 h-6 text-blue-700 hover:rotate-45 transition-transform" />
          </button>
        </div>
      </div>
    </header>
  );
};
