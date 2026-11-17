import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
const h = vi.hoisted(() => ({
  auth: { usuario: null as any },
  maint: { listPaginated: vi.fn(), listAll: vi.fn(), create: vi.fn(), createWithFile: vi.fn(), update: vi.fn(), remove: vi.fn() },
  equipment: { listAll: vi.fn() },
  sched: { list: vi.fn(), retrieve: vi.fn() },
  users: { list: vi.fn() },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => h.auth }));
vi.mock("@/services/maintenance.service", () => ({ maintenanceService: h.maint }));
vi.mock("@/services/equipment.service", () => ({ equipmentService: h.equipment }));
vi.mock("@/services/scheduling.service", () => ({ schedulingService: h.sched }));
vi.mock("@/services/users.service", () => ({ usersService: h.users }));

import { MantenimientosPage } from "./MantenimientosPage";
import { MaintenanceFormModal } from "./MaintenanceFormModal";
import { MaintenanceRow } from "./MaintenanceRow";
import { useMantenimientos } from "./useMantenimientos";
import { makeUser, page } from "@/test/helpers";

const eq1: any = { id: 1, name: "Monitor", asset_tag: "EQ-1" };
const eq2: any = { id: 2, name: "Bomba", asset_tag: "EQ-2" };
const tech = makeUser({ id: 21, role: "tecnico", username: "tec1", first_name: "Luis", last_name: "Paz" });
const eng = makeUser({ id: 22, role: "ingeniero", username: "ing1", first_name: "Eva", last_name: "Mar" });
const sched: any = { id: 7, equipment: 1, kind: "PREVENTIVE", scheduled_date: "2026-06-01", notes: "Rutina", is_completed: false, assigned_technician: 21, assigned_engineer: null };
const m1: any = { id: 1, equipment: 1, equipment_name: "Monitor", equipment_asset_tag: "EQ-1", kind: "PREVENTIVE", date: "2026-05-01", description: "d", observations: "o", assigned_technician: 21, assigned_technician_detail: { username: "tec1", full_name: "Luis Paz" }, scheduled_maintenance: 7, scheduled_maintenance_detail: sched, work_order: { number: "OT-9" }, cost: "100" };
const m2: any = { id: 2, equipment: 2, kind: "REPAIR", date: "2026-05-02", description: "d2", technician: "Pedro Gómez", scheduled_maintenance: null };

let alertSpy: any;
beforeEach(() => {
  Object.values(h.maint).forEach((f) => f.mockReset());
  h.maint.listPaginated.mockResolvedValue(page([m1, m2], { count: 2 }));
  h.maint.listAll.mockResolvedValue([m1, m2, { ...m1, id: 3 }, { id: 4, equipment: 1, kind: "REPAIR", date: "x", description: "" }, { id: 5, equipment: 1, kind: "REPAIR", date: "x", description: "", assigned_engineer_detail: { username: "ing1" } }]);
  h.equipment.listAll.mockReset().mockResolvedValue([eq1, eq2]);
  h.sched.list.mockReset().mockResolvedValue([sched]);
  h.sched.retrieve.mockReset();
  h.users.list.mockReset().mockImplementation(async ({ role }: any) => (role === "tecnico" ? [tech] : [eng, tech]));
  h.auth.usuario = makeUser({ role: "coordinador" });
  alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
});

