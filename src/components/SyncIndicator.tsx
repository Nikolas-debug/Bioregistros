/**
 * Indicador de sincronización.
 *
 * Le dice al técnico, sin tecnicismos, si lo que acaba de registrar ya está
 * en el servidor o todavía está esperando en el celular. Es la única forma
 * de que confíe en trabajar sin conexión.
 */

import React, { useEffect, useState } from 'react';
import { CloudOff, CloudUpload, Cloud, RefreshCw, AlertCircle } from 'lucide-react';
import { syncManager, InstantaneaSync } from '../sync/syncManager';

export const SyncIndicator: React.FC<{ compacto?: boolean }> = ({ compacto }) => {
  const [s, setS] = useState<InstantaneaSync>(syncManager.instantanea());
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => syncManager.suscribir(setS), []);

  const forzar = async () => {
    setSincronizando(true);
    try {
      await syncManager.forzar();
    } finally {
      setSincronizando(false);
    }
  };

  const enMovimiento = sincronizando || s.estado === 'sincronizando';

  /* --- Apariencia según el estado --- */
  const config = (() => {
    if (enMovimiento) {
      return {
        Icono: RefreshCw,
        clase: 'bg-blue-50 text-blue-700 border-blue-200',
        texto: 'Sincronizando…',
        girar: true,
      };
    }
    if (s.estado === 'sin-conexion') {
      return {
        Icono: CloudOff,
        clase: 'bg-slate-100 text-slate-600 border-slate-200',
        texto:
          s.pendientes > 0
            ? `Sin conexión · ${s.pendientes} por subir`
            : 'Sin conexión',
        girar: false,
      };
    }
    if (s.estado === 'error') {
      return {
        Icono: AlertCircle,
        clase: 'bg-amber-50 text-amber-800 border-amber-200',
        texto: `${s.pendientes} registro(s) con problema`,
        girar: false,
      };
    }
    if (s.pendientes > 0) {
      return {
        Icono: CloudUpload,
        clase: 'bg-amber-50 text-amber-800 border-amber-200',
        texto: `${s.pendientes} por subir`,
        girar: false,
      };
    }
    return {
      Icono: Cloud,
      clase: 'bg-green-50 text-green-700 border-green-200',
      texto: 'Todo sincronizado',
      girar: false,
    };
  })();

  const { Icono, clase, texto, girar } = config;

  if (compacto) {
    return (
      <button
        onClick={forzar}
        disabled={enMovimiento}
        title={texto}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${clase}`}
      >
        <Icono className={`w-3.5 h-3.5 ${girar ? 'animate-spin' : ''}`} />
        {s.pendientes > 0 && <span className="tabular-nums">{s.pendientes}</span>}
      </button>
    );
  }

  return (
    <div className={`rounded-xl border p-3 ${clase}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icono className={`w-5 h-5 shrink-0 ${girar ? 'animate-spin' : ''}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{texto}</p>
            {s.ultimaSincronizacion && (
              <p className="text-[11px] opacity-70">
                Última subida:{' '}
                {new Date(s.ultimaSincronizacion).toLocaleString('es-CO', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={forzar}
          disabled={enMovimiento || s.pendientes === 0}
          className="shrink-0 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white disabled:opacity-40"
        >
          Sincronizar
        </button>
      </div>

      {s.ultimoResultado?.errores && s.ultimoResultado.errores.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-current/10 pt-2 text-[11px] opacity-90">
          {s.ultimoResultado.errores.slice(0, 3).map((e) => (
            <li key={e.id}>
              <span className="font-mono">{e.id}</span>: {e.detalle}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
