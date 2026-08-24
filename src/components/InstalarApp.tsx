/**
 * Invitación a instalar la aplicación en el teléfono.
 *
 * Una PWA no se baja de una tienda: el propio navegador ofrece guardarla
 * en la pantalla de inicio, y desde ahí abre a pantalla completa, sin
 * barra de direcciones, con su icono. Es la misma aplicación, solo que a
 * un toque de distancia y sin depender de que el técnico recuerde la
 * dirección.
 *
 * Los dos caminos son distintos y no hay forma de unificarlos:
 *
 *   Android / Chrome / Edge  El navegador avisa con el evento
 *                            `beforeinstallprompt`. Lo interceptamos,
 *                            guardamos el aviso y lo disparamos cuando
 *                            el técnico toca el botón.
 *
 *   iPhone / Safari          Apple no implementa ese evento. Toca
 *                            explicarle los pasos: Compartir → Añadir a
 *                            pantalla de inicio.
 */

import React, { useEffect, useState } from 'react';
import { Download, Share, Plus, X, CheckCircle2 } from 'lucide-react';

/** El evento que dispara Chrome. No está en las definiciones estándar. */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const LLAVE_OCULTO = 'biomedica.instalar.oculto';
// Corto a proposito: el piloto con Luis dura un mes. Si descarta la
// invitacion sin querer, no puede quedarse media prueba sin volver a
// verla.
const DIAS_DE_ESPERA = 7;

/** ¿Ya está corriendo instalada, fuera del navegador? */
function yaInstalada(): boolean {
  if (typeof window === 'undefined') return false;

  const enModoApp = window.matchMedia?.('(display-mode: standalone)').matches;

  // Safari en iOS no soporta display-mode y usa su propia bandera.
  const enModoAppApple = (window.navigator as { standalone?: boolean }).standalone === true;

  return Boolean(enModoApp || enModoAppApple);
}

function esApple(): boolean {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent;

  // Los iPad recientes se anuncian como Mac; el multitáctil los delata.
  const iPadDisfrazado = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;

  return /iPhone|iPad|iPod/.test(ua) || iPadDisfrazado;
}

/** ¿El técnico la descartó hace poco? */
function descartadaHacePoco(): boolean {
  try {
    const cuando = localStorage.getItem(LLAVE_OCULTO);
    if (!cuando) return false;

    const dias = (Date.now() - Number(cuando)) / 86_400_000;

    return dias < DIAS_DE_ESPERA;
  } catch {
    return false;
  }
}

export const InstalarApp: React.FC = () => {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  const [visible, setVisible] = useState(false);
  const [instrucciones, setInstrucciones] = useState(false);
  const [instalada, setInstalada] = useState(false);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    if (yaInstalada() || descartadaHacePoco()) return;

    // iPhone: no hay evento que esperar, se muestra de una vez.
    if (esApple()) {
      setApple(true);
      setVisible(true);

      return;
    }

    const alPoderInstalar = (e: Event) => {
      // Sin esto, Chrome muestra su propia barra abajo y no nos deja
      // escoger el momento.
      e.preventDefault();
      setEvento(e as EventoInstalacion);
      setVisible(true);
    };

    const alInstalar = () => {
      setInstalada(true);
      setEvento(null);
      // Un momento de confirmación y se retira sola.
      setTimeout(() => setVisible(false), 4000);
    };

    window.addEventListener('beforeinstallprompt', alPoderInstalar);
    window.addEventListener('appinstalled', alInstalar);

    return () => {
      window.removeEventListener('beforeinstallprompt', alPoderInstalar);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  const instalar = async () => {
    if (!evento) return;

    await evento.prompt();
    const { outcome } = await evento.userChoice;

    // El aviso solo sirve una vez: si lo rechazó, Chrome no lo vuelve a
    // dar en esta visita. Si lo aceptó, el evento `appinstalled` se
    // encarga del mensaje de confirmación.
    setEvento(null);

    if (outcome === 'dismissed') {
      cerrar();
    }
  };

  const cerrar = () => {
    setVisible(false);
    try {
      localStorage.setItem(LLAVE_OCULTO, String(Date.now()));
    } catch {
      // Modo privado o almacenamiento bloqueado: no pasa nada, la
      // invitación simplemente volverá a salir la próxima vez.
    }
  };

  // En Android la tarjeta solo tiene sentido mientras el aviso del
  // navegador siga vivo. Sin él no hay nada que ofrecer, y los pasos de
  // Safari no aplican.
  if (!visible || (!apple && !evento && !instalada)) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-20 z-40 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96"
      role="dialog"
      aria-label="Instalar la aplicación"
    >
      <div className="rounded-2xl border border-blue-200 bg-white shadow-xl shadow-slate-900/10">
        {instalada ? (
          <div className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
            <p className="text-sm font-semibold text-slate-800">
              Lista. Búsquela en la pantalla de inicio.
            </p>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600">
                <Download className="h-5 w-5 text-white" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  Instalar en este dispositivo
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  Queda con su icono en la pantalla de inicio y abre a pantalla
                  completa, con o sin señal.
                </p>
              </div>

              <button
                onClick={cerrar}
                aria-label="Ahora no"
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Android: un botón. iPhone: los pasos, que es lo único que hay. */}
            {evento ? (
              <button
                onClick={instalar}
                className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800"
              >
                Instalar
              </button>
            ) : instrucciones ? (
              <ol className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <span className="font-bold text-slate-400">1.</span>
                  <span className="flex items-center gap-1.5">
                    Toque
                    <Share className="h-4 w-4 text-blue-600" />
                    <strong>Compartir</strong>, abajo en Safari
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold text-slate-400">2.</span>
                  <span className="flex items-center gap-1.5">
                    Baje y escoja
                    <Plus className="h-4 w-4 text-blue-600" />
                    <strong>Añadir a pantalla de inicio</strong>
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold text-slate-400">3.</span>
                  <span>
                    Confirme con <strong>Añadir</strong>
                  </span>
                </li>
              </ol>
            ) : (
              <button
                onClick={() => setInstrucciones(true)}
                className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800"
              >
                Ver cómo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
