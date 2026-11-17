import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
const h = vi.hoisted(() => ({
  auth: { usuario: null as any },
  failures: { listPaginated: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), resolve: vi.fn() },
  equipment: { list: vi.fn(), listAll: vi.fn() },
  branches: { list: vi.fn() },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => h.auth }));
vi.mock("@/services/failures.service", () => ({ failuresService: h.failures }));
vi.mock("@/services/equipment.service", () => ({ equipmentService: h.equipment }));
vi.mock("@/services/branches.service", () => ({ branchesService: h.branches }));

import { FallasPage } from "./FallasPage";
import { FailureHeader } from "./FailureHeader";
import { makeUser, page } from "@/test/helpers";

const eq1: any = { id: 1, name: "Monitor", asset_tag: "EQ-1", area: "UCI" };
const eq2: any = { id: 2, name: "Bomba", asset_tag: "EQ-2", area: "" };
const f1: any = { id: 10, equipment: 1, equipment_asset_tag: "EQ-1", branch_name: "Sede A", equipment_area: "UCI", description: "No enciende", severity: "HIGH", reported_at: "2026-05-01T10:00:00Z", resolved: false };
const f2: any = { id: 11, equipment: 2, description: "Ruido", severity: "LOW", reported_at: "2026-05-02T10:00:00Z", resolved: true };

let alertSpy: any;
beforeEach(() => {
  Object.values(h.failures).forEach((f) => f.mockReset());
  h.equipment.list.mockReset().mockResolvedValue([eq1, eq2]);
  h.equipment.listAll.mockReset().mockResolvedValue([eq1, eq2, { ...eq1, id: 3 }, { id: 4, name: "  ", asset_tag: "x" }]);
  h.branches.list.mockReset().mockResolvedValue([{ id: 5, name: "Sede A", city: "Cali" }]);
  h.failures.listPaginated.mockResolvedValue(page([f1, f2], { count: 2 }));
  h.auth.usuario = makeUser({ role: "admin" });
  alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
});