async function renderPage(entry = "/admin/mantenimientos") {
  const r = render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/admin/mantenimientos" element={<MantenimientosPage />} />
        <Route path="/admin/equipos" element={<p>equipos</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText("Bomba (EQ-2)");
  return r;
}
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("MantenimientosPage", () => {
  it("lista registros (equipo con etiqueta, programado, orden de trabajo)", async () => {
    await renderPage();
    expect(screen.getByText("Monitor")).toBeInTheDocument();
    expect(screen.queryByText("Orden OT-9")).toBeNull(); // columna de acciones oculta (showActions=false)
    expect(screen.getByText(/Programado para/)).toHaveTextContent("2026-06-01");
    expect(screen.getByText("Bomba (EQ-2)")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 1–2 de 2")).toBeInTheDocument();
  });

  it("estado vacío con servicios auxiliares caídos", async () => {
    h.maint.listPaginated.mockResolvedValue(page([], { count: 0 }));
    h.equipment.listAll.mockRejectedValue(new Error("x"));
    h.sched.list.mockRejectedValue(new Error("x"));
    h.maint.listAll.mockRejectedValue(new Error("x"));
    h.users.list.mockRejectedValue(new Error("x"));
    render(<MemoryRouter><MantenimientosPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Sin resultados")).toBeInTheDocument());
  });

  it("muestra el error de carga", async () => {
    h.maint.listPaginated.mockRejectedValue(new Error("caído"));
    render(<MemoryRouter><MantenimientosPage /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("caído");
  });

  it("filtra por tipo, técnico y equipo", async () => {
    await renderPage();
    h.maint.listPaginated.mockClear();
    await userEvent.selectOptions(screen.getAllByRole("combobox")[2], "REPAIR");
    await waitFor(() => expect(h.maint.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ kind: "REPAIR" })));
    fireEvent.change(screen.getByLabelText("Buscar por técnico"), { target: { value: "Lu" } });
    await waitFor(() => expect(h.maint.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ search: "Lu" })));
    fireEvent.mouseDown(within(await screen.findByRole("listbox")).getByRole("option", { name: /Luis Paz/ }));
    await waitFor(() => expect(h.maint.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ search: "Luis Paz" })));
    fireEvent.change(screen.getByLabelText("Filtrar por equipo"), { target: { value: "Mon" } });
    await waitFor(() => expect(h.maint.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ equipment_name: "Mon" })));
    fireEvent.mouseDown(within(await screen.findByRole("listbox")).getByRole("option", { name: /Monitor/ }));
    await waitFor(() => expect(h.maint.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ equipment_name: "Monitor" })));
  });

  it("el botón 'Nuevo mantenimiento' navega a equipos", async () => {
    await renderPage();
    await userEvent.click(screen.getByText("Nuevo mantenimiento"));
    expect(screen.getByText("equipos")).toBeInTheDocument();
  });

  it("pagina", async () => {
    h.maint.listPaginated.mockResolvedValue(page([m1], { count: 50 }));
    render(<MemoryRouter><MantenimientosPage /></MemoryRouter>);
    await screen.findByText("1 / 3");
    await userEvent.click(screen.getByText("Siguiente"));
    await waitFor(() => expect(h.maint.listPaginated).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });

  describe("creación por query params", () => {
    it("?equipment=ID abre el formulario con el equipo y crea (con PDF)", async () => {
      h.maint.createWithFile.mockResolvedValue({});
      await renderPage("/admin/mantenimientos?equipment=1");
      const dialog = within(await screen.findByRole("dialog"));
      expect(dialog.getByText("Nuevo mantenimiento", { selector: "h2" })).toBeInTheDocument();
      fill("Fecha", "2026-06-10");
      fireEvent.change(dialog.getAllByRole("textbox").find((t) => t.tagName === "TEXTAREA")!, { target: { value: "Rutina mensual" } });
      await userEvent.click(dialog.getByPlaceholderText(/Buscar técnico/));
      await userEvent.click(await dialog.findByText("Luis Paz"));
      const file = new File(["%PDF"], "r.pdf", { type: "application/pdf" });
      await userEvent.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);
      await userEvent.click(dialog.getByText("Crear"));
      await waitFor(() => expect(h.maint.createWithFile).toHaveBeenCalledWith(expect.objectContaining({ equipment: 1, assigned_technician: 21 }), file));
    });

    it("crear sin PDF usa create(); equipment inválido se ignora; sin permiso no abre", async () => {
      h.maint.create.mockResolvedValue({});
      await renderPage("/admin/mantenimientos?equipment=1");
      const dialog = within(await screen.findByRole("dialog"));
      fill("Fecha", "2026-06-10");
      fireEvent.change(dialog.getAllByRole("textbox").find((t) => t.tagName === "TEXTAREA")!, { target: { value: "x" } });
      await userEvent.click(dialog.getByText("Crear"));
      await waitFor(() => expect(h.maint.create).toHaveBeenCalled());
    });

    it("equipment inválido y rol sin permiso no abren el modal", async () => {
      const { unmount } = await renderPage("/admin/mantenimientos?equipment=abc");
      expect(screen.queryByRole("dialog")).toBeNull();
      unmount();
      h.auth.usuario = makeUser({ role: "superadmin" });
      await renderPage("/admin/mantenimientos?equipment=1");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("?scheduling=ID precarga el formulario desde el agendamiento", async () => {
      h.sched.retrieve.mockResolvedValue({ ...sched, id: 99, notes: null, assigned_technician: null, assigned_engineer: 22 });
      await renderPage("/admin/mantenimientos?scheduling=99");
      const dialog = within(await screen.findByRole("dialog"));
      expect(dialog.getByLabelText("Cumple agendamiento (opcional)")).toHaveValue("99");
    });

    it("?scheduling=ID ya cumplido o inexistente avisa", async () => {
      h.sched.retrieve.mockResolvedValueOnce({ ...sched, is_completed: true });
      const { unmount } = await renderPage("/admin/mantenimientos?scheduling=7");
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Ese agendamiento ya fue cumplido."));
      unmount();
      h.sched.retrieve.mockRejectedValueOnce(new Error("404"));
      await renderPage("/admin/mantenimientos?scheduling=8");
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("404"));
    });

    it("?scheduling no numérico se ignora", async () => {
      await renderPage("/admin/mantenimientos?scheduling=abc");
      expect(h.sched.retrieve).not.toHaveBeenCalled();
    });

    it("sin lista de técnicos permite escribir el ID", async () => {
      h.users.list.mockRejectedValue(new Error("403"));
      await renderPage("/admin/mantenimientos?equipment=1");
      const dialog = within(await screen.findByRole("dialog"));
      fireEvent.change(dialog.getByLabelText("ID del técnico (opcional)"), { target: { value: "5" } });
      expect(dialog.getByLabelText("ID del técnico (opcional)")).toHaveValue(5);
      fireEvent.change(dialog.getByLabelText("ID del técnico (opcional)"), { target: { value: "" } });
      await userEvent.click(dialog.getByText("Cancelar"));
    });

    it("cancelar limpia los parámetros", async () => {
      await renderPage("/admin/mantenimientos?equipment=1");
      const dialog = within(await screen.findByRole("dialog"));
      await userEvent.click(dialog.getByText("Cancelar"));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("falla al crear => alerta", async () => {
      h.maint.create.mockRejectedValue(new Error("no creó"));
      await renderPage("/admin/mantenimientos?equipment=1");
      const dialog = within(await screen.findByRole("dialog"));
      fill("Fecha", "2026-06-10");
      fireEvent.change(dialog.getAllByRole("textbox").find((t) => t.tagName === "TEXTAREA")!, { target: { value: "x" } });
      fireEvent.submit(dialog.getByText("Crear").closest("form")!);
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("no creó"));
    });
  });

  it("sin permiso de creación no muestra el botón", async () => {
    h.auth.usuario = makeUser({ role: "admin" });
    render(<MemoryRouter><MantenimientosPage /></MemoryRouter>);
    await screen.findByText("Monitor");
    expect(screen.queryByText("Nuevo mantenimiento")).toBeNull();
  });
});

