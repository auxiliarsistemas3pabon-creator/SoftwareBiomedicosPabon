import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationProvider, useNotifications } from "./NotificationContext";
import type { Usuario } from "@/types/authentication/auth";

const authState = vi.hoisted(() => ({
  usuario: null as unknown,
  loading: true,
}));
const socket = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
}));

vi.mock("./AuthContext", () => ({
  useAuth: () => authState,
}));
vi.mock("@/lib/websocket", () => ({
  notificationsSocket: socket,
}));

function Consumer() {
  const { notify, dismiss } = useNotifications();
  return (
    <div>
      <button onClick={() => notify({ title: "Manual", body: "Texto manual" })}>
        Crear aviso
      </button>
      <button onClick={() => dismiss("manual-id")}>Cerrar manual</button>
    </div>
  );
}

function user(): Usuario {
  return {
    id: 1,
    username: "ana",
    email: "ana@example.com",
    first_name: "Ana",
    last_name: "Pérez",
    role: "tecnico",
    is_active: true,
  };
}

function renderNotifications() {
  return render(
    <NotificationProvider>
      <Consumer />
    </NotificationProvider>,
  );
}

describe("NotificationProvider", () => {
  let eventHandler: ((event: never) => void) | undefined;
  const unsubscribe = vi.fn();

  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    authState.usuario = null;
    authState.loading = true;
    eventHandler = undefined;
    socket.on.mockImplementation((handler) => {
      eventHandler = handler;
      return unsubscribe;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("disconnects while authentication is loading and connects after a session is ready", () => {
    const { rerender, unmount } = renderNotifications();
    expect(socket.disconnect).toHaveBeenCalled();
    expect(socket.connect).not.toHaveBeenCalled();

    authState.usuario = user();
    authState.loading = false;
    rerender(
      <NotificationProvider>
        <Consumer />
      </NotificationProvider>,
    );
    expect(socket.connect).toHaveBeenCalledOnce();
    expect(socket.on).toHaveBeenCalledOnce();
    expect(eventHandler).toBeTypeOf("function");

    authState.usuario = null;
    rerender(
      <NotificationProvider>
        <Consumer />
      </NotificationProvider>,
    );
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(socket.disconnect).toHaveBeenCalledTimes(2);
    unmount();
    expect(socket.disconnect).toHaveBeenCalledTimes(3);
  });

  it("keeps the socket closed while an existing user is still loading", () => {
    authState.usuario = user();
    authState.loading = true;
    renderNotifications();

    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(socket.connect).not.toHaveBeenCalled();
    expect(socket.on).not.toHaveBeenCalled();
  });

  it("converts socket events into user-facing notification messages", async () => {
    authState.usuario = user();
    authState.loading = false;
    renderNotifications();

    const scheduleEvent = {
      type: "schedule_email_sent",
      schedule_id: 3,
      equipment_asset_tag: "EQ-3",
      scheduled_date: "2026-06-02",
      branch_name: "Central",
      subject: "Mantenimiento",
      sent_at: "2026-06-01T10:00:00Z",
    };
    act(() => eventHandler?.(scheduleEvent as never));
    expect(await screen.findByText("Correo de solicitud enviado")).toBeInTheDocument();
    expect(screen.getByText("EQ-3 · 2026-06-02")).toBeInTheDocument();
    expect(screen.getByText(/Central/)).toBeInTheDocument();

    const localTime = vi
      .spyOn(Date.prototype, "toLocaleTimeString")
      .mockImplementation(() => {
        throw new Error("locale unavailable");
      });
    const invalidTimeEvent = {
      ...scheduleEvent,
      sent_at: "invalid-time",
    };
    act(() => eventHandler?.(invalidTimeEvent as never));
    expect(screen.getByText("Central · invalid-time")).toBeInTheDocument();
    localTime.mockRestore();
    act(() => eventHandler?.({ ...scheduleEvent, scheduled_date: "" } as never));
    expect(screen.getByText(/EQ-3.*sin programar/)).toBeInTheDocument();

    const overdue = (days_overdue: number) => ({
      type: "overdue_maintenance",
      schedule_id: 4,
      equipment_asset_tag: "EQ-4",
      equipment_name: "Bomba",
      scheduled_date: "2026-05-30",
      days_overdue,
      kind: "PREVENTIVE",
    });
    act(() => eventHandler?.(overdue(0) as never));
    act(() => eventHandler?.(overdue(1) as never));
    act(() => eventHandler?.(overdue(4) as never));

    expect(screen.getByText("Vence hoy")).toBeInTheDocument();
    expect(screen.getByText("1 día de retraso")).toBeInTheDocument();
    expect(screen.getByText("4 días de retraso")).toBeInTheDocument();
    expect(screen.getAllByText("Mantenimiento vencido")).toHaveLength(3);
  });

  it("supports manual notifications, dismissing, fallback event types, and a five-toast limit", async () => {
    authState.usuario = user();
    authState.loading = false;
    let id = 0;
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        id += 1;
        return id === 1 ? "manual-id" : `toast-${id}`;
      },
    });
    renderNotifications();

    fireEvent.click(screen.getByRole("button", { name: "Crear aviso" }));
    expect(await screen.findByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("Texto manual")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar manual" }));
    await waitFor(() => expect(screen.queryByText("Manual")).not.toBeInTheDocument());

    act(() => eventHandler?.({ type: "future_event", content: 3 } as never));
    expect(screen.getByText("Notificación")).toBeInTheDocument();

    for (let index = 0; index < 6; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Crear aviso" }));
    }
    await waitFor(() => expect(screen.getAllByRole("status")).toHaveLength(5));
    expect(screen.queryByText("Notificación")).not.toBeInTheDocument();
  });

  it("generates a fallback toast id when randomUUID is unavailable", () => {
    authState.usuario = user();
    authState.loading = false;
    vi.stubGlobal("crypto", {});
    renderNotifications();

    fireEvent.click(screen.getByRole("button", { name: "Crear aviso" }));
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  it("throws when notifications are used outside their provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Consumer />)).toThrow(
      "useNotifications debe usarse dentro de NotificationProvider",
    );
  });
});
