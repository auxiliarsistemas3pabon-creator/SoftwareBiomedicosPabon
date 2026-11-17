// Se carga una vez antes de toda la suite (ver `test.setupFiles` en
// vite.config.ts). Registra los matchers de jest-dom (toBeInTheDocument,
// toHaveClass, etc.) sobre `expect` de Vitest.
import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Node >= 25 trae un `localStorage`/`sessionStorage` global experimental que,
// sin --localstorage-file, vale `undefined` y tapa el de jsdom. Restauramos
// el Storage de jsdom para que los tests funcionen en cualquier versión de Node.
const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;
if (jsdomWindow) {
  for (const key of ["localStorage", "sessionStorage"] as const) {
    if (!globalThis[key]) {
      Object.defineProperty(globalThis, key, {
        value: jsdomWindow[key],
        configurable: true,
        writable: true,
      });
    }
  }
}

// @testing-library/react solo registra su propio afterEach(cleanup) cuando
// detecta un `afterEach` global (test.globals: true en la config). Como acá
// no usamos globals (imports explícitos de "vitest" en cada test), sin esto
// el DOM montado por `render()` se acumula entre tests del mismo archivo.
afterEach(() => {
  cleanup();
});

// Máquinas lentas / CI compartido: damos más margen a findBy*/waitFor. Solo se
// agota cuando la prueba va a fallar de todos modos; las que pasan no esperan
// más. Debe quedar por debajo de testTimeout (30 s).
configure({ asyncUtilTimeout: 10000 });
