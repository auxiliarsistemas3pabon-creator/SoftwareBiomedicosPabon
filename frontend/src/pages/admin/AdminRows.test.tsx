import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Usuario } from "@/types/authentication/auth";
import type { MaintenanceRecord } from "@/types/maintenance/maintenance";
import type { ScheduledMaintenance } from "@/types/scheduling/scheduling";
import { MaintenanceRow } from "./maintenance/MaintenanceRow";
import { SchedulingRow } from "./scheduling/SchedulingRow";
import { UserRow } from "./users/UserRow";

const maintenance: MaintenanceRecord = {
  id: 1,
  equipment: 7,
  equipment_name: "Monitor",
  equipment_asset_tag: "EQ-007",
  kind: "PREVENTIVE",
  date: "2026-01-03",
  description: "Inspección preventiva",
  scheduled_maintenance_detail: {
    id: 10,
    equipment: 7,
    kind: "PREVENTIVE",
    requested_date: "2026-01-01",
    scheduled_date: "2026-01-03",
    is_completed: false,
  },
  work_order: { id: 4, number: "OT-004", status: "IN_PROGRESS" },
};

const schedule: ScheduledMaintenance = {
  id: 10,
  equipment: 7,
  equipment_name: "Monitor",
  branch_name: "Sede Norte",
  requesting_area: "UCI",
  kind: "PREVENTIVE",
  requested_date: "2026-01-01",
  scheduled_date: "2026-01-03",
  requested_by_detail: {
    id: 2,
    username: "solicitante",
    full_name: "Usuario Solicitante",
    area: "UCI",
  },
  assigned_technician_detail: {
    id: 3,
    username: "tecnico",
    full_name: "Técnico Ejemplo",
    role: "tecnico",
    role_display: "Técnico",
  },
  is_completed: false,
};

const currentUser: Usuario = {
  id: 1,
  username: "admin",
  email: "admin@example.com",
  first_name: "Admin",
  last_name: "Ejemplo",
  role: "admin",
  is_active: true,
};

