/**
 * Pantalla de ingreso.
 *
 * Valida contra el servidor (`POST /api/auth/login`) y guarda el token que
 * devuelve. Sin conexión no se puede entrar por primera vez, pero una vez
 * dentro la sesión queda guardada en el dispositivo: el técnico abre la app
 * en la ronda, sin señal, y sigue registrando.
 */

import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, WifiOff, Info } from 'lucide-react';
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

        <form onSubmit={enviar} className="mt-2 space-y-4">
          <div>
            <label htmlFor="login-usuario" className="field-label">Usuario o correo</label>
            <input
              id="login-usuario"
              type="text"
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
            {cargando ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Verificando…
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <p className="mt-8 flex gap-2.5 text-[13px] leading-relaxed text-slate-500">
          <Info className="mt-0.5 size-4 shrink-0" />
          Versión de prueba con una sola cuenta. Si olvida la contraseña, el administrador la
          restablece desde el servidor.
        </p>
      </div>
    </div>
  );
};
