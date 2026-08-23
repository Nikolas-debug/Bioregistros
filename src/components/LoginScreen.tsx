/**
 * Pantalla de ingreso.
 *
 * Valida contra el servidor (`POST /api/auth/login`) y guarda el token que
 * devuelve. Sin conexión no se puede entrar por primera vez, pero una vez
 * dentro la sesión queda guardada en el dispositivo: el técnico abre la app
 * en la ronda, sin señal, y sigue registrando.
 */

import React, { useEffect, useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, WifiOff, ShieldAlert } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { UserProfile } from '../types';

interface LoginScreenProps {
  onLogin: (usuario: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hayServidor, setHayServidor] = useState<boolean | null>(null);

  // Se comprueba el servidor al abrir, para poder decir "no hay conexión"
  // en vez de dejar al usuario probando contraseñas que nunca llegan.
  useEffect(() => {
    let vigente = true;
    api.hayServidor().then((ok) => {
      if (vigente) setHayServidor(ok);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Escriba su usuario y su contraseña.');
      return;
    }

    setCargando(true);
    try {
      const usuario = await api.iniciarSesion(email.trim(), password);
      onLogin(usuario);
    } catch (e) {
      if (e instanceof ApiError && e.esDeRed) {
        setError(
          'No hay conexión con el servidor. Para entrar por primera vez se necesita red.',
        );
        setHayServidor(false);
      } else if (e instanceof ApiError && e.status === 429) {
        setError(e.message);
      } else {
        setError(e instanceof ApiError ? e.message : 'No se pudo iniciar sesión.');
      }
      setPassword('');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-blue-100 via-sky-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-7 sm:p-8">

        {/* Marca */}
        <div className="flex flex-col items-center mb-7">
          <img src="/icon-192.png" alt="" className="w-16 h-16 rounded-2xl shadow-sm" />
          <h1 className="mt-3 text-xl font-bold text-slate-900 tracking-tight">
            Gestión Biomédica
          </h1>
          <p className="text-xs text-slate-500 mt-1">Seguimiento de mantenimientos</p>
        </div>

        {hayServidor === false && (
          <div className="mb-4 flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <WifiOff className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-slate-600">
              No se alcanza el servidor. Si ya había entrado en este dispositivo,
              cierre y vuelva a abrir la aplicación: la sesión guardada sigue
              sirviendo sin conexión.
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <form onSubmit={enviar} className="space-y-3.5">
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="Usuario o correo"
              disabled={cargando}
              className={estiloInput + ' pl-11'}
              required
            />
          </div>

          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type={verClave ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Contraseña"
              disabled={cargando}
              className={estiloInput + ' pl-11 pr-11'}
              required
            />
            <button
              type="button"
              onClick={() => setVerClave((v) => !v)}
              aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              {verClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-700 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 active:scale-[0.99] disabled:opacity-60"
          >
            {cargando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando…
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="mt-6 flex gap-2.5 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-amber-900">
            Versión de prueba con una sola cuenta. Si olvida la contraseña, el
            administrador la restablece desde el servidor.
          </p>
        </div>
      </div>
    </div>
  );
};

const estiloInput =
  'w-full py-3 pr-4 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-800 ' +
  'placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 ' +
  'focus:ring-blue-600 focus:border-transparent transition-all text-sm font-medium ' +
  'disabled:opacity-60';
