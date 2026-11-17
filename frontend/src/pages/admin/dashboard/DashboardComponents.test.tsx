import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { dashboardService } from "@/services/dashboard.service";
import type { DashboardSummary } from "@/types/dashboard/dashboard";
import { AdminOverview } from "./AdminOverview";
import { AreaOpsDashboard } from "./AreaOpsDashboard";
import { DashboardPage } from "./DashboardPage";
import {
  MyTasksSection,
  OperativoWeekSection,
  OverdueSchedulesList,
  WorstMtbfList,
} from "./DashboardSections";
import { EngineerTasksDashboard } from "./EngineerTasksDashboard";
import {
  FailuresSeverityChart,
  KpiRow,
  MaintenanceTimeSeriesChart,
} from "./OverviewWidgets";

vi.mock("recharts", () => {
  const container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const element = () => null;
  return {
    Bar: element,
    BarChart: container,
    CartesianGrid: element,
    Cell: element,
    ComposedChart: container,
    Legend: element,
    Line: element,
    Pie: container,
    PieChart: container,
    ResponsiveContainer: container,
    Scatter: element,
    ScatterChart: container,
    Tooltip: element,
    XAxis: element,
    YAxis: element,
  };
});

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/dashboard.service", () => ({
  dashboardService: { summary: vi.fn() },
}));

const dashboard: DashboardSummary = {
  kpis: {
    equipment: {
      active: 8,
      in_maintenance: 2,
      in_repair: 1,
      inactive: 1,
      total: 12,
    },
    failures: { critical_open: 1, total_open: 2 },
    scheduling: { next_7_days: 3, overdue: 1 },
    maintenance: { this_month_count: 4, this_month_cost: "250000" },
  },
  distributions: {
    equipment_by_status: [
      { status: "ACTIVE", count: 8 },
      { status: "IN_MAINTENANCE", count: 2 },
      { status: "IN_REPAIR", count: 1 },
      { status: "INACTIVE", count: 1 },
    ],
    failures_by_severity: [
      { severity: "HIGH", open: 2, resolved: 1 },
      { severity: "LOW", open: 0, resolved: 2 },
    ],
  },
  time_series: {
    maintenance_by_month: [
      {
        month: "2026-01",
        PREVENTIVE: 2,
        CORRECTIVE: 1,
        REPAIR: 0,
        CALIBRATION: 1,
        INSPECTION: 0,
        cost: "250000",
      },
    ],
    schedules: [
      { date: "2026-01-03", kind: "PREVENTIVE", resolved: false },
      { date: "2026-01-05", kind: "REPAIR", resolved: true },
    ],
    maintenance_costs: [
      { date: "2026-01-03", cost: "250000" },
      { date: "2026-02-05", cost: "invalid" },
    ],
  },
  lists: {
    overdue_schedules: [
      {
        id: 1,
        equipment_id: 1,
        equipment_name: "Monitor",
        equipment_asset_tag: "EQ-1",
        scheduled_date: "2026-01-03",
        days_overdue: 2,
        kind: "PREVENTIVE",
      },
    ],
    worst_mtbf: [
      {
        id: 1,
        name: "Monitor",
        asset_tag: "EQ-1",
        branch_name: "Central",
        mtbf_hours: "12",
        failures_count: 3,
      },
    ],
  },
  my_tasks: {
    schedules: [
      {
        id: 1,
        equipment_id: 1,
        equipment_name: "Monitor",
        equipment_asset_tag: "EQ-1",
        scheduled_date: "2026-01-03",
        kind: "PREVENTIVE",
      },
      {
        id: 2,
        equipment_id: 2,
        equipment_name: "Bomba",
        equipment_asset_tag: "EQ-2",
        scheduled_date: "2026-01-05",
        kind: "REPAIR",
      },
    ],
    failures: [],
  },
};

const areaOps = {
  source: "failures" as const,
  area: "",
  kpis: {
    total: 2,
    open: 1,
    resolved: 1,
    this_week: 1,
    this_week_open: 1,
    this_week_resolved: 0,
  },
  by_status: [
    { status: "open" as const, count: 1 },
    { status: "resolved" as const, count: 1 },
  ],
  this_week_by_day: [{ date: "2026-01-03", count: 1 }],
  recent: [
    {
      id: 1,
      equipment_name: "Monitor",
      equipment_asset_tag: "EQ-1",
      area: "UCI",
      severity: "HIGH" as const,
      resolved: false,
      reported_at: "2026-01-03",
      resolution_notes: "Revisar sensor",
      opportunity_hours: 2,
    },
  ],
};

