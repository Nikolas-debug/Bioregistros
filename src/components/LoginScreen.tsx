/**
 * Pantalla de ingreso.
 *
 * Lo normal es entrar con un código de 6 dígitos que llega al correo
 * (`POST /api/auth/codigo` y `/auth/codigo/verificar`). La contraseña queda
 * de respaldo por si el correo falla. Las dos devuelven el mismo token.
 *
 * Sin conexión no se puede entrar por primera vez, pero una vez dentro la
 * sesión queda guardada en el dispositivo: el técnico abre la app en la
 * ronda, sin señal, y sigue registrando.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Info, Loader2, Mail, WifiOff } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { UserProfile } from '../types';

interface LoginScreenProps {
  onLogin: (usuario: UserProfile) => void;
}

type Modo = 'correo' | 'codigo' | 'clave';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [modo, setModo] = useState<Modo>('correo');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [hayServidor, setHayServidor] = useState<boolean | null>(null);
  const campoCodigo = useRef<HTMLInputElement>(null);

  // Se comprueba el servidor al abrir, para poder decir "no hay conexión"
  // en vez de dejar al usuario esperando un correo que nunca sale.
  useEffect(() => {
    let vigente = true;
    api.hayServidor().then((ok) => {
      if (vigente) setHayServidor(ok);
    });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (modo === 'codigo') campoCodigo.current?.focus();
  }, [modo]);

  const cambiarModo = (m: Modo) => {
    setModo(m);
    setError(null);
    setAviso(null);
  };

  /** Traduce el fallo a algo que el técnico pueda resolver. */
  const mostrarError = (e: unknown, porDefecto: string) => {
    if (e instanceof ApiError && e.esDeRed) {
      setError('No hay conexión con el servidor. Para entrar por primera vez se necesita red.');
      setHayServidor(false);
    } else {
      setError(e instanceof ApiError ? e.message : porDefecto);
    }
  };

  const pedirCodigo = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Escriba su correo.');
      return;
    }

    setCargando(true);
    try {
      setAviso(await api.pedirCodigo(email.trim()));
      setCodigo('');
      setModo('codigo');
    } catch (e) {
      mostrarError(e, 'No se pudo enviar el código.');
    } finally {
      setCargando(false);
    }
  };

  const entrarConCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(codigo)) {
      setError('El código son 6 números.');
      return;
    }

    setCargando(true);
    try {
      onLogin(await api.entrarConCodigo(email.trim(), codigo));
    } catch (e) {
      mostrarError(e, 'No se pudo iniciar sesión.');
      setCodigo('');
    } finally {
      setCargando(false);
    }
  };

  const entrarConClave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Escriba su correo y su contraseña.');
      return;
    }

    setCargando(true);
    try {
      onLogin(await api.iniciarSesion(email.trim(), password));
    } catch (e) {
      mostrarError(e, 'No se pudo iniciar sesión.');
      setPassword('');
    } finally {
      setCargando(false);
    }
  };

  const campoCorreo = (
    <div>
      <label htmlFor="login-usuario" className="field-label">Correo</label>
      <input
        id="login-usuario"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setError(null);
        }}
        disabled={cargando}
        className="input"
        required
      />
    </div>
  );

  const girando = <Loader2 className="size-5 animate-spin" />;

  return (
    <div className="flex min-h-dvh flex-col bg-white px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-28 sm:items-center sm:justify-center sm:p-6">
      <div className="w-full sm:max-w-[420px] sm:rounded-feature sm:border sm:border-slate-200 sm:p-10">

        {/* Marca */}
        <img src="/icon-192.png" alt="" className="size-14 rounded-2xl" />
        <h1 className="t-display mt-6">Gestión Biomédica</h1>
        <p className="t-lead mt-1">Seguimiento de mantenimientos</p>

        <div className="mt-8 space-y-3">
          {hayServidor === false && (
            <div className="notice bg-slate-100 text-slate-700">
              <WifiOff className="mt-0.5 size-4 shrink-0" />
              <p className="text-[13px]">
                No se alcanza el servidor. Si ya había entrado en este dispositivo, cierre y vuelva
                a abrir la aplicación: la sesión guardada sigue sirviendo sin conexión.
              </p>
            </div>
          )}

          {error && (
            <div role="alert" className="notice notice-error">
              {error}
            </div>
          )}
        </div>

        {/* 1. Correo → código */}
        {modo === 'correo' && (
          <form onSubmit={pedirCodigo} className="mt-2 space-y-4">
            {campoCorreo}
            <button type="submit" disabled={cargando} className="btn btn-lg btn-primary mt-2 w-full">
              {cargando ? <>{girando} Enviando…</> : <><Mail className="size-5" /> Enviar código</>}
            </button>
            <p className="text-center text-[13px] text-slate-500">Le llegará un código de 6 dígitos al correo.</p>
          </form>
        )}

        {/* 2. El código que llegó */}
        {modo === 'codigo' && (
          <form onSubmit={entrarConCodigo} className="mt-2 space-y-4">
            {aviso && (
              <div className="notice notice-info text-[13px]" role="status">
                <Mail className="mt-0.5 size-4 shrink-0" />
                <p>
                  {aviso} <span className="font-bold break-all">{email.trim()}</span>
                </p>
              </div>
            )}

            <div>
              <label htmlFor="login-codigo" className="field-label">Código</label>
              <input
                id="login-codigo"
                ref={campoCodigo}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError(null);
                }}
                disabled={cargando}
                className="input text-center text-2xl font-bold tracking-[0.4em] tabular-nums"
                required
              />
            </div>

            <button type="submit" disabled={cargando || codigo.length !== 6} className="btn btn-lg btn-primary mt-2 w-full">
              {cargando ? <>{girando} Verificando…</> : 'Entrar'}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => cambiarModo('correo')} className="btn-text -ml-3">
                <ArrowLeft className="size-4" /> Cambiar correo
              </button>
              <button type="button" onClick={() => pedirCodigo()} disabled={cargando} className="btn-text -mr-3">
                Enviar otro código
              </button>
            </div>
          </form>
        )}

        {/* Respaldo: contraseña */}
        {modo === 'clave' && (
          <form onSubmit={entrarConClave} className="mt-2 space-y-4">
            {campoCorreo}
            <div>
              <label htmlFor="login-clave" className="field-label">Contraseña</label>
              <div className="relative">
                <input
                  id="login-clave"
                  type={verClave ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  disabled={cargando}
                  className="input pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="btn-icon absolute top-1/2 right-0.5 -translate-y-1/2 text-slate-500"
                >
                  {verClave ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={cargando} className="btn btn-lg btn-primary mt-2 w-full">
              {cargando ? <>{girando} Verificando…</> : 'Entrar'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          {modo === 'clave' ? (
            <button type="button" onClick={() => cambiarModo('correo')} className="btn-text">
              Entrar con código por correo
            </button>
          ) : (
            <button type="button" onClick={() => cambiarModo('clave')} className="btn-text text-slate-600 hover:bg-slate-100">
              Entrar con contraseña
            </button>
          )}
        </div>

        <p className="mt-6 flex gap-2.5 text-[13px] leading-relaxed text-slate-500">
          <Info className="mt-0.5 size-4 shrink-0" />
          Si no le llega el código, revise la carpeta de spam o entre con su contraseña.
        </p>

        <p className="mt-8 text-center text-xs text-slate-500">© 2026 Stonemills</p>
      </div>
    </div>
  );
};
