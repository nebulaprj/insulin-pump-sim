import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5174,
    proxy: {
      // Прокси на backend (ips-backend)
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Прокси на сервис телеметрии (ips-telemetry-service)
      '/telemetry-api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/telemetry-api/, '/api'),
      },
    },
  },
})
