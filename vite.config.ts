import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    // Tailwind 4 define la paleta en oklch(); Chrome < 111 y Samsung Internet
    // viejo (p. ej. Galaxy A03) la descartan y no se ve ningun color.
    // Lightning CSS agrega el respaldo en rgb para Chrome 99+ y Samsung Internet 18+
    // (minimo por @layer).
    css: {lightningcss: {targets: {chrome: 99 << 16, samsung: 18 << 16}}},
    build: {cssMinify: 'lightningcss' as const},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Todo lo que empiece por /api se reenvia al backend de Laravel
      // (php artisan serve). Asi el navegador ve un mismo origen y no
      // hay problemas de CORS en desarrollo.
      proxy: {
        '/api': {
          target: process.env.API_BACKEND || 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