describe("dashboard components", () => {
  it("renders KPI cards, status distribution, and severity chart data", () => {
    render(
      <>
        <KpiRow
          data={dashboard}
          canViewEquipment
          canViewFailures
          canViewScheduling
          canViewMaintenance
        />
        <FailuresSeverityChart
          data={dashboard.distributions.failures_by_severity}
        />
        <MaintenanceTimeSeriesChart
          data={dashboard.time_series.maintenance_by_month}
        />
      </>,
    );

    expect(screen.getByText("Equipos operativos")).toBeInTheDocument();
    expect(screen.getByText("Fallas críticas abiertas")).toBeInTheDocument();
    expect(screen.getByText("Fallas por severidad")).toBeInTheDocument();
    expect(
      screen.getByText("Mantenimientos últimos 6 meses"),
    ).toBeInTheDocument();
  });

  it("renders empty severity data without a chart", () => {
    render(<FailuresSeverityChart data={[]} />);
    expect(screen.getByText("Sin fallas reportadas.")).toBeInTheDocument();
  });

  it("shows assigned tasks and the empty state when no tasks exist", () => {
    const { rerender } = render(
      <MemoryRouter>
        <MyTasksSection schedules={dashboard.my_tasks.schedules} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Monitor")).toBeInTheDocument();
    expect(screen.getByText("Reparación")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <MyTasksSection schedules={[]} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Mis tareas próximas")).not.toBeInTheDocument();
  });

  it("renders weekly maintenance summaries with and without area data", () => {
    const week = {
      week_start: "2026-01-01",
      week_end: "2026-01-07",
      by_area: [{ area: "UCI", count: 2 }],
      records: [
        {
          id: 1,
          date: "2026-01-03",
          kind: "PREVENTIVE" as const,
          equipment_name: "Monitor",
          equipment_asset_tag: "EQ-1",
          area: "UCI",
        },
        {
          id: 2,
          date: "2026-01-04",
          kind: "INSPECTION" as const,
          equipment_name: "Bomba",
          equipment_asset_tag: "EQ-2",
          area: "UCI",
        },
        {
          id: 3,
          date: "2026-01-05",
          kind: "OTHER" as never,
          equipment_name: "Ventilador",
          equipment_asset_tag: "EQ-3",
          area: "UCI",
        },
      ],
    };
    const { rerender } = render(<OperativoWeekSection week={week} />);
    expect(screen.getByText("UCI: 2")).toBeInTheDocument();
    expect(screen.getByText("Preventivo")).toBeInTheDocument();
    expect(screen.getByText("Inspección")).toBeInTheDocument();

    rerender(
      <OperativoWeekSection
        week={{ ...week, by_area: [], records: [] }}
      />,
    );
    expect(
      screen.getByText("Esta semana no hay mantenimientos asignados a ti."),
    ).toBeInTheDocument();
  });

  it("renders overdue schedules and their empty state", () => {
    const { rerender } = render(
      <MemoryRouter>
        <OverdueSchedulesList items={dashboard.lists.overdue_schedules} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Monitor")).toBeInTheDocument();
    expect(screen.getByText("2 d")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <OverdueSchedulesList items={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText("No hay solicitudes vencidas.")).toBeInTheDocument();
  });

  it("renders MTBF records and the empty state", () => {
    const { rerender } = render(
      <WorstMtbfList items={dashboard.lists.worst_mtbf} />,
    );
    expect(
      screen.getByText("Equipos con peor confiabilidad"),
    ).toBeInTheDocument();

    rerender(<WorstMtbfList items={[]} />);
    expect(screen.getByText("Aún no hay suficientes datos.")).toBeInTheDocument();
  });

  it("shows the area-operations view and its missing-area warning", () => {
    render(
      <MemoryRouter>
        <AreaOpsDashboard ops={areaOps} />
      </MemoryRouter>,
    );
    expect(
      screen.getByText("Cantidad de fallas reportadas"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Un administrador debe asignarte un área/),
    ).toBeInTheDocument();
    expect(screen.getByText("Monitor")).toBeInTheDocument();
  });

  it("filters and renders operational requests", async () => {
    const user = userEvent.setup();
    const ops = {
      ...areaOps,
      source: "schedules" as const,
      series: [
        { date: "2026-01-03", resolved: false },
        { date: "2026-01-05", resolved: true },
      ],
      recent: [
        {
          ...areaOps.recent[0],
          reported_at: "2026-01-03",
          resolution_notes: "Pendiente",
        },
      ],
    };
    render(
      <MemoryRouter>
        <AreaOpsDashboard ops={ops} />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Solicitudes")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-01-04" },
    });
    fireEvent.change(screen.getByLabelText("Hasta"), {
      target: { value: "2026-01-06" },
    });
    await user.selectOptions(screen.getByLabelText("Fechas"), "year");

    expect(
      screen.getByText("No hay solicitudes en el rango de fechas."),
    ).toBeInTheDocument();
  });

  it("renders engineer KPIs, task details, and date filtering", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <EngineerTasksDashboard
          tasks={{
            kpis: { assigned: 3, pending: 1, in_progress: 1, resolved: 1 },
            series: [
              {
                status: "PENDING",
                start_date: "2026-01-03",
                end_date: null,
              },
              {
                status: "IN_PROGRESS",
                start_date: "2026-01-04",
                end_date: null,
              },
              {
                status: "FINISHED",
                start_date: "2026-01-01",
                end_date: "2026-01-05",
              },
            ],
            recent: [
              {
                id: 1,
                number: "OT-1",
                equipment_name: "Monitor",
                equipment_asset_tag: "EQ-1",
                service_type: "PREVENTIVE",
                status: "IN_PROGRESS",
                start_date: "2026-01-03",
                description: "Inspección",
              },
            ],
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Tareas por fecha")).toBeInTheDocument();
    expect(screen.getByText("Monitor")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-01-05" },
    });
    fireEvent.change(screen.getByLabelText("Hasta"), {
      target: { value: "2026-01-03" },
    });
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(
      screen.getByText(/desde 2026-01-03 hasta 2026-01-05/),
    ).toBeInTheDocument();
  });

  it("renders and applies coordinator date filters", async () => {
    const user = userEvent.setup();
    render(
      <AdminOverview
        data={dashboard}
        role="coordinador"
        canViewEquipment
        canViewFailures
        canViewScheduling
        canViewMaintenance
      />,
    );

    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(screen.getByLabelText("Hasta"), {
      target: { value: "2026-01-01" },
    });
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(screen.getByText("Aplicar filtros")).toBeInTheDocument();
    expect(screen.getByText("Fallas por severidad")).toBeInTheDocument();
  });

  it("loads dashboard data and reports service errors", async () => {
    vi.mocked(useAuth).mockReturnValue({
      usuario: {
        id: 1,
        username: "admin",
        email: "admin@example.com",
        first_name: "Ana",
        last_name: "Admin",
        role: "admin",
        is_active: true,
      },
      isAuthenticated: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    vi.mocked(dashboardService.summary).mockResolvedValueOnce(dashboard);

    const { unmount } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Hola, Ana Admin 👋")).toBeInTheDocument();
    expect(
      screen.getByText(/Resumen general del estado de los equipos biomédicos/),
    ).toBeInTheDocument();

    vi.mocked(dashboardService.summary).mockRejectedValueOnce(
      new Error("Fallo de prueba"),
    );
    unmount();
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("shows an empty user dashboard and a technician weekly report", async () => {
    vi.mocked(useAuth).mockReturnValue({
      usuario: {
        id: 2,
        username: "user",
        email: "user@example.com",
        first_name: "User",
        last_name: "Example",
        role: "usuario",
        is_active: true,
      },
      isAuthenticated: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    vi.mocked(dashboardService.summary).mockResolvedValueOnce(dashboard);
    const { unmount } = render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText(/solicitudes para monitorear/)).toBeInTheDocument();

    vi.mocked(useAuth).mockReturnValue({
      usuario: {
        id: 3,
        username: "tech",
        email: "tech@example.com",
        first_name: "Tania",
        last_name: "Tecnica",
        role: "tecnico",
        is_active: true,
      },
      isAuthenticated: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    vi.mocked(dashboardService.summary).mockResolvedValueOnce({
      ...dashboard,
      my_week: {
        week_start: "2026-01-01",
        week_end: "2026-01-07",
        by_area: [],
        records: [],
      },
    });
    unmount();
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText("Tus reportes de la semana")).toBeInTheDocument();
  });
});
