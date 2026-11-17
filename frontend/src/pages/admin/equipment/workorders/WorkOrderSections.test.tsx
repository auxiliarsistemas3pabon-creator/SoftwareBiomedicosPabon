import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkOrderDetail } from "@/types/equipment/workorder";
import { workOrdersService } from "@/services/workorders.service";
import { WorkOrderDetailView } from "./WorkOrderDetailView";
import { ChildSection, CostSection } from "./WorkOrderSections";

vi.mock("@/services/workorders.service", () => ({
  workOrdersService: {
    sparePart: { create: vi.fn(), remove: vi.fn() },
    measurement: { create: vi.fn(), remove: vi.fn() },
    evidence: { create: vi.fn(), remove: vi.fn() },
    signature: { create: vi.fn(), remove: vi.fn() },
    cost: { create: vi.fn(), update: vi.fn() },
  },
}));

const detail: WorkOrderDetail = {
  id: 4,
  equipment: 7,
  number: "OT-004",
  service_type: "PREVENTIVE",
  start_date: "2026-01-03T10:00:00Z",
  description: "Inspección preventiva",
  status: "IN_PROGRESS",
  spare_parts: [
    {
      id: 1,
      work_order: 4,
      name: "Sensor",
      reference: "S-1",
      quantity: 2,
      unit_cost: "10.00",
      total_cost: "20.00",
    },
  ],
  measurements: [],
  evidences: [],
  signatures: [],
  cost: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("work-order detail sections", () => {
  it("renders order details and adds each editable detail type", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn().mockResolvedValue(undefined);
    vi.mocked(workOrdersService.sparePart.create).mockResolvedValue({
      id: 2,
      work_order: detail.id,
      name: "Fusible",
      reference: "F-2",
      quantity: 2,
      unit_cost: "15",
      total_cost: "30",
    });
    vi.mocked(workOrdersService.measurement.create).mockResolvedValue({
      id: 3,
      work_order: detail.id,
      parameter: "Voltaje",
      expected_value: "120",
      measured_value: "118",
      unit: "V",
      passed: false,
    });
    vi.mocked(workOrdersService.evidence.create).mockResolvedValue({
      id: 4,
      work_order: detail.id,
      evidence_type: "PHOTO",
      description: "Placa instalada",
    });
    vi.mocked(workOrdersService.signature.create).mockResolvedValue({
      id: 5,
      work_order: detail.id,
      role: "TECHNICIAN",
      signed_by: "Técnico Uno",
    });
    vi.mocked(workOrdersService.cost.create).mockResolvedValue({
      id: 6,
      work_order: detail.id,
      labor_cost: "0",
      spare_parts_cost: "0",
      transport_cost: "0",
      other_cost: "0",
    });

    render(
      <WorkOrderDetailView
        detail={{ ...detail, spare_parts: [], cost: null }}
        loading
        canEdit
        onChanged={onChanged}
        onRealizarMantenimiento={vi.fn()}
      />,
    );

    expect(screen.getByText("Cargando elementos...")).toBeInTheDocument();
    expect(screen.getByText("OT-004")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Realizar mantenimiento" }));

    const spareParts = screen
      .getByRole("heading", { name: /Repuestos/ })
      .closest("section")!;
    await user.click(within(spareParts).getByRole("button", { name: "Agregar" }));
    fireEvent.change(within(spareParts).getByLabelText("Nombre"), {
      target: { value: "Fusible" },
    });
    fireEvent.change(within(spareParts).getByLabelText("Referencia"), {
      target: { value: "F-2" },
    });
    fireEvent.change(within(spareParts).getByLabelText("Cantidad"), {
      target: { value: "2" },
    });
    fireEvent.change(within(spareParts).getByLabelText("Costo unitario"), {
      target: { value: "15" },
    });
    await user.click(
      within(spareParts).getAllByRole("button", { name: "Agregar" }).at(-1)!,
    );
    expect(workOrdersService.sparePart.create).toHaveBeenCalledWith({
      work_order: detail.id,
      name: "Fusible",
      reference: "F-2",
      quantity: "2",
      unit_cost: "15",
    });

    const measurements = screen
      .getByRole("heading", { name: /Mediciones/ })
      .closest("section")!;
    await user.click(within(measurements).getByRole("button", { name: "Agregar" }));
    fireEvent.change(within(measurements).getByLabelText("Parámetro"), {
      target: { value: "Voltaje" },
    });
    fireEvent.change(within(measurements).getByLabelText("Valor esperado"), {
      target: { value: "120" },
    });
    fireEvent.change(within(measurements).getByLabelText("Valor medido"), {
      target: { value: "118" },
    });
    fireEvent.change(within(measurements).getByLabelText("Unidad"), {
      target: { value: "V" },
    });
    await user.selectOptions(
      within(measurements).getByLabelText("¿Pasa?"),
      "false",
    );
    await user.click(
      within(measurements).getAllByRole("button", { name: "Agregar" }).at(-1)!,
    );
    expect(workOrdersService.measurement.create).toHaveBeenCalledWith({
      work_order: detail.id,
      parameter: "Voltaje",
      expected_value: "120",
      measured_value: "118",
      unit: "V",
      passed: false,
    });

    const evidences = screen
      .getByRole("heading", { name: /Evidencias/ })
      .closest("section")!;
    await user.click(within(evidences).getByRole("button", { name: "Agregar" }));
    await user.selectOptions(
      within(evidences).getByLabelText("Tipo"),
      "PHOTO",
    );
    fireEvent.change(within(evidences).getByLabelText("Descripción"), {
      target: { value: "Placa instalada" },
    });
    await user.click(
      within(evidences).getAllByRole("button", { name: "Agregar" }).at(-1)!,
    );
    expect(workOrdersService.evidence.create).toHaveBeenCalledWith({
      work_order: detail.id,
      evidence_type: "PHOTO",
      description: "Placa instalada",
    });

    const signatures = screen
      .getByRole("heading", { name: /Firmas/ })
      .closest("section")!;
    await user.click(within(signatures).getByRole("button", { name: "Agregar" }));
    await user.selectOptions(
      within(signatures).getByLabelText("Rol"),
      "TECHNICIAN",
    );
    fireEvent.change(
      within(signatures).getByLabelText("Nombre de quien firma"),
      { target: { value: "Técnico Uno" } },
    );
    await user.click(
      within(signatures).getAllByRole("button", { name: "Agregar" }).at(-1)!,
    );
    expect(workOrdersService.signature.create).toHaveBeenCalledWith({
      work_order: detail.id,
      role: "TECHNICIAN",
      signed_by: "Técnico Uno",
    });

    const costs = screen.getByRole("heading", { name: "Costos" }).closest("section")!;
    await user.click(within(costs).getByRole("button", { name: "Guardar costos" }));
    expect(workOrdersService.cost.create).toHaveBeenCalledWith({
      work_order: detail.id,
      labor_cost: "0",
      transport_cost: "0",
      other_cost: "0",
    });
    expect(onChanged).toHaveBeenCalledTimes(5);
  });

  it("adds a child row with select defaults, cancels drafts, and removes rows", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onRemove = vi.fn().mockResolvedValue(undefined);
    const onChanged = vi.fn().mockResolvedValue(undefined);
    const rows = [{ id: 5, label: "Registro inicial" }];

    render(
      <ChildSection
        title="Pruebas"
        rows={rows}
        columns={["Nombre"]}
        renderRow={(row) => [row.label]}
        canEdit
        fields={[
          { name: "label", label: "Nombre", required: true },
          {
            name: "status",
            label: "Estado",
            type: "select",
            options: [
              { value: "ok", label: "Correcto" },
              { value: "fail", label: "Fallido" },
            ],
          },
          { name: "method", label: "Método", type: "select" },
        ]}
        onAdd={onAdd}
        onRemove={onRemove}
        onChanged={onChanged}
      />,
    );

    expect(screen.getByRole("heading", { name: /Pruebas.*1/ })).toBeInTheDocument();
    expect(screen.getByText("Registro inicial")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Agregar" }));
    expect(screen.getByLabelText("Método")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Nueva prueba" },
    });
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onAdd).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Agregar" }));
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Nueva prueba" },
    });
    await user.selectOptions(screen.getByLabelText("Estado"), "fail");
    await user.click(screen.getAllByRole("button", { name: "Agregar" }).at(-1)!);
    expect(onAdd).toHaveBeenCalledWith({ status: "fail", label: "Nueva prueba" });
    expect(onChanged).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onRemove).toHaveBeenCalledWith(5);
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it("reports add and remove errors and hides editing controls when read-only", async () => {
    const user = userEvent.setup();
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const onAdd = vi.fn().mockRejectedValue(new Error("add failed"));
    const onRemove = vi.fn().mockRejectedValue(new Error("remove failed"));
    const onChanged = vi.fn().mockResolvedValue(undefined);
    const props = {
      title: "Sólo lectura",
      rows: [{ id: 1, label: "Fila" }],
      columns: ["Nombre"],
      renderRow: (row: { id: number; label: string }) => [row.label],
      fields: [{ name: "label", label: "Nombre" }],
      onAdd,
      onRemove,
      onChanged,
    };
    const { rerender } = render(<ChildSection {...props} canEdit={false} />);
    expect(screen.queryByRole("button", { name: "Agregar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();

    rerender(<ChildSection {...props} canEdit />);
    await user.click(screen.getByRole("button", { name: "Agregar" }));
    await user.click(screen.getAllByRole("button", { name: "Agregar" }).at(-1)!);
    expect(alert).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(alert).toHaveBeenCalledTimes(2);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("treats an omitted row collection as empty", () => {
    render(
      <ChildSection
        title="Opcionales"
        rows={undefined}
        columns={[]}
        renderRow={() => []}
        canEdit={false}
        fields={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: /Opcionales.*0/ })).toBeInTheDocument();
  });

  it("defaults empty cost inputs to zero when spare parts are omitted", () => {
    const { rerender } = render(
      <CostSection
        detail={{ ...detail, spare_parts: undefined, cost: null }}
        canEdit={false}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.change(screen.getByLabelText("Mano de obra"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Transporte"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Otros"), { target: { value: "" } });
    expect(screen.getByText(/\$0,00/)).toBeInTheDocument();
    expect(screen.getByLabelText("Repuestos")).toHaveValue(0);

    rerender(
      <CostSection
        detail={{
          ...detail,
          spare_parts: [{ ...detail.spare_parts![0], total_cost: "" }],
          cost: null,
        }}
        canEdit={false}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByLabelText("Repuestos")).toHaveValue(0);
  });

  it("creates and updates cost records and computes the displayed total", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn().mockResolvedValue(undefined);
    vi.mocked(workOrdersService.cost.create).mockResolvedValue({
      id: 8,
      work_order: detail.id,
      labor_cost: "30",
      spare_parts_cost: "20",
      transport_cost: "5",
      other_cost: "2",
    });
    const { rerender } = render(
      <CostSection detail={detail} canEdit onChanged={onChanged} />,
    );
    fireEvent.change(screen.getByLabelText("Mano de obra"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Transporte"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Otros"), {
      target: { value: "2" },
    });
    expect(screen.getByText(/\$57,00/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar costos" }));
    expect(workOrdersService.cost.create).toHaveBeenCalledWith({
      work_order: detail.id,
      labor_cost: "30",
      transport_cost: "5",
      other_cost: "2",
    });
    expect(onChanged).toHaveBeenCalledOnce();

    const updatedDetail = {
      ...detail,
      cost: {
        id: 8,
        work_order: detail.id,
        labor_cost: "30",
        spare_parts_cost: "20",
        transport_cost: "5",
        other_cost: "2",
      },
    };
    rerender(<CostSection detail={updatedDetail} canEdit onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: "Actualizar costos" }));
    expect(workOrdersService.cost.update).toHaveBeenCalledWith(8, {
      labor_cost: "30",
      transport_cost: "5",
      other_cost: "2",
    });
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it("disables cost editing for read-only users and reports failed saves", async () => {
    const user = userEvent.setup();
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.mocked(workOrdersService.cost.create).mockRejectedValue(
      new Error("save failed"),
    );
    const onChanged = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <CostSection detail={detail} canEdit={false} onChanged={onChanged} />,
    );
    expect(screen.getByLabelText("Mano de obra")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar costos" })).not.toBeInTheDocument();

    rerender(<CostSection detail={detail} canEdit onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: "Guardar costos" }));
    expect(alert).toHaveBeenCalledOnce();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
