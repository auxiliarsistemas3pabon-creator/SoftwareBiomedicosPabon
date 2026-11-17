import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
const { auth, socket } = vi.hoisted(() => {
  const handlers: Array<(e: any) => void> = [];
  return {
    auth: { login: vi.fn(), me: vi.fn(), logout: vi.fn() },
    socket: {
      handlers,
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn((h: (e: any) => void) => {
        handlers.push(h);
        return () => {
          handlers.splice(handlers.indexOf(h), 1);
        };
      }),
    },
  };
});

vi.mock("@/services/auth.service", () => ({ authService: auth }));
vi.mock("@/lib/websocket", () => ({ notificationsSocket: socket }));

import { AuthProvider, useAuth } from "./AuthContext";
import { NotificationProvider, useNotifications } from "./NotificationContext";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { USER_KEY } from "@/lib/api";
import { makeUser } from "@/test/helpers";

beforeEach(() => {
  localStorage.clear();
  auth.login.mockReset();
  auth.me.mockReset();
  auth.logout.mockReset();
  socket.connect.mockClear();
  socket.disconnect.mockClear();
  socket.handlers.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AuthContext", () => {
  const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

  it("useAuth fuera del provider lanza", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
    spy.mockRestore();
  });

  it("hidrata la sesión desde /users/me/ y la cachea", async () => {
    const u = makeUser({ role: "admin" });
    auth.me.mockResolvedValue(u);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.usuario).toEqual(u);
    expect(result.current.isAuthenticated).toBe(true);
    expect(JSON.parse(localStorage.getItem(USER_KEY)!)).toEqual(u);
  });

  it("sin sesión limpia la caché y deja usuario nulo", async () => {
    localStorage.setItem(USER_KEY, JSON.stringify(makeUser()));
    auth.me.mockRejectedValue(new Error("401"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(false); // hay caché => no bloquea
    expect(result.current.usuario).not.toBeNull();
    await waitFor(() => expect(result.current.usuario).toBeNull());
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("login, refreshUser y logout", async () => {
    auth.me.mockRejectedValue(new Error("401"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const u = makeUser({ role: "coordinador" });
    auth.login.mockResolvedValue(undefined);
    auth.me.mockResolvedValue(u);
    let returned: any;
    await act(async () => {
      returned = await result.current.login({ username: "a", password: "b" } as any);
    });
    expect(returned).toEqual(u);
    expect(result.current.usuario).toEqual(u);

    const u2 = { ...u, first_name: "Nuevo" };
    auth.me.mockResolvedValue(u2);
    await act(async () => {
      await result.current.refreshUser();
    });
    expect(result.current.usuario).toEqual(u2);

    auth.logout.mockResolvedValue(undefined);
    act(() => result.current.logout());
    expect(auth.logout).toHaveBeenCalled();
    expect(result.current.usuario).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it("ignora la respuesta si se desmonta antes de resolver (éxito y error)", async () => {
    let resolveMe!: (u: any) => void;
    auth.me.mockReturnValue(new Promise((r) => (resolveMe = r)));
    const { unmount } = renderHook(() => useAuth(), { wrapper });
    unmount();
    await act(async () => resolveMe(makeUser()));
    expect(localStorage.getItem(USER_KEY)).toBeNull();

    let rejectMe!: (e: any) => void;
    auth.me.mockReturnValue(new Promise((_, r) => (rejectMe = r)));
    const second = renderHook(() => useAuth(), { wrapper });
    second.unmount();
    await act(async () => rejectMe(new Error("x")));
  });
});

describe("ThemeContext", () => {
  const wrapper = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

  it("useTheme fuera del provider lanza", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow(/ThemeProvider/);
    spy.mockRestore();
  });

  it("usa el tema guardado y lo alterna persistiendo", () => {
    localStorage.setItem("theme", "dark");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("sin valor guardado respeta prefers-color-scheme", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any;
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("dark");
  });

  it("cae a light si matchMedia lanza o no hay preferencia", () => {
    window.matchMedia = vi.fn(() => {
      throw new Error("no");
    }) as any;
    expect(renderHook(() => useTheme(), { wrapper }).result.current.theme).toBe("light");
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
    expect(renderHook(() => useTheme(), { wrapper }).result.current.theme).toBe("light");
  });

  it("tolera localStorage que lanza (lectura y escritura)", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("light");
    get.mockRestore();
    set.mockRestore();
  });
});

describe("NotificationContext", () => {
  function Probe() {
    const { notify, dismiss } = useNotifications();
    return (
      <>
        <button onClick={() => notify({ title: "Manual", duration: 100000 })}>add</button>
        <button onClick={() => dismiss("zz")}>dis</button>
      </>
    );
  }

  function renderWith(user: any, loading = false) {
    // Mockeamos el estado de auth escribiendo la caché y resolviendo me().
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      auth.me.mockResolvedValue(user);
    } else {
      auth.me.mockRejectedValue(new Error("401"));
    }
    void loading;
    return render(
      <AuthProvider>
        <NotificationProvider>
          <Probe />
        </NotificationProvider>
      </AuthProvider>,
    );
  }

  it("useNotifications fuera del provider lanza", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useNotifications())).toThrow(/NotificationProvider/);
    spy.mockRestore();
  });

  it("conecta el socket con sesión y publica toasts por tipo de evento", async () => {
    renderWith(makeUser());
    await waitFor(() => expect(socket.connect).toHaveBeenCalled());
    expect(socket.handlers).toHaveLength(1);

    act(() =>
      socket.handlers[0]({
        type: "schedule_email_sent",
        equipment_asset_tag: "EQ-1",
        scheduled_date: "2026-05-01",
        branch_name: "Sede A",
        sent_at: "2026-05-01T10:00:00Z",
      }),
    );
    expect(screen.getByText("Correo de solicitud enviado")).toBeInTheDocument();
    expect(screen.getByText("EQ-1 · 2026-05-01")).toBeInTheDocument();

    act(() =>
      socket.handlers[0]({
        type: "schedule_email_sent",
        equipment_asset_tag: "EQ-2",
        scheduled_date: null,
        branch_name: "Sede B",
        sent_at: "no-fecha",
      }),
    );
    expect(screen.getByText("EQ-2 · sin programar")).toBeInTheDocument();

    for (const [days, text] of [
      [0, "Vence hoy"],
      [1, "1 día de retraso"],
      [3, "3 días de retraso"],
    ] as const) {
      act(() =>
        socket.handlers[0]({
          type: "overdue_maintenance",
          equipment_asset_tag: "EQ-9",
          scheduled_date: "2026-04-01",
          days_overdue: days,
        }),
      );
      expect(screen.getByText(text)).toBeInTheDocument();
    }

    act(() => socket.handlers[0]({ type: "otro", x: 1 }));
    expect(screen.getByText("Notificación")).toBeInTheDocument();
  });

  it("limita la cola a 5 toasts y permite descartar", async () => {
    renderWith(makeUser());
    await waitFor(() => expect(socket.connect).toHaveBeenCalled());
    const add = screen.getByText("add");
    for (let i = 0; i < 7; i += 1) act(() => add.click());
    expect(screen.getAllByText("Manual")).toHaveLength(5);
    act(() => screen.getByText("dis").click());
    act(() => screen.getAllByLabelText("Cerrar notificación")[0].click());
    expect(screen.getAllByText("Manual")).toHaveLength(4);
  });

  it("sin sesión desconecta el socket y al desmontar también", async () => {
    const { unmount } = renderWith(null);
    await waitFor(() => expect(socket.disconnect).toHaveBeenCalled());
    expect(socket.connect).not.toHaveBeenCalled();
    socket.disconnect.mockClear();
    unmount();
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it("genId cae a Date.now si no existe crypto.randomUUID", async () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    renderWith(makeUser());
    await waitFor(() => expect(socket.connect).toHaveBeenCalled());
    act(() => screen.getByText("add").click());
    expect(screen.getByText("Manual")).toBeInTheDocument();
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: original, configurable: true });
  });
});
