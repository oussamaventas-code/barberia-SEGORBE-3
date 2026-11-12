import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

const demo = (p: string) => path.resolve(import.meta.dirname, 'src/demo', p);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const serverMode = (process.env.VITE_API_MODE || env.VITE_API_MODE) === 'server';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(import.meta.dirname, '.') },
        // Modo demo: el backend se ejecuta en el navegador → sustituimos los módulos de Node
        ...(serverMode
          ? []
          : [
              { find: /^(\.\.\/)+db\/index\.ts$/, replacement: demo('browser-db.ts') },
              { find: /^(\.\.\/)+lib\/session\.ts$/, replacement: demo('browser-session.ts') },
              { find: /^node:crypto$/, replacement: demo('node-crypto-shim.ts') },
              { find: /^express$/, replacement: demo('express-shim.ts') },
            ]),
      ],
    },
    define: serverMode ? {} : { 'process.env': '{}' },
    optimizeDeps: {
      exclude: ['@electric-sql/pglite'],
    },
    worker: { format: 'es' },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
