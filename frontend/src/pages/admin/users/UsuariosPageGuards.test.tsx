import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UsuariosPage } from "./UsuariosPage";

const { service } = vi.hoisted(() => ({
  service: {
    listPaginated: vi.fn().mockResolvedValue({ count: 0, results: [] }),
    listAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    setPassword: vi.fn(),
  },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ usuario: { id: 1, username: "admin", role: "admin" } }),
}));
vi.mock("@/services/users.service", () => ({ usersService: service }));
vi.mock("@/lib/permissions", () => ({
  ROLE_LABEL: {
    superadmin: "Super administrador",
    admin: "Administrador",
    coordinador: "Coordinador",
    ingeniero: "Ingeniero",
    tecnico: "Técnico",
    usuario: "Usuario",
  },
  ASSIGNABLE_ROLES: ["admin", "coordinador", "ingeniero", "tecnico", "usuario"],
  can: () => true,
  canAssignRole: () => false,
}));
vi.mock("@/components/ui/ConfirmDialog", () => ({
  ConfirmDialog: ({ title, onConfirm }: { title: string; onConfirm: () => void }) => (
    <button type="button" onClick={() => void onConfirm()}>{title}</button>
  ),
}));
vi.mock("./PasswordModal", () => ({
  PasswordModal: ({ submitPassword }: { submitPassword: () => Promise<void> }) => (
    <button type="button" onClick={() => void submitPassword()}>Probar guardia de contraseña</button>
  ),
}));
vi.mock("@/pages/admin/users/UserTable", () => ({
  UserTable: ({ openCreate }: { openCreate: () => void }) => (
    <button type="button" onClick={openCreate}>Nuevo usuario</button>
  ),
}));

afterEach(() => vi.restoreAllMocks());

describe("UsuariosPage guarded actions", () => {
  it("safely ignores confirmation callbacks with no selected target", async () => {
    render(<UsuariosPage />);

    const confirmations = screen.getAllByRole("button", {
      name: /Desactivar usuario|Eliminar usuario/,
    });
    fireEvent.click(confirmations[1]);
    fireEvent.click(screen.getByRole("button", { name: "Probar guardia de contraseña" }));
    expect(service.remove).not.toHaveBeenCalled();
    expect(service.setPassword).not.toHaveBeenCalled();
  });

  it("uses the fallback role when permission filtering returns no assignable roles", async () => {
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
    render(<UsuariosPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Nuevo usuario" }));

    expect(screen.getByLabelText("Rol")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nuevo usuario" })).toBeInTheDocument();
  });
});