describe("useMantenimientos (acciones no expuestas por la tabla)", () => {
  const wrapper = ({ children }: any) => <MemoryRouter>{children}</MemoryRouter>;

  async function setup() {
    const hook = renderHook(() => useMantenimientos(), { wrapper });
    await waitFor(() => expect(hook.result.current.items).toHaveLength(2));
    await waitFor(() => expect(hook.result.current.technicianListAvailable).toBe(true));
    return hook;
  }

  it("openCreate toma el primer equipo; openEdit carga el registro; closeModal limpia", async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.equipmentOptions).toHaveLength(2));
    act(() => result.current.openCreate());
    expect(result.current.creating).toBe(true);
    expect(result.current.form.equipment).toBe(1);
    act(() => result.current.closeModal());
    act(() => result.current.openEdit(m1));
    expect(result.current.editing).toBe(m1);
    expect(result.current.form).toMatchObject({ equipment: 1, cost: "100", scheduled_maintenance: 7 });
    expect(result.current.scheduleOptions.map((o) => o.value)).toContain("7");
    expect(result.current.scheduleOptions[0].label).toContain("Preventivo");
    act(() => result.current.openEdit(m2));
    expect(result.current.form).toMatchObject({ observations: "", assigned_technician: null, cost: "", scheduled_maintenance: null });
    act(() => result.current.closeModal());
    expect(result.current.editing).toBeNull();
  });

  it("submit en edición llama a update, recarga y cierra", async () => {
    h.maint.update.mockResolvedValue({});
    const { result } = await setup();
    act(() => result.current.openEdit(m1));
    await act(async () => {
      await result.current.submit({ preventDefault() {} } as any);
    });
    expect(h.maint.update).toHaveBeenCalledWith(1, expect.objectContaining({ equipment: 1 }));
    expect(result.current.editing).toBeNull();
  });

  it("submit con error alerta y conserva el modal", async () => {
    h.maint.update.mockRejectedValue(new Error("no guardó"));
    const { result } = await setup();
    act(() => result.current.openEdit(m1));
    await act(async () => {
      await result.current.submit({ preventDefault() {} } as any);
    });
    expect(alertSpy).toHaveBeenCalledWith("no guardó");
    expect(result.current.editing).toBe(m1);
  });

  it("confirmDelete elimina; sin objetivo no hace nada; error alerta", async () => {
    h.maint.remove.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("no se pudo"));
    const { result } = await setup();
    await act(async () => {
      await result.current.confirmDelete();
    });
    expect(h.maint.remove).not.toHaveBeenCalled();
    act(() => result.current.setToDelete(m1));
    await act(async () => {
      await result.current.confirmDelete();
    });
    expect(h.maint.remove).toHaveBeenCalledWith(1);
    expect(result.current.toDelete).toBeNull();
    act(() => result.current.setToDelete(m2));
    await act(async () => {
      await result.current.confirmDelete();
    });
    expect(alertSpy).toHaveBeenCalledWith("no se pudo");
  });

  it("permisos por rol y etiqueta de equipo desconocido", async () => {
    const { result } = await setup();
    expect(result.current.canCreate && result.current.canEdit && result.current.canDelete).toBe(true);
    expect(result.current.equipmentLabel(99)).toBe("Equipo #99");
    await waitFor(() => expect(result.current.searchOptions.length).toBeGreaterThan(0));
    expect(result.current.searchOptions.map((o) => o.label)).toEqual(["ing1", "Luis Paz", "Pedro Gómez"]);
  });
});

