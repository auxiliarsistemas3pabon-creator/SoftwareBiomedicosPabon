// Guard de origen: impide que el index de la app se use desde una URL que no
// sea la nuestra. Corre en main.tsx ANTES de montar React.
//
// Cubre tres escenarios:
//   1. La app embebida en un <iframe> de otro sitio (clickjacking): se saca
//      la app a la ventana principal; si el navegador no lo permite, la
//      página queda en blanco y React nunca se monta.
//   2. El bundle servido bajo un dominio ajeno (mirror/proxy de phishing,
//      DNS apuntado a nuestro servidor, DNS rebinding): no se monta la app.
//   3. Protocolos que no son http/https (file://, data:, blob:...).
//
// IMPORTANTE: esto es defensa en profundidad. La barrera real son las
// cabeceras del servidor (X-Frame-Options / CSP frame-ancestors, ya en
// Django, vite.config.ts y deploy/nginx.conf.example) y el rechazo de Hosts
// desconocidos en nginx/Vite. Un atacante que copie y modifique el JS puede
// quitar este guard, pero NO puede quitar las cabeceras ni hacer que el
// backend acepte sus cookies/CSRF desde otro origen.

export type OriginVerdict = "ok" | "framed" | "foreign-host" | "bad-protocol";

export interface OriginContext {
  hostname: string;
  protocol: string;
  isFramed: boolean;
  /** Hosts permitidos. Un ".dominio.com" permite también sus subdominios. */
  allowedHosts: readonly string[];
  /** En desarrollo se aceptan IPs de red privada (móviles en la LAN, QR). */
  allowPrivateNetwork: boolean;
}

const ALWAYS_ALLOWED = ["localhost", "127.0.0.1", "[::1]", "::1"];

export function parseAllowedHosts(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function isPrivateIPv4(hostname: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function isHostAllowed(
  hostname: string,
  allowedHosts: readonly string[],
  allowPrivateNetwork: boolean,
): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (ALWAYS_ALLOWED.includes(host)) return true;
  if (allowPrivateNetwork && isPrivateIPv4(host)) return true;
  return allowedHosts.some((allowed) =>
    allowed.startsWith(".")
      ? host === allowed.slice(1) || host.endsWith(allowed)
      : host === allowed,
  );
}

export function evaluateOrigin(ctx: OriginContext): OriginVerdict {
  if (ctx.protocol !== "https:" && ctx.protocol !== "http:") return "bad-protocol";
  if (!isHostAllowed(ctx.hostname, ctx.allowedHosts, ctx.allowPrivateNetwork)) {
    return "foreign-host";
  }
  if (ctx.isFramed) return "framed";
  return "ok";
}

function isFramed(win: Window): boolean {
  try {
    return win.self !== win.top;
  } catch {
    // Acceder a window.top desde un iframe cross-origin puede lanzar: eso
    // ya demuestra que estamos embebidos.
    return true;
  }
}

function renderBlocked(doc: Document, message: string): void {
  doc.title = "Acceso no permitido";
  const box = doc.createElement("main");
  box.className =
    "min-h-screen flex flex-col items-center justify-center gap-2 p-6 text-center";
  const h1 = doc.createElement("h1");
  h1.className = "text-xl font-semibold";
  h1.textContent = "Acceso no permitido";
  const p = doc.createElement("p");
  p.className = "text-sm opacity-80 max-w-md";
  p.textContent = message;
  box.append(h1, p);
  doc.body.replaceChildren(box);
}

/**
 * Aplica la política sobre la ventana actual. Devuelve `true` solo si la
 * app puede montarse; en cualquier otro caso ya actuó (sacó la app del
 * iframe o bloqueó la página) y el llamador NO debe renderizar.
 */
export function enforceOriginPolicy(
  win: Window = window,
  options: { allowedHosts?: readonly string[]; allowPrivateNetwork?: boolean } = {},
): boolean {
  const verdict = evaluateOrigin({
    hostname: win.location.hostname,
    protocol: win.location.protocol,
    isFramed: isFramed(win),
    allowedHosts: options.allowedHosts ?? parseAllowedHosts(import.meta.env.VITE_ALLOWED_HOSTS),
    allowPrivateNetwork: options.allowPrivateNetwork ?? import.meta.env.DEV,
  });

  switch (verdict) {
    case "ok":
      return true;
    case "framed":
      // "Sacarlo automáticamente": la app pasa a ser la ventana principal.
      try {
        win.top!.location.replace(win.location.href);
      } catch {
        // iframe con sandbox sin allow-top-navigation: no se puede salir.
      }
      renderBlocked(
        win.document,
        "Esta aplicación no puede abrirse dentro de otra página. Ábrela directamente desde su dirección oficial.",
      );
      return false;
    case "foreign-host":
    case "bad-protocol":
      renderBlocked(
        win.document,
        "Esta dirección no está autorizada para abrir la aplicación. Verifica que estás en el sitio oficial de la Clínica Pabón.",
      );
      return false;
  }
}
