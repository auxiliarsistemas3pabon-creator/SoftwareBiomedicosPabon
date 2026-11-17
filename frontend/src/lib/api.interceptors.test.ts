import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
const instances = vi.hoisted(() => [] as any[]);

vi.mock("axios", async (orig) => {
  const real: any = await orig();
  return {
    ...real,
    default: {
      ...real.default,
      create: (cfg: any) => {
        const inst = real.default.create(cfg);
        instances.push(inst);
        return inst;
      },
    },
  };
});

import { api, getApiErrorMessage, USER_KEY, userCache } from "./api";

const apiClient = () => instances[0];
const rawClient = () => instances[1];

function ok(config: InternalAxiosRequestConfig, data: unknown = {}) {
  return Promise.resolve({ data, status: 200, statusText: "OK", headers: {}, config });
}
function fail(config: InternalAxiosRequestConfig, status: number) {
  const err = new AxiosError("fail", "ERR", config, undefined, {
    status,
    statusText: "x",
    headers: {},
    config,
    data: {},
  } as any);
  return Promise.reject(err);
}

describe("userCache", () => {
  beforeEach(() => localStorage.clear());

  it("set/get/clear", () => {
    expect(userCache.get()).toBeNull();
    userCache.set({ id: 1 });
    expect(localStorage.getItem(USER_KEY)).toBe('{"id":1}');
    expect(userCache.get()).toEqual({ id: 1 });
    userCache.clear();
    expect(userCache.get()).toBeNull();
  });

  it("get devuelve null si el JSON está corrupto", () => {
    localStorage.setItem(USER_KEY, "{no-json");
    expect(userCache.get()).toBeNull();
  });
});

describe("interceptor CSRF", () => {
  afterEach(() => {
    document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });

  it("adjunta X-CSRFToken en métodos mutadores cuando hay cookie", async () => {
    document.cookie = "csrftoken=abc%20123";
    let seen: any;
    apiClient().defaults.adapter = (c: any) => {
      seen = c.headers.get("X-CSRFToken");
      return ok(c);
    };
    await api.post("/x/", {});
    expect(seen).toBe("abc 123");
  });

  it("no lo adjunta en GET ni sin cookie", async () => {
    let seen: any = "sentinel";
    apiClient().defaults.adapter = (c: any) => {
      seen = c.headers.get("X-CSRFToken");
      return ok(c);
    };
    document.cookie = "csrftoken=zzz";
    await api.get("/x/");
    expect(seen).toBeFalsy();
    document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    await api.delete("/x/");
    expect(seen).toBeFalsy();
  });
});

describe("interceptor de respuesta (refresh 401)", () => {
  const assign = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    assign.mockReset();
    localStorage.clear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { pathname: "/admin/equipos", search: "?a=1", assign },
    });
  });
  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("propaga errores que no son 401", async () => {
    apiClient().defaults.adapter = (c: any) => fail(c, 500);
    await expect(api.get("/x/")).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("no intenta refrescar en endpoints /auth/token/", async () => {
    const raw = vi.fn();
    rawClient().defaults.adapter = raw;
    apiClient().defaults.adapter = (c: any) => fail(c, 401);
    await expect(api.post("/auth/token/cookie/", {})).rejects.toBeTruthy();
    expect(raw).not.toHaveBeenCalled();
  });

  it("refresca la sesión y reintenta la petición original", async () => {
    let calls = 0;
    apiClient().defaults.adapter = (c: any) => {
      calls += 1;
      return calls === 1 ? fail(c, 401) : ok(c, { done: true });
    };
    rawClient().defaults.adapter = (c: any) => ok(c);
    const res = await api.get("/x/");
    expect(res.data).toEqual({ done: true });
    expect(calls).toBe(2);
  });

  it("si el refresh falla en zona privada limpia caché y redirige con next", async () => {
    userCache.set({ id: 1 });
    apiClient().defaults.adapter = (c: any) => fail(c, 401);
    rawClient().defaults.adapter = (c: any) => fail(c, 401);
    await expect(api.get("/x/")).rejects.toBeTruthy();
    expect(userCache.get()).toBeNull();
    expect(assign).toHaveBeenCalledWith(`/?next=${encodeURIComponent("/admin/equipos?a=1")}`);
  });

  it("si el refresh falla en zona pública no redirige", async () => {
    (window.location as any).pathname = "/login";
    apiClient().defaults.adapter = (c: any) => fail(c, 401);
    rawClient().defaults.adapter = (c: any) => fail(c, 401);
    await expect(api.get("/x/")).rejects.toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it("peticiones concurrentes esperan al mismo refresh (éxito)", async () => {
    const attempts = new Map<string, number>();
    apiClient().defaults.adapter = (c: any) => {
      const n = (attempts.get(c.url) ?? 0) + 1;
      attempts.set(c.url, n);
      return n === 1 ? fail(c, 401) : ok(c, { url: c.url });
    };
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const rawSpy = vi.fn((c: any) => gate.then(() => ok(c)));
    rawClient().defaults.adapter = rawSpy;
    const p1 = api.get("/a/");
    const p2 = api.get("/b/");
    await new Promise((r) => setTimeout(r, 20));
    release();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.data).toEqual({ url: "/a/" });
    expect(r2.data).toEqual({ url: "/b/" });
    expect(rawSpy).toHaveBeenCalledTimes(1);
  });

  it("peticiones concurrentes se rechazan si el refresh falla", async () => {
    apiClient().defaults.adapter = (c: any) => fail(c, 401);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    rawClient().defaults.adapter = (c: any) => gate.then(() => fail(c, 401));
    const p1 = api.get("/a/").catch((e) => e);
    const p2 = api.get("/b/").catch((e) => e);
    await new Promise((r) => setTimeout(r, 20));
    release();
    const [e1, e2] = await Promise.all([p1, p2]);
    expect(e1).toBeInstanceOf(AxiosError);
    expect(e2).toBeInstanceOf(AxiosError);
  });
});

describe("getApiErrorMessage (ramas adicionales)", () => {
  const mk = (data: unknown, headers: any = {}) =>
    new AxiosError("msg", "E", undefined, undefined, {
      status: 400,
      statusText: "x",
      headers,
      config: {} as any,
      data,
    } as any);

  it("lee content-type vía headers.get y en mayúsculas", () => {
    const h = { get: (k: string) => (k === "content-type" ? "text/html" : null) };
    expect(getApiErrorMessage(mk("x", h), "fb")).toBe("fb");
    expect(getApiErrorMessage(mk("<p>", { "Content-Type": "text/html" }), "fb")).toBe("fb");
  });
  it("campo string en el primer valor", () => {
    expect(getApiErrorMessage(mk({ campo: "texto" }))).toBe("texto");
  });
  it("cuerpo vacío usa el mensaje del error", () => {
    expect(getApiErrorMessage(mk(""))).toBe("");
  });
  it("error no axios sin mensaje usa fallback", () => {
    expect(getApiErrorMessage(42, "fb")).toBe("fb");
  });
  it("cuerpo HTML vía '<!doctype' con espacios", () => {
    expect(getApiErrorMessage(mk("   \n<!DOCTYPE html>"), "fb")).toBe("fb");
  });
});
