import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const mocks = vi.hoisted(() => ({
  auth: {
    usuario: {
      id: 1,
      username: "qa",
      first_name: "QA",
      last_name: "Test",
      email: "qa@example.test",
      role: "superadmin",
      area: "",
      branch: null,
    },
    isAuthenticated: true,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  },
  dashboard: {} as Record<string, unknown>,
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/context/AuthContext")>();
  return {
    ...actual,
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuth: () => mocks.auth,
  };
});

vi.mock("@/context/NotificationContext", () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: mocks.api };
});

const emptyDashboard = {
  kpis: {
    equipment: {
      active: 0,
      in_maintenance: 0,
      in_repair: 0,
      inactive: 0,
      total: 0,
    },
    failures: { critical_open: 0, total_open: 0 },
    scheduling: { next_7_days: 0, overdue: 0 },
    maintenance: { this_month_count: 0, this_month_cost: "0" },
  },
  distributions: { equipment_by_status: [], failures_by_severity: [] },
  time_series: { maintenance_by_month: [] },
  lists: { overdue_schedules: [], worst_mtbf: [] },
  my_tasks: { schedules: [], failures: [] },
};

const adminRoutes = [
  "/admin",
  "/admin/sedes",
  "/admin/equipos",
  "/admin/equipos/1",
  "/admin/equipos/etiquetas",
  "/admin/agendamientos",
  "/admin/fallas",
  "/admin/perfil",
  "/admin/mantenimientos",
  "/admin/ordenes-trabajo",
  "/admin/usuarios",
];

describe("App routes", () => {
  beforeEach(() => {
    mocks.auth.usuario.role = "superadmin";
    mocks.dashboard = emptyDashboard;
    mocks.auth.login.mockReset();
    mocks.api.get.mockImplementation((url: string) =>
      Promise.resolve({
        data: url.includes("/dashboard/summary/")
          ? mocks.dashboard
          : [],
      }),
    );
    mocks.api.post.mockResolvedValue({ data: {} });
    mocks.api.patch.mockResolvedValue({ data: {} });
    mocks.api.put.mockResolvedValue({ data: {} });
    mocks.api.delete.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    cleanup();
  });

  it.each(adminRoutes)("renders the protected route %s", async (route) => {
    window.history.replaceState({}, "", route);

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText("Cargando página...")).not.toBeInTheDocument();
      expect(screen.getByRole("main")).toBeInTheDocument();
    }, { timeout: 10_000 });

    expect(
      screen.queryByText(/Algo salió mal en esta pantalla/),
    ).not.toBeInTheDocument();
    if (route === "/admin") {
      expect(
        await screen.findByText("Mantenimientos del mes", {}, { timeout: 10_000 }),
      ).toBeInTheDocument();
    }
  }, 15_000);

  it.each(["coordinador", "ingeniero", "tecnico", "usuario"])(
    "renders the dashboard for role %s",
    async (role) => {
      mocks.auth.usuario.role = role;
      mocks.dashboard = {
        ...emptyDashboard,
        area_ops: {
          source: "failures",
          area: "Biomedicina",
          kpis: {
            total: 0,
            open: 0,
            resolved: 0,
            this_week: 0,
            this_week_open: 0,
            this_week_resolved: 0,
          },
          this_week_by_day: [],
          recent: [],
        },
      };
      window.history.replaceState({}, "", "/admin");

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole("main")).toBeInTheDocument();
        expect(
          screen.queryByText(/Algo salió mal en esta pantalla/),
        ).not.toBeInTheDocument();
      }, { timeout: 10_000 });

      if (role === "ingeniero") {
        expect(
          await within(screen.getByRole("main")).findByText(
            "Tareas asignadas",
            {},
            { timeout: 10_000 },
          ),
        ).toBeInTheDocument();
      } else if (role === "tecnico" || role === "usuario") {
        expect(
          await within(screen.getByRole("main")).findByText(
            "Cantidad de fallas reportadas",
            {},
            { timeout: 10_000 },
          ),
        ).toBeInTheDocument();
      } else {
        expect(
          await screen.findByText("Mantenimientos del mes", {}, {
            timeout: 10_000,
          }),
        ).toBeInTheDocument();
      }
    },
    15_000,
  );

  it("redirects unknown routes to the public not-found page", async () => {
    window.history.replaceState({}, "", "/unknown");

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /página no encontrada/i }, { timeout: 10_000 }),
    ).toBeInTheDocument();
  });

  it("shows a clear error when login is rejected", async () => {
    const user = userEvent.setup();
    mocks.auth.login.mockRejectedValue(new Error("invalid credentials"));
    window.history.replaceState({}, "", "/");

    render(<App />);

    await user.type(screen.getByLabelText("Usuario"), "qa");
    await user.type(screen.getByLabelText("Contraseña"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "invalid credentials",
    );
  });

  it("uses a safe requested route after successful login", async () => {
    const user = userEvent.setup();
    mocks.auth.login.mockResolvedValue(mocks.auth.usuario);
    window.history.replaceState({}, "", "/?next=/admin/fallas");

    render(<App />);

    await user.type(screen.getByLabelText("Usuario"), "qa");
    await user.type(screen.getByLabelText("Contraseña"), "test-password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(
      await screen.findByRole("heading", {
        name: "Reportes de falla",
      }),
    ).toBeInTheDocument();
  });

  it("does not navigate to an external URL after login", async () => {
    const user = userEvent.setup();
    mocks.auth.login.mockResolvedValue(mocks.auth.usuario);
    window.history.replaceState({}, "", "/?next=//example.test");

    render(<App />);

    await user.type(screen.getByLabelText("Usuario"), "qa");
    await user.type(screen.getByLabelText("Contraseña"), "test-password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(
      await screen.findByText("Mantenimientos del mes", {}, {
        timeout: 10_000,
      }),
    ).toBeInTheDocument();
  });

  it("renders the password recovery guidance", async () => {
    window.history.replaceState({}, "", "/recuperar-password");

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "¿Olvidaste tu contraseña?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/lo gestiona un administrador/i)).toBeInTheDocument();
  });

  it("keeps public registration disabled and redirects to login", async () => {
    window.history.replaceState({}, "", "/registro");

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Gestión de equipos biomédicos",
      }),
    ).toBeInTheDocument();
  });

  it("renders the registration page when the feature flag is enabled", async () => {
    vi.resetModules();
    vi.doMock("@/lib/featureFlags", () => ({
      PUBLIC_REGISTRATION_ENABLED: true,
    }));

    try {
      const { default: AppWithRegistration } = await import("./App");
      window.history.replaceState({}, "", "/registro");
      render(<AppWithRegistration />);

      expect(
        await screen.findByRole("heading", { name: "Solicitar registro" }),
      ).toBeInTheDocument();
    } finally {
      vi.doUnmock("@/lib/featureFlags");
      vi.resetModules();
    }
  });
});
