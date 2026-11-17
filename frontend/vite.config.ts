// defineConfig de 'vitest/config' (no 'vite'): reexporta el mismo
// defineConfig de Vite pero tipando también el bloque `test` de abajo. Es
// el único cambio necesario para que este mismo archivo sirva de config
// tanto para `vite dev/build` como para `vitest`.
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Cabeceras que impiden que el index se cargue dentro de un <iframe> de otro
// sitio (clickjacking). Mismas que ya envía Django y deploy/nginx.conf.example.
const ANTI_FRAMING_HEADERS = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

export default defineConfig(({ command, mode }) => {
  // Dominios autorizados a servir la app (coma separada; ".dominio.com"
  // incluye subdominios). Vite rechaza con 403 cualquier request cuyo Host
  // no esté aquí — localhost y las IPs siempre se aceptan, así los móviles
  // de la LAN siguen pudiendo abrir los QR en desarrollo.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const allowedHosts = (env.VITE_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)

  // Fail-fast: un build de producción sin lista de dominios dejaría la app
  // bloqueada en cualquier host que no sea localhost (ver originGuard.ts).
  if (command === 'build' && mode === 'production' && allowedHosts.length === 0) {
    throw new Error(
      'VITE_ALLOWED_HOSTS es obligatorio para el build de producción ' +
        '(ej: VITE_ALLOWED_HOSTS=biomedicos.clinicapabon.com).',
    )
  }

  return {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    testTimeout: 30000,
    maxWorkers: 2,
    pool: 'threads',
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/types/**', 'src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Librerías estables en archivos aparte: se cachean entre despliegues
        // y no se vuelven a descargar cuando solo cambia el código de la app.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor-react'
          if (/node_modules\/(axios)\//.test(id)) return 'vendor-http'
          if (/node_modules\/qrcode/.test(id)) return 'vendor-qr'
          return undefined
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts,
    headers: ANTI_FRAMING_HEADERS,
    // Proxy hacia Django: así el navegador solo habla con 127.0.0.1:5173
    // (un único origen) y nunca hace un request cross-origin real hacia
    // :8000. Esto es necesario porque el backend entrega el access/refresh
    // token como cookies httpOnly — con dos puertos distintos, algunos
    // navegadores (Edge con "Tracking Prevention", por ejemplo) bloquean
    // esas cookies aunque técnicamente sean "same-site". Reproduce en dev
    // el mismo esquema que ya usa producción (nginx sirviendo /api/ bajo el
    // mismo origen que el frontend — ver frontend/.env.production).
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8010',
        // OJO: NO poner changeOrigin: true. Eso reescribe el header Host de
        // la request proxied a "127.0.0.1:8010", pero el navegador sigue
        // mandando Origin: "http://127.0.0.1:5173" — Django compara ambos
        // en el chequeo de CSRF (ver django/middleware/csrf.py) y con
        // changeOrigin activo nunca coinciden, así que cualquier POST/PUT/
        // PATCH/DELETE autenticado por cookie (refresh, logout, crear
        // equipo, etc.) devuelve 403 "CSRF Failed: Origin checking failed".
        // Sin changeOrigin, Host llega igual a Origin y además
        // DJANGO_ALLOWED_HOSTS ya incluye 127.0.0.1 sin importar el puerto.
      },
      '/ws': {
        target: 'ws://127.0.0.1:8010',
        ws: true,
      },
      // Archivos subidos (QR de equipos, PDFs de hojas de vida, evidencias).
      // Django los sirve bajo /media/ en dev; en prod es nginx/S3. Sin este
      // proxy, <img src="/media/..."> cae en el fallback SPA de Vite y la
      // imagen no carga.
      '/media': { target: 'http://127.0.0.1:8010' },
    },
  },
  preview: {
    allowedHosts,
    headers: ANTI_FRAMING_HEADERS,
  },
  // Declaramos explícitamente las dependencias a pre-bundlear para que el
  // dep-scan de Rolldown no tenga que crawlear todo el grafo de imports en
  // el primer arranque. Esto evita el aviso "Your build spent significant
  // time in plugin externalize-deps" y los errores
  // "The server is being restarted or closed. Request is outdated" que
  // aparecen cuando el scan se interrumpe.
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'axios',
      'clsx',
      'lucide-react',
      'recharts',
    ],
  },
  }
})
