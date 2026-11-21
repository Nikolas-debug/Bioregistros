import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { grupoEstado } from '../types';

/* ------------------------------------------------------------------ */
/* Estado del equipo                                                   */
/* ------------------------------------------------------------------ */

const ESTADO = {
  funcional: { clase: 'badge-ok', corto: 'Funcional', largo: 'Funcional' },
  espera: { clase: 'badge-wait', corto: 'Repuestos', largo: 'Espera repuestos' },
  fuera: { clase: 'badge-out', corto: 'Fuera serv.', largo: 'Fuera de servicio' },
  'sin-dato': { clase: 'badge-none', corto: 'Sin estado', largo: 'Sin estado' },
} as const;

export const EstadoBadge: React.FC<{ estado: string; corto?: boolean }> = ({ estado, corto }) => {
  const e = ESTADO[grupoEstado(estado)];
  return <span className={`badge ${e.clase}`}>{corto ? e.corto : e.largo}</span>;
};

/* ------------------------------------------------------------------ */
/* Hoja / diálogo                                                      */
/* ------------------------------------------------------------------ */

interface SheetProps {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  icono?: React.ReactNode;
  onClose: () => void;
  /** Botones del pie. Quedan fijos abajo, al alcance del pulgar. */
  pie?: React.ReactNode;
  ancho?: 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

const ANCHOS = { md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-3xl' };

export const Sheet: React.FC<SheetProps> = ({
  titulo,
  subtitulo,
  icono,
  onClose,
  pie,
  ancho = 'md',
  children,
}) => {
  const idTitulo = useId();

  // Escape cierra, y el fondo no se desplaza mientras la hoja está abierta.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', alTeclear);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener('keydown', alTeclear);
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={idTitulo} className={`sheet ${ANCHOS[ancho]}`}>
        <div className="sheet-head">
          <div className="flex min-w-0 items-start gap-3">
            {icono && (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-900">
                {icono}
              </span>
            )}
            <div className="min-w-0 pt-0.5">
              <h2 id={idTitulo} className="text-xl leading-tight font-medium tracking-[-0.015em] text-slate-900">
                {titulo}
              </h2>
              {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-icon -mt-1 -mr-2" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>

        <div className="sheet-body">{children}</div>

        {pie && <div className="sheet-foot">{pie}</div>}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Campo con etiqueta visible                                          */
/* ------------------------------------------------------------------ */

export const Campo: React.FC<{
  etiqueta: string;
  ayuda?: React.ReactNode;
  className?: string;
  children: (id: string) => React.ReactNode;
}> = ({ etiqueta, ayuda, className, children }) => {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {etiqueta}
      </label>
      {children(id)}
      {ayuda && <p className="field-hint">{ayuda}</p>}
    </div>
  );
};
