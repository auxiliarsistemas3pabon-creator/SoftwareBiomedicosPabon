import { useEffect, useRef } from "react";

export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

/**
 * Cierra la sesión tras `timeoutMs` sin actividad del usuario. Es un control de
 * sesión real (a diferencia de intentar detectar el modo incógnito, que no es
 * fiable ni aporta seguridad): una sesión abandonada en cualquier navegador,
 * privado o no, expira sola.
 */
export function useIdleLogout(active: boolean, onIdle: () => void, timeoutMs = IDLE_TIMEOUT_MS) {
  const cb = useRef(onIdle);
  cb.current = onIdle;

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => cb.current(), timeoutMs);
    };
    reset();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [active, timeoutMs]);
}
