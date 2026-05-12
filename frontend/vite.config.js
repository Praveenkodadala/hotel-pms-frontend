import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  /**
   * VITE_API_TARGET — internal proxy target for dev server
   *   Docker:     http://backend:4000  (service name in docker-compose)
   *   Local dev:  http://localhost:4000
   *
   * VITE_API_URL — public-facing API URL (used by browser)
   *   Dev:   /api  (proxied by Vite)
   *   Prod:  https://api.your-domain.com/api
   */
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:4000';

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 3000,
      proxy: {
        '/api': {
          target:       apiTarget,
          changeOrigin: true,
          secure:       false,
        },
      },
    },
    build: {
      outDir:        'dist',
      sourcemap:     mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor:   ['react','react-dom','react-router-dom'],
            charts:   ['recharts'],
            http:     ['axios'],
          },
        },
      },
    },
    define: {
      __APP_ENV__: JSON.stringify(mode),
    },
  };
});
