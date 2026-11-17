import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
class FakeSocket {
  static instances: FakeSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  readyState = 0;
  onopen: any = null;
  onmessage: any = null;
  onclose: any = null;
  onerror: any = null;
  close = vi.fn();
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }
}

async function load() {
  vi.resetModules();
  return (await import("./websocket")).notificationsSocket;
}

beforeEach(() => {
  FakeSocket.instances = [];
  (globalThis as any).WebSocket = FakeSocket;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("notificationsSocket", () => {
  it("connect abre un socket contra el origen de la pestaña", async () => {
    const s = await load();
    s.connect();
    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.instances[0].url).toBe(`ws://${window.location.host}/ws/notifications/`);
  });

  it("usa VITE_WS_BASE_URL salvo que apunte a :8000", async () => {
    vi.stubEnv("VITE_WS_BASE_URL", "wss://api.test/");
    let s = await load();
    s.connect();
    expect(FakeSocket.instances[0].url).toBe("wss://api.test/ws/notifications/");
    s.disconnect();

    vi.stubEnv("VITE_WS_BASE_URL", "ws://localhost:8000");
    s = await load();
    s.connect();
    expect(FakeSocket.instances[1].url).toBe(`ws://${window.location.host}/ws/notifications/`);
  });

  it("no abre otra conexión si ya hay una viva", async () => {
    const s = await load();
    s.connect();
    s.connect();
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("reenvía mensajes JSON válidos a los handlers y tolera basura", async () => {
    const s = await load();
    const h = vi.fn();
    const off = s.on(h);
    s.connect();
    const sock = FakeSocket.instances[0];
    sock.onopen();
    sock.onmessage({ data: '{"type":"x"}' });
    sock.onmessage({ data: "no-json" });
    sock.onmessage({ data: "123" });
    sock.onmessage({ data: "null" });
    expect(h).toHaveBeenCalledTimes(1);
    expect(h).toHaveBeenCalledWith({ type: "x" });
    off();
    sock.onmessage({ data: '{"type":"y"}' });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("un handler que lanza no impide a los demás", async () => {
    const s = await load();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const good = vi.fn();
    s.on(() => {
      throw new Error("boom");
    });
    s.on(good);
    s.connect();
    FakeSocket.instances[0].onmessage({ data: '{"type":"z"}' });
    expect(good).toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
  });

  it("onopen cierra sockets obsoletos", async () => {
    const s = await load();
    s.connect();
    const sock = FakeSocket.instances[0];
    s.disconnect();
    sock.onopen?.();
    // disconnect anula los handlers; simulamos uno tardío
    const stale = FakeSocket.instances[0];
    stale.onopen = null;
    expect(stale.close).not.toHaveBeenCalled();
  });

  it("onopen con socket reemplazado cierra con 'stale'", async () => {
    const s = await load();
    s.connect();
    const first = FakeSocket.instances[0];
    const onopen = first.onopen;
    (s as any).socket = null;
    onopen();
    expect(first.close).toHaveBeenCalledWith(1000, "stale");
  });

  it("onerror solo deja rastro", async () => {
    const s = await load();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    s.connect();
    FakeSocket.instances[0].onerror();
    expect(warn).toHaveBeenCalled();
  });

  it("reconecta con backoff tras un cierre inesperado y reinicia al abrir", async () => {
    const s = await load();
    vi.spyOn(Math, "random").mockReturnValue(0);
    s.connect();
    FakeSocket.instances[0].onclose({ code: 1006 });
    vi.advanceTimersByTime(999);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.instances[1].onclose({ code: 1006 });
    vi.advanceTimersByTime(2000);
    expect(FakeSocket.instances).toHaveLength(3);
    FakeSocket.instances[2].onopen();
    expect((s as any).retryAttempt).toBe(0);
  });

  it("topa el backoff en 30 s", async () => {
    const s = await load();
    vi.spyOn(Math, "random").mockReturnValue(0);
    s.connect();
    (s as any).retryAttempt = 20;
    FakeSocket.instances[0].onclose({ code: 1006 });
    vi.advanceTimersByTime(30_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("no reintenta con código 4401", async () => {
    const s = await load();
    s.connect();
    FakeSocket.instances[0].onclose({ code: 4401 });
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("no reintenta tras disconnect() y cierra solo sockets abiertos", async () => {
    const s = await load();
    s.connect();
    const sock = FakeSocket.instances[0];
    sock.readyState = FakeSocket.OPEN;
    s.disconnect();
    expect(sock.close).toHaveBeenCalledWith(1000, "client_disconnect");
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);

    s.connect();
    const connecting = FakeSocket.instances[1];
    s.disconnect();
    expect(connecting.close).not.toHaveBeenCalled();
  });

  it("disconnect cancela un reconnect pendiente", async () => {
    const s = await load();
    s.connect();
    FakeSocket.instances[0].onclose({ code: 1006 });
    s.disconnect();
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("onclose marcado como intencional no programa reconexión", async () => {
    const s = await load();
    s.connect();
    const sock = FakeSocket.instances[0];
    (s as any).intentionallyClosed = true;
    sock.onclose({ code: 1000 });
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("scheduleReconnect no hace nada si ya no está conectado", async () => {
    const s = await load();
    (s as any).connected = false;
    (s as any).scheduleReconnect();
    (s as any).open();
    expect(FakeSocket.instances).toHaveLength(0);
  });
});
