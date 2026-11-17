import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
const h = vi.hoisted(() => ({
  auth: { usuario: null as any },
  svc: {
    listPaginated: vi.fn(),
    listAll: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    setPassword: vi.fn(),
  },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => h.auth }));
vi.mock("@/services/users.service", () => ({ usersService: h.svc }));

import { UsuariosPage } from "./UsuariosPage";
import { makeUser, page } from "@/test/helpers";

const admin = makeUser({ id: 1, role: "admin", username: "admin", first_name: "Ad", last_name: "Min" });
const tec = makeUser({ id: 2, role: "tecnico", username: "tec", first_name: "Tec", last_name: "Nico", email: "t@x.co", is_active: true, area: "UCI", phone: "300" } as any);
const inactivo = makeUser({ id: 3, role: "usuario", username: "inac", first_name: "In", last_name: "Activo", is_active: false });

let alertSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  Object.values(h.svc).forEach((f) => f.mockReset());
  h.auth.usuario = admin;
  h.svc.listPaginated.mockResolvedValue(page([admin, tec, inactivo], { count: 3 }));
  h.svc.listAll.mockResolvedValue([admin, tec, inactivo, makeUser({ first_name: "Ad", last_name: "Min", username: "dup" })]);
  alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function renderPage() {
  const utils = render(<UsuariosPage />);
  await screen.findByText("@tec · t@x.co");
  return utils;
}
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const row = (username: string) => screen.getByText(new RegExp(`@${username} ·`)).closest("tr") as HTMLElement;