describe("administration table rows", () => {
  it("renders maintenance metadata and optional actions", async () => {
    const user = userEvent.setup();
    const openEdit = vi.fn();
    const setToDelete = vi.fn();
    const { rerender } = render(
      <table>
        <tbody>
          <MaintenanceRow
            m={maintenance}
            equipmentLabel={() => "Equipo"}
            canEdit
            canDelete
            openEdit={openEdit}
            setToDelete={setToDelete}
            showActions
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("EQ-007")).toBeInTheDocument();
    expect(screen.getByText("Programado para 2026-01-03")).toBeInTheDocument();
    expect(screen.getByText("Orden OT-004")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(openEdit).toHaveBeenCalledWith(maintenance);
    expect(setToDelete).toHaveBeenCalledWith(maintenance);

    rerender(
      <table>
        <tbody>
          <MaintenanceRow
            m={{ ...maintenance, equipment_name: undefined, equipment_asset_tag: undefined }}
            equipmentLabel={(id) => `Equipo ${id}`}
            canEdit={false}
            canDelete={false}
            openEdit={openEdit}
            setToDelete={setToDelete}
          />
        </tbody>
      </table>,
    );
    expect(screen.getByText("Equipo 7")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("renders schedules and calls create, view, maintenance, completion and edit actions", async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    const onOpenWorkOrders = vi.fn();
    const onRegisterMaintenance = vi.fn();
    const onComplete = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onCreate = vi.fn();

    const { rerender } = render(
      <table>
        <tbody>
          <SchedulingRow
            s={schedule}
            showRequestingArea
            equipmentLabel={() => "Equipo"}
            canOpenWorkOrder={false}
            canRegisterMaintenance
            canEdit
            canDelete
            onView={onView}
            onOpenWorkOrders={onOpenWorkOrders}
            onRegisterMaintenance={onRegisterMaintenance}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            canCreate
            onCreate={onCreate}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Usuario Solicitante")).toBeInTheDocument();
    expect(screen.getByText("Técnico Ejemplo")).toBeInTheDocument();
    expect(screen.getByText("UCI")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear solicitud" }));
    await user.click(screen.getByRole("button", { name: "Detalle" }));
    await user.click(screen.getByRole("button", { name: "Realizar mantenimiento" }));
    await user.click(screen.getByRole("button", { name: "Cumplir" }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onCreate).toHaveBeenCalledOnce();
    expect(onView).toHaveBeenCalledWith(schedule);
    expect(onRegisterMaintenance).toHaveBeenCalledWith(schedule);
    expect(onComplete).toHaveBeenCalledWith(schedule);
    expect(onEdit).toHaveBeenCalledWith(schedule);
    expect(onDelete).toHaveBeenCalledWith(schedule);

    rerender(
      <table>
        <tbody>
          <SchedulingRow
            s={{
              ...schedule,
              equipment_name: undefined,
              kind: "REPAIR",
              branch_name: "",
              requesting_area: null,
              requested_by_detail: undefined,
              assigned_technician_detail: undefined,
              is_completed: true,
              scheduled_date: null,
              work_order: {
                id: 4,
                number: "OT-004",
                status: "FINISHED",
                end_date: "2026-01-05T10:00:00Z",
              },
            }}
            showRequestingArea
            equipmentLabel={(id) => `Equipo ${id}`}
            canOpenWorkOrder
            canRegisterMaintenance={false}
            canEdit
            canDelete={false}
            onView={onView}
            onOpenWorkOrders={onOpenWorkOrders}
            onRegisterMaintenance={onRegisterMaintenance}
            onComplete={onComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            canCreate={false}
            onCreate={onCreate}
          />
        </tbody>
      </table>,
    );
    expect(screen.getByText("Sin sede")).toBeInTheDocument();
    expect(screen.getByText("Sin área")).toBeInTheDocument();
    expect(screen.getByText("Sin designar")).toBeInTheDocument();
    expect(screen.getByText("Sin asignar")).toBeInTheDocument();
    expect(screen.getByText("Cumplida")).toBeInTheDocument();
    expect(screen.getByText("Fin")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver orden de trabajo" }));
    expect(onOpenWorkOrders).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Cumplir" })).not.toBeInTheDocument();
  });

  it("renders user controls based on role, ownership and current activity", async () => {
    const user = userEvent.setup();
    const target: Usuario = {
      id: 2,
      username: "tecnico",
      email: "tecnico@example.com",
      first_name: "Tania",
      last_name: "Técnica",
      role: "tecnico",
      is_active: true,
    };
    const requestToggle = vi.fn();
    const setPwdTarget = vi.fn();
    const setNewPassword = vi.fn();
    const openEdit = vi.fn();
    const setToDelete = vi.fn();
    const openCreate = vi.fn();
    const props = {
      u: target,
      canEdit: true,
      canDelete: true,
      role: "admin" as const,
      usuario: currentUser,
      togglingId: null,
      requestToggle,
      setPwdTarget,
      setNewPassword,
      openEdit,
      setToDelete,
      canCreate: true,
      assignableRoles: ["tecnico", "ingeniero"] as const,
      openCreate,
    };
    const { rerender } = render(
      <table>
        <tbody>
          <UserRow {...props} assignableRoles={[...props.assignableRoles]} />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Tania Técnica")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Desactivar usuario" }));
    await user.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    await user.click(screen.getByRole("button", { name: "Contraseña" }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(requestToggle).toHaveBeenCalledWith(target);
    expect(openCreate).toHaveBeenCalledOnce();
    expect(setPwdTarget).toHaveBeenCalledWith(target);
    expect(setNewPassword).toHaveBeenCalledWith("");
    expect(openEdit).toHaveBeenCalledWith(target);
    expect(setToDelete).toHaveBeenCalledWith(target);

    rerender(
      <table>
        <tbody>
          <UserRow
            {...props}
            u={currentUser}
            togglingId={currentUser.id}
            assignableRoles={["tecnico"]}
          />
        </tbody>
      </table>,
    );
    expect(screen.getByText("Admin Ejemplo")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
  });
});
