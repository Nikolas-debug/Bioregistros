import React from 'react';
import { Settings, WifiOff } from 'lucide-react';
import { ActiveTab, UserProfile } from '../types';
import { PESTANAS } from './BottomNav';

interface HeaderProps {
  user: UserProfile;
  onOpenSettings: () => void;
  isOnline: boolean;
  totalRecordsCount: number;
  /** En pantallas grandes la navegación vive aquí, no abajo. */
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

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
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 lg:h-[72px] lg:px-8">

        {/* Identidad */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <div
              className="flex size-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white"
              aria-hidden="true"
            >
              {iniciales(user.name)}
            </div>
            <span
              className={`absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-white ${
                isOnline ? 'bg-emerald-500' : 'bg-amber-400'
              }`}
              title={isOnline ? 'Con conexión' : 'Sin conexión (los registros se guardan igual)'}
            />
          </div>

          <div className="min-w-0">
            <p className="truncate text-[15px] leading-tight font-bold text-slate-900">
              {user.institution || 'Gestión Biomédica'}
            </p>
            <p className="truncate text-[13px] text-slate-500">
              {user.name}
              <span className="hidden sm:inline">
                {' · '}
                <span className="tabular-nums">{totalRecordsCount}</span> registros
              </span>
            </p>
          </div>
        </div>

        {/* Navegación de escritorio: en el celular vive abajo */}
        <nav aria-label="Secciones" className="hidden items-center gap-2 lg:flex">
          {PESTANAS.map(({ id, etiqueta, Icono }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              aria-current={activeTab === id ? 'page' : undefined}
              className="pill-tab"
            >
              <Icono className="size-4" />
              {etiqueta}
            </button>
          ))}
        </nav>

        {/* Acciones */}
        <div className="flex shrink-0 items-center gap-1">
          {!isOnline && (
            <span className="badge badge-wait">
              <WifiOff className="size-3.5" />
              <span className="hidden sm:inline">Sin conexión</span>
            </span>
          )}
          <button
            id="btn-header-settings"
            onClick={onOpenSettings}
            className="btn-icon"
            title="Ajustes"
            aria-label="Ajustes"
          >
            <Settings className="size-6" />
          </button>
        </div>
      </div>
    </header>
  );
};