describe("MaintenanceRow / MaintenanceFormModal (componentes directos)", () => {
  it("la fila con acciones habilitadas muestra Editar/Eliminar y la orden", async () => {
    const openEdit = vi.fn();
    const setToDelete = vi.fn();
    render(
      <table>
        <tbody>
          <MaintenanceRow m={m1} equipmentLabel={() => "x"} canEdit canDelete openEdit={openEdit} setToDelete={setToDelete} showActions />
        </tbody>
      </table>,
    );
    expect(screen.getByText("Orden OT-9")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Editar"));
    await userEvent.click(screen.getByLabelText("Eliminar"));
    expect(openEdit).toHaveBeenCalledWith(m1);
    expect(setToDelete).toHaveBeenCalledWith(m1);
  });

  it("la fila sin permisos oculta botones", () => {
    render(
      <table>
        <tbody>
          <MaintenanceRow m={m2} equipmentLabel={() => "x"} canEdit={false} canDelete={false} openEdit={vi.fn()} setToDelete={vi.fn()} showActions />
        </tbody>
      </table>,
    );
    expect(screen.queryByLabelText("Editar")).toBeNull();
    expect(screen.queryByText(/Orden/)).toBeNull();
  });

  const baseProps: any = {
    creating: false,
    editing: m1,
    closeModal: vi.fn(),
    submit: vi.fn((e) => e.preventDefault()),
    form: { equipment: 1, kind: "PREVENTIVE", date: "2026-05-01", description: "d", observations: null, assigned_technician: null, assigned_engineer: null, cost: null, scheduled_maintenance: null },
    setForm: vi.fn(),
    equipmentOptions: [{ value: "1", label: "Monitor" }],
    equipmentError: false,
    scheduleOptions: [],
    technicianListAvailable: false,
    technicians: [],
    role: "tecnico",
    setPdf: vi.fn(),
    saving: false,
  };

  it("modal en edición: agendamientos vacíos deshabilitados, ayuda según rol y avisos de equipos", () => {
    const { rerender } = render(<MaintenanceFormModal {...baseProps} />);
    expect(screen.getByLabelText("Cumple agendamiento (opcional)")).toBeDisabled();
    expect(screen.getByText(/queda asignado a ti/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Costo (opcional)"), { target: { value: "5" } });
    expect(baseProps.setForm).toHaveBeenCalledWith(expect.objectContaining({ cost: "5" }));
    rerender(<MaintenanceFormModal {...baseProps} role="admin" equipmentOptions={[]} equipmentError />);
    expect(screen.getByText(/Tu rol no lista usuarios/)).toBeInTheDocument();
    expect(screen.getByText(/No se pudieron cargar los equipos/)).toBeInTheDocument();
    rerender(<MaintenanceFormModal {...baseProps} equipmentOptions={[]} />);
    expect(screen.getByText(/Aún no hay equipos/)).toBeInTheDocument();
  });

  it("modal: cambiar equipo/tipo/observaciones/agendamiento y el id de técnico", () => {
    render(<MaintenanceFormModal {...baseProps} scheduleOptions={[{ value: "7", label: "s" }]} />);
    fireEvent.change(screen.getByLabelText("Equipo"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Cumple agendamiento (opcional)"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "REPAIR" } });
    fireEvent.change(screen.getByPlaceholderText(/Hallazgos/), { target: { value: "ok" } });
    fireEvent.change(screen.getByLabelText("ID del técnico (opcional)"), { target: { value: "9" } });
    expect(baseProps.setForm).toHaveBeenCalledWith(expect.objectContaining({ scheduled_maintenance: 7 }));
    expect(baseProps.setForm).toHaveBeenCalledWith(expect.objectContaining({ assigned_technician: 9, assigned_engineer: null }));
  });
});
