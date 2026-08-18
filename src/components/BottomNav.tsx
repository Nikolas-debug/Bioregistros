import React from 'react';
import { LayoutGrid, PlusCircle, FileText } from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-lg pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-3 h-16">
        {/* Inicio */}
        <button
          id="nav-tab-inicio"
          onClick={() => onTabChange('inicio')}
          className={`flex flex-col items-center justify-center transition-colors ${
            activeTab === 'inicio'
              ? 'text-blue-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutGrid
            className={`w-6 h-6 mb-1 transition-transform ${
              activeTab === 'inicio' ? 'scale-110 stroke-[2.5]' : 'stroke-[1.75]'
            }`}
          />
          <span className="text-xs">Inicio</span>
        </button>

        {/* Registrar */}
        <button
          id="nav-tab-registrar"
          onClick={() => onTabChange('registrar')}
          className={`flex flex-col items-center justify-center transition-colors ${
            activeTab === 'registrar'
              ? 'text-blue-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <PlusCircle
            className={`w-6 h-6 mb-1 transition-transform ${
              activeTab === 'registrar' ? 'scale-110 stroke-[2.5]' : 'stroke-[1.75]'
            }`}
          />
          <span className="text-xs">Registrar</span>
        </button>

        {/* Documentos */}
        <button
          id="nav-tab-documentos"
          onClick={() => onTabChange('documentos')}
          className={`flex flex-col items-center justify-center transition-colors ${
            activeTab === 'documentos'
              ? 'text-blue-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText
            className={`w-6 h-6 mb-1 transition-transform ${
              activeTab === 'documentos' ? 'scale-110 stroke-[2.5]' : 'stroke-[1.75]'
            }`}
          />
          <span className="text-xs">Documentos</span>
        </button>
      </div>
    </nav>
  );
};
