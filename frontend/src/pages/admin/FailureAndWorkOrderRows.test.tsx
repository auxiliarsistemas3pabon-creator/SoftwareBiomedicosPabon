import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FailureReport } from "@/types/failure/failure";
import type { WorkOrder } from "@/types/equipment/workorder";
import { FailureRow } from "./failures/FailureRow";
import { WorkOrderRow } from "./equipment/workorders/WorkOrderRow";

const failure: FailureReport = {
  id: 2,
  equipment: 7,
  equipment_asset_tag: "EQ-007",
  branch_name: "Sede Norte",
  equipment_area: "UCI",
  description: "Sensor desconectado",
  severity: "HIGH",
  reported_at: "2026-01-03T10:00:00Z",
  resolved: false,
};

const order: WorkOrder = {
  id: 4,
  equipment: 7,
  equipment_name: "Monitor",
  equipment_asset_tag: "EQ-007",
  number: "OT-004",
  service_type: "PREVENTIVE",
  start_date: "invalid date",
  description: "Inspección preventiva",
  status: "PENDING",
};

describe("failure and work-order rows", () => {
  it("renders failure context and calls report, resolve, edit, and delete actions", async () => {
    const user = userEvent.setup();
    const setResolveTarget = vi.fn();
    const setResolveNotes = vi.fn();
    const openEdit = vi.fn();
    const setToDelete = vi.fn();
    const openCreate = vi.fn();

    render(
      <table>
        <tbody>
          <FailureRow
            f={failure}
            canEdit
            canDelete
            canCreate
            equipmentLabel={() => "Equipo desconocido"}
            setResolveTarget={setResolveTarget}
            setResolveNotes={setResolveNotes}
            openEdit={openEdit}
            setToDelete={setToDelete}
            openCreate={openCreate}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("EQ-007")).toBeInTheDocument();
    expect(screen.getByText("Sede Norte")).toBeInTheDocument();
    expect(screen.getByText("UCI")).toBeInTheDocument();
    expect(screen.getByText("Abierta")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nuevo reporte" }));
    await user.click(screen.getByRole("button", { name: "Resolver" }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(openCreate).toHaveBeenCalledOnce();
    expect(setResolveTarget).toHaveBeenCalledWith(failure);
    expect(setResolveNotes).toHaveBeenCalledWith("");
    expect(openEdit).toHaveBeenCalledWith(failure);
    expect(setToDelete).toHaveBeenCalledWith(failure);
  });

  it("renders resolved failures without resolve controls and falls back to equipment labels", () => {
    render(
      <table>
        <tbody>
          <FailureRow
            f={{
              ...failure,
              equipment_asset_tag: undefined,
              branch_name: undefined,
              equipment_area: null,
              resolved: true,
            }}
            canEdit
            canDelete={false}
            canCreate={false}
            equipmentLabel={(id) => `Equipo ${id}`}
            setResolveTarget={vi.fn()}
            setResolveNotes={vi.fn()}
            openEdit={vi.fn()}
            setToDelete={vi.fn()}
            openCreate={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Equipo 7")).toBeInTheDocument();
    expect(screen.getByText("Resuelta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolver" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
  });

  it("does not render an actions cell when the user has no failure permissions", () => {
    const { container } = render(
      <table>
        <tbody>
          <FailureRow
            f={failure}
            canEdit={false}
            canDelete={false}
            canCreate={false}
            equipmentLabel={() => "Equipo"}
            setResolveTarget={vi.fn()}
            setResolveNotes={vi.fn()}
            openEdit={vi.fn()}
            setToDelete={vi.fn()}
            openCreate={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(container.querySelector("tr")?.children).toHaveLength(6);
  });

  it("renders work-order details and exposes permitted actions", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onDetail = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onCreate = vi.fn();
    render(
      <table>
        <tbody>
          <WorkOrderRow
            w={order}
            isEngineer={false}
            canEdit
            canDelete
            canCreate
            onComplete={onComplete}
            onDetail={onDetail}
            onEdit={onEdit}
            onDelete={onDelete}
            onCreate={onCreate}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("OT-004")).toBeInTheDocument();
    expect(screen.getByText("EQ-007")).toBeInTheDocument();
    expect(screen.getByText("invalid date")).toBeInTheDocument();
    expect(screen.getByText("Sin asignar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nueva orden" }));
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await user.click(screen.getByRole("button", { name: "Detalle" }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(onCreate).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledWith(order);
    expect(onDetail).toHaveBeenCalledWith(order);
    expect(onEdit).toHaveBeenCalledWith(order);
    expect(onDelete).toHaveBeenCalledWith(order);
  });

  it("hides engineer editing and displays a completed order end date", () => {
    render(
      <table>
        <tbody>
          <WorkOrderRow
            w={{
              ...order,
              status: "FINISHED",
              end_date: "2026-01-04T11:00:00Z",
              equipment_name: undefined,
              equipment_asset_tag: undefined,
              technician_name: "Técnico",
            }}
            isEngineer
            canEdit
            canDelete={false}
            canCreate={false}
            onComplete={vi.fn()}
            onDetail={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onCreate={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Equipo #7")).toBeInTheDocument();
    expect(screen.getByText("Técnico")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
  });
});