async function renderPage() {
  const r = render(
    <MemoryRouter initialEntries={["/admin/fallas"]}>
      <Routes>
        <Route path="/admin/fallas" element={<FallasPage />} />
        <Route path="/admin" element={<p>dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText("Sede A");
  return r;
}
const rowOf = (text: string) => screen.getByText(text).closest("tr") as HTMLElement;

describe("FailureHeader", () => {
  it("cambia el texto según rol", () => {
    const { rerender } = render(<FailureHeader role="tecnico" usuario={{ area: "UCI" } as any} />);
    expect(screen.getByText(/UCI/)).toBeInTheDocument();
    rerender(<FailureHeader role="tecnico" usuario={{} as any} />);
    expect(screen.getByText(/reportes que has generado\./)).toBeInTheDocument();
    rerender(<FailureHeader role="ingeniero" usuario={null} />);
    expect(screen.getByText(/Resuelve los reportes/)).toBeInTheDocument();
    rerender(<FailureHeader role="admin" usuario={null} />);
    expect(screen.getByText(/Registra y resuelve/)).toBeInTheDocument();
  });
});

describe("FallasPage", () => {
  it("lista reportes con etiqueta de equipo y estado", async () => {
    await renderPage();
    expect(screen.getByText("EQ-1")).toBeInTheDocument();
    expect(screen.getByText("Bomba (EQ-2)")).toBeInTheDocument(); // sin asset_tag => equipmentLabel
    expect(screen.getByText("Abierta")).toBeInTheDocument();
    expect(screen.getByText("Resuelta")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 1–2 de 2")).toBeInTheDocument();
  });

  it("etiqueta de equipo desconocido", async () => {
    h.equipment.list.mockResolvedValue([]);
    h.failures.listPaginated.mockResolvedValue(page([f2], { count: 1 }));
    render(<MemoryRouter><FallasPage /></MemoryRouter>);
    expect(await screen.findByText("Equipo #2")).toBeInTheDocument();
  });

  it("estado vacío y error de carga", async () => {
    h.failures.listPaginated.mockResolvedValueOnce(page([], { count: 0 }));
    const { unmount } = render(<MemoryRouter><FallasPage /></MemoryRouter>);
    expect(await screen.findByText("Sin reportes.")).toBeInTheDocument();
    unmount();
    h.failures.listPaginated.mockRejectedValue(new Error("boom"));
    render(<MemoryRouter><FallasPage /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("tolera fallos de equipos, opciones y sedes", async () => {
    h.equipment.list.mockRejectedValue(new Error("x"));
    h.equipment.listAll.mockRejectedValue(new Error("x"));
    h.branches.list.mockRejectedValue(new Error("x"));
    render(<MemoryRouter><FallasPage /></MemoryRouter>);
    await screen.findByText("Sede A");
    await userEvent.click(screen.getAllByLabelText("Nuevo reporte")[0]);
    expect(await screen.findByText(/No se pudieron cargar los equipos/)).toBeInTheDocument();
  });

  it("aplica filtros (severidad, estado, sede, servicio, búsqueda)", async () => {
    await renderPage();
    h.failures.listPaginated.mockClear();
    const [, sev, res, sede, area] = screen.getAllByRole("combobox");
    await userEvent.selectOptions(sev, "HIGH");
    await waitFor(() => expect(h.failures.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ severity: "HIGH" })));
    await userEvent.selectOptions(res, "true");
    await waitFor(() => expect(h.failures.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ resolved: true })));
    await userEvent.selectOptions(res, "false");
    await waitFor(() => expect(h.failures.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ resolved: false })));
    await userEvent.selectOptions(sede, "5");
    await waitFor(() => expect(h.failures.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ branch: 5 })));
    await userEvent.selectOptions(area, "UCI");
    await waitFor(() => expect(h.failures.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ area: "UCI" })));
    fireEvent.change(screen.getByLabelText("Buscar reporte por equipo"), { target: { value: "mon" } });
    await waitFor(() => expect(h.failures.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ search: "mon" })));
    fireEvent.mouseDown(within(await screen.findByRole("listbox")).getByRole("option", { name: "Monitor" }));
    await waitFor(() => expect(h.failures.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ search: "Monitor" })));
  });

  it("pagina", async () => {
    h.failures.listPaginated.mockResolvedValue(page([f1], { count: 20 }));
    render(<MemoryRouter><FallasPage /></MemoryRouter>);
    await screen.findByText("1 / 4");
    fireEvent.click(screen.getByText("Siguiente"));
    await waitFor(() => expect(h.failures.listPaginated).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });

  it("crea un reporte", async () => {
    h.failures.create.mockResolvedValue({});
    await renderPage();
    await userEvent.click(within(rowOf("EQ-1")).getByLabelText("Nuevo reporte"));
    expect(await screen.findByText("Nuevo reporte de falla")).toBeInTheDocument();
    const dialog = within(screen.getByRole("dialog"));
    await userEvent.selectOptions(dialog.getByLabelText("Equipo"), "2");
    await userEvent.selectOptions(dialog.getByLabelText("Severidad"), "CRITICAL");
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: "Humo" } });
    await userEvent.click(dialog.getByText("Crear"));
    await waitFor(() => expect(h.failures.create).toHaveBeenCalledWith({ equipment: 2, severity: "CRITICAL", description: "Humo" }));
  });

  it("muestra el aviso cuando no hay equipos y alerta si falla crear", async () => {
    h.equipment.list.mockResolvedValue([]);
    h.failures.create.mockRejectedValue(new Error("rechazado"));
    render(<MemoryRouter><FallasPage /></MemoryRouter>);
    await screen.findByText("Sede A");
    await userEvent.click(screen.getAllByLabelText("Nuevo reporte")[0]);
    expect(await screen.findByText(/Aún no hay equipos registrados/)).toBeInTheDocument();
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: "x" } });
    fireEvent.submit(dialog.getByText("Crear").closest("form")!);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("rechazado"));
    await userEvent.click(dialog.getByText("Cancelar"));
  });

  it("edita un reporte", async () => {
    h.failures.update.mockResolvedValue({});
    await renderPage();
    await userEvent.click(within(rowOf("EQ-1")).getByLabelText("Editar"));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("Editar reporte")).toBeInTheDocument();
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: "Actualizado" } });
    await userEvent.click(dialog.getByText("Guardar"));
    await waitFor(() => expect(h.failures.update).toHaveBeenCalledWith(10, { equipment: 1, severity: "HIGH", description: "Actualizado" }));
  });

  it("elimina con confirmación y reporta error", async () => {
    h.failures.remove.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("no borra"));
    await renderPage();
    await userEvent.click(within(rowOf("EQ-1")).getByLabelText("Eliminar"));
    await userEvent.click(screen.getByText("Eliminar", { selector: "button" }));
    await waitFor(() => expect(h.failures.remove).toHaveBeenCalledWith(10));
    await userEvent.click(within(rowOf("EQ-1")).getByLabelText("Eliminar"));
    await userEvent.click(screen.getByText("Eliminar", { selector: "button" }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("no borra"));
    await userEvent.click(screen.getByText("Cancelar"));
  });

  it("resuelve con notas; solo los abiertos tienen botón Resolver", async () => {
    h.failures.resolve.mockResolvedValue({});
    await renderPage();
    expect(within(rowOf("Bomba (EQ-2)")).queryByText("Resolver")).toBeNull();
    await userEvent.click(within(rowOf("EQ-1")).getByText("Resolver"));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: "Cambio de fuente" } });
    await userEvent.click(dialog.getByText("Marcar resuelta"));
    await waitFor(() => expect(h.failures.resolve).toHaveBeenCalledWith(10, "Cambio de fuente"));
  });

  it("resolver sin notas envía undefined; error muestra alerta; cancelar cierra", async () => {
    h.failures.resolve.mockRejectedValueOnce(new Error("fallo")).mockResolvedValueOnce({});
    await renderPage();
    await userEvent.click(within(rowOf("EQ-1")).getByText("Resolver"));
    await userEvent.click(within(await screen.findByRole("dialog")).getByText("Marcar resuelta"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("fallo"));
    expect(h.failures.resolve).toHaveBeenCalledWith(10, undefined);
    await userEvent.click(within(screen.getByRole("dialog")).getByText("Cancelar"));
  });

  it("el ingeniero vuelve al dashboard tras resolver", async () => {
    h.auth.usuario = makeUser({ role: "ingeniero" });
    h.failures.resolve.mockResolvedValue({});
    await renderPage();
    expect(screen.queryByLabelText("Eliminar")).toBeNull();
    await userEvent.click(within(rowOf("EQ-1")).getByText("Resolver"));
    await userEvent.click(within(await screen.findByRole("dialog")).getByText("Marcar resuelta"));
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });

  it("técnico: solo crea; sin sesión no hay acciones", async () => {
    h.auth.usuario = makeUser({ role: "tecnico" });
    await renderPage();
    expect(screen.queryByText("Resolver")).toBeNull();
    expect(screen.queryByLabelText("Editar")).toBeNull();
    expect(screen.getAllByLabelText("Nuevo reporte").length).toBeGreaterThan(0);
  });

  it("rol sin permisos no muestra columna de acciones", async () => {
    h.auth.usuario = null;
    await renderPage();
    expect(screen.queryByText("Acciones")).toBeNull();
  });
});
