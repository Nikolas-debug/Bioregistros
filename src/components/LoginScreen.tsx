import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Fingerprint, Cross, ShieldCheck, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';

interface LoginScreenProps {
  onLogin: (user: Partial<UserProfile>) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('luis.machado@clinicadelnino.com');
  const [password, setPassword] = useState('Biomedica2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin({
        email,
        name: 'Luis Machado',
        role: 'Ingeniero Biomédico',
        institution: 'Clínica del Niño',
        isLoggedIn: true
      });
    }, 400);
  };

  const handleBiometric = () => {
    setLoading(true);
    setMessage('Verificando huella biomédica...');
    setTimeout(() => {
      setLoading(false);
      onLogin({
        email: 'luis.machado@clinicadelnino.com',
        name: 'Luis Machado',
        role: 'Ingeniero Biomédico Jefe',
        institution: 'Clínica del Niño',
        isLoggedIn: true
      });
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 via-sky-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        
        {/* Header Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-18 h-18 bg-cyan-100/70 rounded-full flex items-center justify-center border border-cyan-200 shadow-xs">
            <div className="relative">
              {/* Medical Briefcase Icon representation */}
              <div className="w-10 h-8 bg-blue-600 rounded-md flex items-center justify-center shadow-xs">
                <div className="w-3 h-1.5 border-t-2 border-x-2 border-white rounded-t-xs -mt-7 absolute"></div>
                <div className="w-3.5 h-3.5 text-white flex items-center justify-center font-bold text-sm">
                  +
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Brand & Subtitle */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-blue-950 tracking-tight">
            Clínica del Niño
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Bienvenido de nuevo
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-5 h-5" />
            </div>
            <input
              id="input-login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-sm font-medium"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-5 h-5" />
            </div>
            <input
              id="input-login-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full pl-11 pr-11 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-sm font-medium"
            />
            <button
              type="button"
              id="btn-toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Forgot password */}
          <div className="text-right">
            <button
              type="button"
              onClick={() => alert('Para restablecer su clave comuníquese con Soporte TI de la Clínica del Niño.')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline"
            >
              ¿Olvidó su contraseña?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="btn-login-submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl shadow-md shadow-blue-600/20 hover:shadow-blue-600/30 transition-all flex items-center justify-center text-sm"
          >
            {loading ? 'Validando...' : 'Iniciar Sesión'}
          </button>

          {/* Biometric Login Button */}
          <button
            type="button"
            id="btn-login-biometric"
            onClick={handleBiometric}
            disabled={loading}
            className="w-full py-3 px-4 bg-white border border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-2xs"
          >
            <Fingerprint className="w-5 h-5 text-blue-600" />
            <span>Iniciar con Biometría</span>
          </button>
        </form>

        {/* Message / Status */}
        {message && (
          <p className="mt-3 text-center text-xs text-blue-600 animate-pulse font-medium">
            {message}
          </p>
        )}

        {/* Footer info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            ¿Personal nuevo?{' '}
            <button
              type="button"
              onClick={() => alert('Solicitud de acceso enviada al Administrador Biomédico.')}
              className="font-bold text-blue-700 hover:underline"
            >
              Solicitar acceso
            </button>
          </p>
        </div>

        {/* PWA / IndexedDB offline badge */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Base de datos local IndexedDB • 100% Offline Ready</span>
        </div>

      </div>
    </div>
  );
};
