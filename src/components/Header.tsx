import React from 'react';
import { Settings, Wifi, WifiOff, Database } from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  user: UserProfile;
  onOpenSettings: () => void;
  isOnline: boolean;
  totalRecordsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenSettings,
  isOnline,
  totalRecordsCount
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 shadow-xs">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* User profile & Institution */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-10 h-10 rounded-full object-cover border-2 border-blue-600 shadow-xs"
              onError={(e) => {
                // Fallback to stylized initials if image fails
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80';
              }}
            />
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                isOnline ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              title={isOnline ? 'Conectado a la red' : 'Modo Offline (IndexedDB Activo)'}
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              {user.institution}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{user.name}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3 text-blue-600" />
                <span className="font-mono text-[11px] font-semibold">{totalRecordsCount} reg.</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          {!isOnline && (
            <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              Offline
            </span>
          )}
          <button
            id="btn-header-settings"
            onClick={onOpenSettings}
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-colors relative"
            title="Configuración y base de datos IndexedDB"
            aria-label="Configuración"
          >
            <Settings className="w-6 h-6 text-blue-700 hover:rotate-45 transition-transform" />
          </button>
        </div>
      </div>
    </header>
  );
};
