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

  const descartar = async () => {
    const seguir = window.confirm(
      `El servidor rechazó ${s.rechazados} registro(s) y reenviarlos no lo va a cambiar ` +
      '(por ejemplo, porque ese número de reporte ya existe).\n\n' +
      'Se borrarán de este dispositivo. Lo que ya está en el servidor no se toca.\n\n' +
      '¿Descartarlos?'
    );
    if (seguir) await syncManager.descartarRechazados();
  };

  const enMovimiento = sincronizando || s.estado === 'sincronizando';

  /* --- Apariencia según el estado --- */
  const config = (() => {
    if (enMovimiento) {
      return { Icono: RefreshCw, fondo: 'bg-blue-50', icono: 'bg-blue-700 text-white', texto: 'Sincronizando…', girar: true };
    }
    if (s.estado === 'sin-conexion') {
      return {
        Icono: CloudOff,
        fondo: 'bg-slate-100',
        icono: 'bg-slate-500 text-white',
        texto: s.pendientes > 0 ? `Sin conexión · ${s.pendientes} por subir` : 'Sin conexión',
        girar: false,
      };
    }
    if (s.estado === 'error' || s.rechazados > 0) {
      return { Icono: AlertCircle, fondo: 'bg-amber-50', icono: 'bg-amber-400 text-slate-900', texto: `${s.pendientes} registro(s) con problema`, girar: false };
    }
    if (s.pendientes > 0) {
      return { Icono: CloudUpload, fondo: 'bg-amber-50', icono: 'bg-amber-400 text-slate-900', texto: `${s.pendientes} por subir`, girar: false };
    }
    return { Icono: Cloud, fondo: 'bg-slate-100', icono: 'bg-emerald-700 text-white', texto: 'Todo sincronizado', girar: false };
  })();

  const { Icono, fondo, icono, texto, girar } = config;

  if (compacto) {
    return (
      <button
        onClick={forzar}
        disabled={enMovimiento}
        title={texto}
        className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold ${fondo}`}
      >
        <Icono className={`size-4 ${girar ? 'animate-spin' : ''}`} />
        {s.pendientes > 0 && <span className="tabular-nums">{s.pendientes}</span>}
      </button>
    );
  }

  return (
    <div className={`rounded-3xl p-2 pl-3 ${fondo}`} role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${icono}`}>
            <Icono className={`size-[18px] ${girar ? 'animate-spin' : ''}`} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{texto}</p>
            {s.ultimaSincronizacion && (
              <p className="truncate text-xs text-slate-600">
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

        {s.pendientes > 0 && (
          <button onClick={forzar} disabled={enMovimiento} className="btn btn-sm btn-ink">
            Sincronizar
          </button>
        )}
      </div>

      {s.rechazados > 0 && !enMovimiento && (
        <button onClick={descartar} className="btn btn-sm btn-ghost mt-2 w-full bg-white">
          Descartar {s.rechazados} rechazado(s)
        </button>
      )}

      {s.ultimoResultado?.errores && s.ultimoResultado.errores.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-slate-900/10 px-1 pt-2 pb-1 text-xs text-slate-700">
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
