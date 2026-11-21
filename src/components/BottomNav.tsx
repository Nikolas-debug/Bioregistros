import React from 'react';
import { LayoutGrid, Plus, FileText } from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const PESTANAS: { id: ActiveTab; etiqueta: string; Icono: typeof LayoutGrid }[] = [
  { id: 'inicio', etiqueta: 'Inicio', Icono: LayoutGrid },
  { id: 'registrar', etiqueta: 'Registrar', Icono: Plus },
  { id: 'documentos', etiqueta: 'Documentos', Icono: FileText },
];

/**
 * Barra inferior del celular. "Registrar" va al centro como píldora azul:
 * es la acción del día y queda justo bajo el pulgar.
 */
export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-safe lg:hidden"
    >
      <div className="mx-auto grid h-[72px] max-w-md grid-cols-3 items-center px-2">
        {PESTANAS.map(({ id, etiqueta, Icono }) => {
          const activa = activeTab === id;

          if (id === 'registrar') {
            return (
              <div key={id} className="flex justify-center">
                <button
                  id={`nav-tab-${id}`}
                  onClick={() => onTabChange(id)}
                  aria-current={activa ? 'page' : undefined}
                  className={`btn h-13 px-5 shadow-[0_4px_14px_rgba(29,78,216,0.35)] ${
                    activa ? 'bg-blue-900 text-white' : 'btn-primary'
                  }`}
                >
                  <Icono className="size-5" strokeWidth={2.5} />
                  {etiqueta}
                </button>
              </div>
            );
          }

          return (
            <button
              key={id}
              id={`nav-tab-${id}`}
              onClick={() => onTabChange(id)}
              aria-current={activa ? 'page' : undefined}
              className={`flex h-full flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${
                activa ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                  activa ? 'bg-slate-900 text-white' : ''
                }`}
              >
                <Icono className="size-5" strokeWidth={activa ? 2.25 : 1.75} />
              </span>
              <span className={`text-xs ${activa ? 'font-bold' : 'font-medium'}`}>{etiqueta}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
