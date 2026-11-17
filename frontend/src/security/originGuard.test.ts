import { describe, expect, it, vi } from "vitest";
import {
  enforceOriginPolicy,
  evaluateOrigin,
  isHostAllowed,
  parseAllowedHosts,
} from "./originGuard";

const base = {
  hostname: "biomedicos.clinicapabon.com",
  protocol: "https:",
  isFramed: false,
  allowedHosts: ["biomedicos.clinicapabon.com"],
  allowPrivateNetwork: false,
};

describe("parseAllowedHosts", () => {
  it("separa por comas, recorta y normaliza", () => {
    expect(parseAllowedHosts(" A.com, .b.com ,,")).toEqual(["a.com", ".b.com"]);
    expect(parseAllowedHosts(undefined)).toEqual([]);
  });
});

describe("isHostAllowed", () => {
  it("acepta coincidencia exacta y localhost siempre", () => {
    expect(isHostAllowed("biomedicos.clinicapabon.com", base.allowedHosts, false)).toBe(true);
    expect(isHostAllowed("localhost", [], false)).toBe(true);
    expect(isHostAllowed("127.0.0.1", [], false)).toBe(true);
  });

  it("rechaza dominios ajenos y trucos de sufijo", () => {
    expect(isHostAllowed("evil.com", base.allowedHosts, false)).toBe(false);
    expect(isHostAllowed("biomedicos.clinicapabon.com.evil.com", base.allowedHosts, false)).toBe(false);
    expect(isHostAllowed("xbiomedicos.clinicapabon.com", base.allowedHosts, false)).toBe(false);
  });

  it("'.dominio' permite el dominio y sus subdominios, pero no sufijos falsos", () => {
    const list = [".clinicapabon.com"];
    expect(isHostAllowed("clinicapabon.com", list, false)).toBe(true);
    expect(isHostAllowed("app.clinicapabon.com", list, false)).toBe(true);
    expect(isHostAllowed("fakeclinicapabon.com", list, false)).toBe(false);
  });

  it("IPs privadas solo cuando se habilita la red local (dev)", () => {
    expect(isHostAllowed("192.168.1.20", [], false)).toBe(false);
    expect(isHostAllowed("192.168.1.20", [], true)).toBe(true);
    expect(isHostAllowed("10.0.0.5", [], true)).toBe(true);
    expect(isHostAllowed("172.20.0.1", [], true)).toBe(true);
    expect(isHostAllowed("172.32.0.1", [], true)).toBe(false);
    expect(isHostAllowed("8.8.8.8", [], true)).toBe(false);
  });
});

describe("evaluateOrigin", () => {
  it("ok en el dominio oficial sin iframe", () => {
    expect(evaluateOrigin(base)).toBe("ok");
  });
  it("detecta iframe", () => {
    expect(evaluateOrigin({ ...base, isFramed: true })).toBe("framed");
  });
  it("detecta host ajeno", () => {
    expect(evaluateOrigin({ ...base, hostname: "phishing.com" })).toBe("foreign-host");
  });
  it("rechaza protocolos no web", () => {
    expect(evaluateOrigin({ ...base, protocol: "file:" })).toBe("bad-protocol");
  });
});

function fakeWindow(opts: { hostname: string; framed?: boolean; topThrows?: boolean }) {
  const replace = vi.fn();
  const self = {} as Window;
  const top = opts.framed ? ({ location: { replace } } as unknown as Window) : self;
  Object.assign(self, {
    self,
    document,
    location: { hostname: opts.hostname, protocol: "https:", href: `https://${opts.hostname}/x` },
  });
  Object.defineProperty(self, "top", {
    get: () => {
      if (opts.topThrows) throw new DOMException("blocked", "SecurityError");
      return top;
    },
  });
  return { win: self, replace };
}

describe("enforceOriginPolicy", () => {
  const options = { allowedHosts: ["biomedicos.clinicapabon.com"], allowPrivateNetwork: false };

  it("permite montar en el dominio oficial", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const { win } = fakeWindow({ hostname: "biomedicos.clinicapabon.com" });
    expect(enforceOriginPolicy(win, options)).toBe(true);
    expect(document.getElementById("root")).not.toBeNull();
  });

  it("en un iframe saca la app a la ventana principal y no monta", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const { win, replace } = fakeWindow({ hostname: "biomedicos.clinicapabon.com", framed: true });
    expect(enforceOriginPolicy(win, options)).toBe(false);
    expect(replace).toHaveBeenCalledWith("https://biomedicos.clinicapabon.com/x");
    expect(document.getElementById("root")).toBeNull();
  });

  it("si window.top lanza (iframe cross-origin) lo trata como embebido", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const { win } = fakeWindow({ hostname: "biomedicos.clinicapabon.com", topThrows: true });
    expect(enforceOriginPolicy(win, options)).toBe(false);
    expect(document.body.textContent).toContain("Acceso no permitido");
  });

  it("en un dominio ajeno bloquea y no monta", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const { win } = fakeWindow({ hostname: "copia-falsa.com" });
    expect(enforceOriginPolicy(win, options)).toBe(false);
    expect(document.getElementById("root")).toBeNull();
    expect(document.body.textContent).toContain("no está autorizada");
  });
});