describe("UsuariosPage", () => {
  it("lista usuarios con estado y acciones según permisos", async () => {
    await renderPage();
    expect(h.svc.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ ordering: "username", page: 1, page_size: 20 }));
    expect(screen.getByText("Mostrando 1–3 de 3")).toBeInTheDocument();
    // el propio admin no se puede desactivar ni eliminar (y un admin no gestiona admins)
    expect(within(row("admin")).queryByLabelText("Eliminar")).toBeNull();
    expect(within(row("tec")).getByLabelText("Eliminar")).toBeInTheDocument();
    expect(within(row("inac")).getByLabelText("Activar usuario")).toBeInTheDocument();
  });

  it("muestra estado vacío y error de carga", async () => {
    h.svc.listPaginated.mockResolvedValueOnce(page([], { count: 0 }));
    render(<UsuariosPage />);
    expect(await screen.findByText("Sin usuarios.")).toBeInTheDocument();
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("muestra el mensaje de error si falla la carga", async () => {
    h.svc.listPaginated.mockRejectedValue(new Error("caído"));
    render(<UsuariosPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("caído");
  });

  it("tolera fallo al cargar opciones del buscador", async () => {
    h.svc.listAll.mockRejectedValue(new Error("x"));
    await renderPage();
  });

  it("filtra por rol, estado y búsqueda (con vuelta a la página 1)", async () => {
    await renderPage();
    h.svc.listPaginated.mockClear();
    const [, roleSel, stateSel] = screen.getAllByRole("combobox");
    await userEvent.selectOptions(roleSel, "tecnico");
    await waitFor(() => expect(h.svc.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ role: "tecnico" })));
    await userEvent.selectOptions(stateSel, "false");
    await waitFor(() => expect(h.svc.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ is_active: false })));
    await userEvent.selectOptions(stateSel, "true");
    await waitFor(() => expect(h.svc.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ is_active: true })));
    await userEvent.type(screen.getByLabelText("Buscar usuario por nombre"), "te");
    await waitFor(() => expect(h.svc.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ search: "te" })));
    // seleccionar una opción del combobox
    fireEvent.mouseDown(within(await screen.findByRole("listbox")).getByRole("option", { name: /Usuario operativo/ }));
    await waitFor(() => expect(h.svc.listPaginated).toHaveBeenCalledWith(expect.objectContaining({ search: "Usuario operativo" })));
  });

  it("pagina hacia adelante y atrás", async () => {
    h.svc.listPaginated.mockResolvedValue(page([admin, tec], { count: 45 }));
    await renderPage();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Siguiente"));
    await waitFor(() => expect(h.svc.listPaginated).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    await screen.findByText("2 / 3");
    await userEvent.click(screen.getByText("Anterior"));
    await screen.findByText("1 / 3");
  });

  describe("crear", () => {
    it("crea un usuario (técnico requiere área) y recarga", async () => {
      h.svc.create.mockResolvedValue({});
      await renderPage();
      await userEvent.click(within(row("tec")).getByLabelText("Nuevo usuario"));
      expect(await screen.findByText("Nuevo usuario", { selector: "h2" })).toBeInTheDocument();
      fill("Usuario (username)", "nuevo");
      fill("Correo", "n@x.co");
      fill("Nombre", "Nu");
      fill("Apellido", "Evo");
      fill("Teléfono", "311");
      await userEvent.selectOptions(screen.getByLabelText("Rol"), "tecnico");
      fill("Área", "  Radiología ");
      fill("Contraseña inicial", "claveSegura1");
      await userEvent.click(screen.getByText("Crear"));
      await waitFor(() =>
        expect(h.svc.create).toHaveBeenCalledWith(
          expect.objectContaining({ username: "nuevo", role: "tecnico", area: "Radiología", phone: "311", password: "claveSegura1" }),
        ),
      );
      await waitFor(() => expect(screen.queryByText("Nuevo usuario", { selector: "h2" })).toBeNull());
    });

    it("crea sin teléfono y con rol no técnico (área vacía)", async () => {
      h.svc.create.mockResolvedValue({});
      await renderPage();
      await userEvent.click(within(row("tec")).getByLabelText("Nuevo usuario"));
      await screen.findByLabelText("Usuario (username)");
      fill("Usuario (username)", "u2");
      fill("Correo", "u2@x.co");
      fill("Nombre", "U");
      fill("Apellido", "Dos");
      await userEvent.selectOptions(screen.getByLabelText("Rol"), "usuario");
      fill("Contraseña inicial", "claveSegura1");
      await userEvent.click(screen.getByText("Crear"));
      await waitFor(() => expect(h.svc.create).toHaveBeenCalledWith(expect.objectContaining({ role: "usuario", area: "", phone: undefined })));
    });

    it("alerta si el backend rechaza", async () => {
      h.svc.create.mockRejectedValue(new Error("Usuario duplicado"));
      await renderPage();
      await userEvent.click(within(row("tec")).getByLabelText("Nuevo usuario"));
      await screen.findByLabelText("Usuario (username)");
      fill("Usuario (username)", "u");
      fill("Correo", "u@x.co");
      fill("Nombre", "U");
      fill("Apellido", "D");
      await userEvent.selectOptions(screen.getByLabelText("Rol"), "tecnico");
      fill("Área", "UCI");
      fill("Contraseña inicial", "claveSegura1");
      await userEvent.click(screen.getByText("Crear"));
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Usuario duplicado"));
    });

    it("cancela el modal", async () => {
      await renderPage();
      await userEvent.click(within(row("tec")).getByLabelText("Nuevo usuario"));
      await userEvent.click(await screen.findByText("Cancelar"));
      await waitFor(() => expect(screen.queryByText("Nuevo usuario", { selector: "h2" })).toBeNull());
    });
  });

  describe("editar", () => {
    it("edita y guarda con is_active", async () => {
      h.svc.update.mockResolvedValue({});
      await renderPage();
      await userEvent.click(within(row("tec")).getByLabelText("Editar"));
      expect(await screen.findByText("Editar usuario")).toBeInTheDocument();
      expect(screen.getByLabelText("Usuario (username)")).toHaveValue("tec");
      expect(screen.queryByLabelText("Contraseña inicial")).toBeNull();
      await userEvent.clear(screen.getByLabelText("Nombre"));
      fill("Nombre", "Nuevo");
      await userEvent.click(screen.getByLabelText("Usuario activo"));
      await userEvent.click(screen.getByText("Guardar"));
      await waitFor(() =>
        expect(h.svc.update).toHaveBeenCalledWith(2, expect.objectContaining({ first_name: "Nuevo", is_active: false, area: "UCI" })),
      );
    });

    it("alerta cuando falla el guardado", async () => {
      h.svc.update.mockRejectedValue(new Error("fallo guardando"));
      await renderPage();
      await userEvent.click(within(row("tec")).getByLabelText("Editar"));
      await userEvent.click(await screen.findByText("Guardar"));
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("fallo guardando"));
    });

    it("bloquea asignar un rol no permitido", async () => {
      await renderPage();
      await userEvent.click(within(row("tec")).getByLabelText("Editar"));
      await screen.findByText("Editar usuario");
      // El rol 'superadmin' no existe en las opciones; forzamos un valor no asignable.
      const select = screen.getByLabelText("Rol") as HTMLSelectElement;
      const opt = document.createElement("option");
      opt.value = "superadmin";
      opt.textContent = "x";
      select.appendChild(opt);
      fireEvent.change(select, { target: { value: "superadmin" } });
      await userEvent.click(screen.getByText("Guardar"));
      expect(alertSpy).toHaveBeenCalledWith("No tienes permiso para asignar ese rol.");
      expect(h.svc.update).not.toHaveBeenCalled();
    });
  });

  describe("eliminar", () => {
    it("confirma y elimina", async () => {
      h.svc.remove.mockResolvedValue(undefined);
      await renderPage();
      await userEvent.click(within(row("tec")).getByLabelText("Eliminar"));
      expect(screen.getByText(/¿Eliminar a "tec"\?/)).toBeInTheDocument();
      await userEvent.click(screen.getByText("Eliminar", { selector: "button" }));
      await waitFor(() => expect(h.svc.remove).toHaveBeenCalledWith(2));
    });
    it("alerta si falla y permite cancelar", async () => {
      h.svc.remove.mockRejectedValue(new Error("no se pudo"));
      await renderPage();
      await userEvent.click(within(row("tec")).getByLabelText("Eliminar"));
      await userEvent.click(screen.getByText("Eliminar", { selector: "button" }));
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("no se pudo"));
      await userEvent.click(screen.getByText("Cancelar"));
    });
  });

  describe("activar / desactivar", () => {
    it("desactivar pide confirmación y actualiza", async () => {
      h.svc.update.mockResolvedValue({ ...tec, is_active: false });
      await renderPage();
      await userEvent.click(within(row("tec")).getByLabelText("Desactivar usuario"));
      expect(screen.getByText(/¿Desactivar a "tec"\?/)).toBeInTheDocument();
      await userEvent.click(screen.getByText("Desactivar", { selector: "button" }));
      await waitFor(() => expect(h.svc.update).toHaveBeenCalledWith(2, { is_active: false }));
      await waitFor(() => expect(within(row("tec")).getByLabelText("Activar usuario")).toBeInTheDocument());
    });
    it("activar es inmediato; si falla revierte y alerta", async () => {
      h.svc.update.mockRejectedValue(new Error("sin permiso"));
      await renderPage();
      await userEvent.click(within(row("inac")).getByLabelText("Activar usuario"));
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("sin permiso"));
      expect(within(row("inac")).getByLabelText("Activar usuario")).toBeInTheDocument();
    });
    it("cancelar el diálogo no cambia nada", async () => {
      await renderPage();
      await userEvent.click(within(row("tec")).getByLabelText("Desactivar usuario"));
      await userEvent.click(screen.getByText("Cancelar"));
      expect(h.svc.update).not.toHaveBeenCalled();
    });
  });

  describe("contraseña", () => {
    it("valida longitud y cambia la contraseña", async () => {
      h.svc.setPassword.mockResolvedValue({});
      await renderPage();
      await userEvent.click(within(row("tec")).getByLabelText("Contraseña"));
      expect(await screen.findByText(/Cambiar contraseña — tec/)).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText("Nueva contraseña"), "corta");
      await userEvent.click(screen.getByText("Cambiar"));
      expect(alertSpy).toHaveBeenCalledWith("La contraseña debe tener al menos 8 caracteres.");
      await userEvent.clear(screen.getByLabelText("Nueva contraseña"));
      await userEvent.type(screen.getByLabelText("Nueva contraseña"), "largaSegura1");
      await userEvent.click(screen.getByText("Cambiar"));
      await waitFor(() => expect(h.svc.setPassword).toHaveBeenCalledWith(2, { new_password: "largaSegura1" }));
    });
    it("alerta si el backend falla y cancela", async () => {
      h.svc.setPassword.mockRejectedValue(new Error("rechazada"));
      await renderPage();
      await userEvent.click(within(row("tec")).getByLabelText("Contraseña"));
      await screen.findByLabelText("Nueva contraseña");
      fill("Nueva contraseña", "largaSegura1");
      await userEvent.click(screen.getByText("Cambiar"));
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("rechazada"));
      await userEvent.click(screen.getByText("Cancelar"));
    });
  });

  describe("permisos por rol", () => {
    it("coordinador/técnico sin permisos ven solo badges (sin acciones)", async () => {
      h.auth.usuario = makeUser({ id: 50, role: "coordinador" });
      render(<UsuariosPage />);
      await screen.findByText("@tec · t@x.co");
      expect(screen.queryByLabelText("Editar")).toBeNull();
      expect(screen.queryByLabelText("Nuevo usuario")).toBeNull();
      expect(screen.getAllByText("Activo").length).toBeGreaterThan(0);
    });
    it("superadmin puede gestionar a un admin", async () => {
      h.auth.usuario = makeUser({ id: 99, role: "superadmin" });
      render(<UsuariosPage />);
      await screen.findByText("@tec · t@x.co");
      expect(within(row("admin")).getByLabelText("Editar")).toBeInTheDocument();
    });
    it("sin usuario autenticado no hay acciones", async () => {
      h.auth.usuario = null;
      render(<UsuariosPage />);
      await screen.findByText("@tec · t@x.co");
      expect(screen.queryByLabelText("Editar")).toBeNull();
    });
  });
});
