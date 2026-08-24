import React from 'react';
import { LayoutGrid, PlusCircle, FileText } from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

const PESTANAS: { id: ActiveTab; etiqueta: string; Icono: typeof LayoutGrid }[] = [
  { id: 'inicio', etiqueta: 'Inicio', Icono: LayoutGrid },
  { id: 'registrar', etiqueta: 'Registrar', Icono: PlusCircle },
  { id: 'documentos', etiqueta: 'Documentos', Icono: FileText },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-lg pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-3 h-16">
        {PESTANAS.map(({ id, etiqueta, Icono }) => {
          const activa = activeTab === id;

          return (
            <button
              key={id}
              id={`nav-tab-${id}`}
              onClick={() => onTabChange(id)}
              aria-current={activa ? 'page' : undefined}
              className={`flex flex-col items-center justify-center transition-colors ${
                activa
                  ? 'text-blue-600 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icono
                className={`w-6 h-6 mb-1 transition-transform ${
                  activa ? 'scale-110 stroke-[2.5]' : 'stroke-[1.75]'
                }`}
              />
              <span className="text-xs">{etiqueta}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
