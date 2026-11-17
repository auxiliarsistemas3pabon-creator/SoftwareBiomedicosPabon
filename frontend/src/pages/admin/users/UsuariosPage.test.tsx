import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Usuario } from "@/types/authentication/auth";
import { UsuariosPage } from "./UsuariosPage";

const { auth, service } = vi.hoisted(() => ({
  auth: { usuario: null as Usuario | null },
  service: {
    listPaginated: vi.fn(),
    listAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    setPassword: vi.fn(),
  },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/services/users.service", () => ({ usersService: service }));

const admin: Usuario = {
  id: 99,
  username: "admin",
  email: "admin@example.test",
  first_name: "Ada",
  last_name: "Admin",
  role: "admin",
  is_active: true,
};

const technician: Usuario = {
  id: 2,
  username: "tecnico",
  email: "tecnico@example.test",
  first_name: "Tania",
  last_name: "Técnica",
  role: "tecnico",
  area: "Radiología",
  is_active: true,
};

beforeEach(() => {
  auth.usuario = admin;
  service.listPaginated.mockResolvedValue({ count: 1, results: [technician] });
  service.listAll.mockResolvedValue([
    technician,
    { ...technician, id: 3, username: "tania", first_name: "Tania", last_name: "Técnica" },
    { ...technician, id: 4, username: "sin-nombre", first_name: "", last_name: "" },
  ]);
  service.create.mockResolvedValue({ ...technician, id: 5, username: "nuevo" });
  service.update.mockImplementation(async (id: number, changes: Partial<Usuario>) => ({
    ...technician,
    id,
    ...changes,
  }));
  service.remove.mockResolvedValue(undefined);
  service.setPassword.mockResolvedValue({ detail: "ok" });
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("UsuariosPage", () => {
  it("loads, filters, creates, edits, changes passwords, toggles, and deletes users", async () => {
    const user = userEvent.setup();
    render(<UsuariosPage />);

    expect(await screen.findByText("Tania Técnica")).toBeInTheDocument();
    await waitFor(() => expect(service.listAll).toHaveBeenCalled());
    expect(service.listPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ ordering: "username", page: 1, page_size: 20 }),
    );

    const search = screen.getByRole("combobox", { name: "Buscar usuario por nombre" });
    fireEvent.change(search, { target: { value: "Tania" } });
    await waitFor(() =>
      expect(service.listPaginated).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "Tania", page: 1 }),
      ),
    );
    const filters = screen.getAllByRole("combobox");
    await user.selectOptions(filters[1], "tecnico");
    await user.selectOptions(filters[2], "true");
    await waitFor(() => expect(service.listPaginated).toHaveBeenLastCalledWith(
      expect.objectContaining({ role: "tecnico", is_active: true }),
    ));
    await user.selectOptions(filters[2], "false");
    await waitFor(() => expect(service.listPaginated).toHaveBeenLastCalledWith(
      expect.objectContaining({ role: "tecnico", is_active: false }),
    ));

    await user.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    await user.type(screen.getByLabelText("Usuario (username)"), "nuevo");
    await user.type(screen.getByLabelText("Correo"), "nuevo@example.test");
    await user.type(screen.getByLabelText("Nombre"), "Nuevo");
    await user.type(screen.getByLabelText("Apellido"), "Usuario");
    await user.selectOptions(screen.getByLabelText("Rol"), "tecnico");
    await user.type(screen.getByLabelText("Área"), "Radiología");
    await user.type(screen.getByLabelText("Contraseña inicial"), "Secure123");
    await user.click(screen.getByRole("button", { name: "Crear" }));
    await waitFor(() => expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "nuevo",
        role: "tecnico",
        area: "Radiología",
        password: "Secure123",
      }),
    ));

    await user.click(await screen.findByRole("button", { name: "Editar" }));
    expect(screen.getByRole("heading", { name: "Editar usuario" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(service.update).toHaveBeenCalledWith(
      technician.id,
      expect.objectContaining({ username: technician.username, area: "Radiología" }),
    ));

    await user.click(await screen.findByRole("button", { name: /Contrase/ }));
    await user.click(screen.getByRole("button", { name: "Cambiar" }));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("8 caracteres"));
    await user.type(screen.getByLabelText("Nueva contraseña"), "NewPass123");
    await user.click(screen.getByRole("button", { name: "Cambiar" }));
    await waitFor(() => expect(service.setPassword).toHaveBeenCalledWith(
      technician.id,
      { new_password: "NewPass123" },
    ));

    await user.click(await screen.findByRole("button", { name: "Desactivar usuario" }));
    await user.click(screen.getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(service.update).toHaveBeenCalledWith(
      technician.id,
      { is_active: false },
    ));
    await user.click(await screen.findByRole("button", { name: "Activar usuario" }));
    await waitFor(() => expect(service.update).toHaveBeenCalledWith(
      technician.id,
      { is_active: true },
    ));

    await user.click(await screen.findByRole("button", { name: "Eliminar" }));
    await user.click(screen.getAllByRole("button", { name: "Eliminar" }).at(-1)!);
    await waitFor(() => expect(service.remove).toHaveBeenCalledWith(technician.id));
  }, 15_000);

  it("reports list and autocomplete failures and hides actions for an unprivileged role", async () => {
    service.listPaginated.mockRejectedValue(new Error("list failed"));
    service.listAll.mockRejectedValue(new Error("options failed"));
    auth.usuario = { ...admin, role: "usuario" };
    render(<UsuariosPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("list failed");
    expect(screen.queryByRole("button", { name: "Nuevo usuario" })).not.toBeInTheDocument();
    expect(screen.queryByText("Sin usuarios.")).toBeInTheDocument();
  });

  it("rejects forbidden role assignments and reports failed user creation", async () => {
    const user = userEvent.setup();
    service.create.mockRejectedValue(new Error("create failed"));
    render(<UsuariosPage />);

    expect(await screen.findByText("Tania Técnica")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    const form = screen.getByRole("button", { name: "Crear" }).closest("form")!;
    fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "superadmin" } });
    fireEvent.submit(form);
    expect(window.alert).toHaveBeenCalledWith("No tienes permiso para asignar ese rol.");

    fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "tecnico" } });
    fireEvent.change(screen.getByLabelText("Usuario (username)"), { target: { value: "nuevo" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "nuevo@example.test" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Nuevo" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Usuario" } });
    fireEvent.change(screen.getByLabelText("Área"), { target: { value: "Biomedicina" } });
    fireEvent.change(screen.getByLabelText("Contraseña inicial"), { target: { value: "Secure123" } });
    fireEvent.submit(form);
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("create failed"));
  });

  it("rolls back a failed status change and reports failed password and delete requests", async () => {
    const user = userEvent.setup();
    service.update.mockRejectedValue(new Error("toggle failed"));
    service.setPassword.mockRejectedValue(new Error("password failed"));
    service.remove.mockRejectedValue(new Error("delete failed"));
    render(<UsuariosPage />);

    expect(await screen.findByText("Tania Técnica")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Contrase/ }));
    await user.type(screen.getByLabelText("Nueva contraseña"), "Password123");
    await user.click(screen.getByRole("button", { name: "Cambiar" }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("password failed"));

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(screen.getAllByRole("button", { name: "Eliminar" }).at(-1)!);
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("delete failed"));

    await user.click(screen.getByRole("button", { name: "Desactivar usuario" }));
    await user.click(screen.getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("toggle failed"));
    expect(screen.getByRole("button", { name: "Desactivar usuario" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("updates and rolls back only the selected user in a multi-user list", async () => {
    const user = userEvent.setup();
    const inactive = {
      ...technician,
      id: 3,
      username: "inactive",
      first_name: "Irene",
      last_name: "Inactiva",
      is_active: false,
    };
    service.listPaginated.mockResolvedValue({
      count: 2,
      results: [technician, inactive],
    });
    render(<UsuariosPage />);

    expect(await screen.findByText("Irene Inactiva")).toBeInTheDocument();
    const technicianRow = screen.getAllByRole("row")[1];
    await user.click(screen.getByRole("button", { name: "Activar usuario" }));
    await waitFor(() => expect(service.update).toHaveBeenCalledWith(3, { is_active: true }));

    service.update.mockRejectedValueOnce(new Error("rollback"));
    await user.click(within(technicianRow).getByRole("button", { name: "Desactivar usuario" }));
    await user.click(screen.getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("rollback"));
  });

  it("edits an account without an area and creates a non-technician account", async () => {
    const user = userEvent.setup();
    auth.usuario = { ...admin, role: "superadmin" };
    service.listPaginated.mockResolvedValue({
      count: 1,
      results: [{ ...technician, area: undefined, phone: undefined }],
    });
    render(<UsuariosPage />);

    await user.click(await screen.findByRole("button", { name: "Editar" }));
    await user.selectOptions(screen.getByLabelText("Rol"), "admin");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(service.update).toHaveBeenCalledWith(
      technician.id,
      expect.objectContaining({ role: "admin", area: "" }),
    ));

    await user.click(await screen.findByRole("button", { name: "Nuevo usuario" }));
    fireEvent.submit(screen.getByRole("button", { name: "Crear" }).closest("form")!);
    await waitFor(() => expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: "admin", area: "" }),
    ));
  });
});
