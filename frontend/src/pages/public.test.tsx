import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
const h = vi.hoisted(() => ({
  flags: { on: false },
  auth: { usuario: null as any, isAuthenticated: false, login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn(), loading: false },
  setPassword: vi.fn(),
}));

vi.mock("@/lib/featureFlags", () => ({
  get PUBLIC_REGISTRATION_ENABLED() {
    return h.flags.on;
  },
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => h.auth }));
vi.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ theme: "light", toggleTheme: () => {} }) }));
vi.mock("@/services/users.service", () => ({ usersService: { setPassword: h.setPassword } }));

import { HomePage } from "./HomePage";
import { LoginPage } from "./LoginPage";
import { NotFoundPage } from "./NotFoundPage";
import { RecuperarPasswordPage } from "./RecuperarPasswordPage";
import { RegistroPage } from "./RegistroPage";
import { PerfilPage } from "./admin/PerfilPage";
import { PlaceholderPage } from "./admin/PlaceholderPage";
import { makeUser } from "@/test/helpers";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

beforeEach(() => {
  h.flags.on = false;
  h.auth.usuario = null;
  h.auth.isAuthenticated = false;
  h.auth.login.mockReset();
  h.auth.logout.mockReset();
  h.auth.refreshUser.mockReset();
  h.setPassword.mockReset();
});
afterEach(() => vi.useRealTimers());

function renderLogin(entry: any = "/") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  it("muestra el formulario y el aviso de registro deshabilitado", () => {
    renderLogin();
    expect(screen.getByText("Bienvenido")).toBeInTheDocument();
    expect(screen.getByText(/lo realiza un\s+administrador/)).toBeInTheDocument();
    expect(screen.queryByText(/Solicitar registro/)).toBeNull();
  });

  it("usuario no registrado: muestra 'Acceso no autorizado' y registra 'Permiso no autorizado' en consola", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err: any = new Error("401");
    err.isAxiosError = true;
    err.response = { status: 401, data: { code: "user_not_found", detail: "Acceso no autorizado" } };
    h.auth.login.mockRejectedValue(err);
    renderLogin();
    await userEvent.type(screen.getByLabelText("Usuario"), "intruso");
    await userEvent.type(screen.getByLabelText("Contraseña"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByText("Acceso no autorizado")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith("Permiso no autorizado");
    spy.mockRestore();
  });

  it("MFA: pide configurar, luego envía el código junto con las credenciales", async () => {
    const mfaErr: any = new Error("401");
    mfaErr.isAxiosError = true;
    mfaErr.response = {
      status: 401,
      data: { code: "mfa_setup_required", secret: "ABCDEF", otpauth_uri: "otpauth://totp/x?secret=ABCDEF" },
    };
    h.auth.login.mockRejectedValueOnce(mfaErr).mockResolvedValueOnce(makeUser({ role: "admin" }));
    renderLogin();
    await userEvent.type(screen.getByLabelText("Usuario"), "ana");
    await userEvent.type(screen.getByLabelText("Contraseña"), "secreto");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    // El QR se muestra en un modal
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Configura la verificación en dos pasos");
    expect(dialog).toHaveTextContent("Google Authenticator");
    expect(screen.getByText(/Clave manual: ABCDEF/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Código de verificación"), "12a3456");
    await userEvent.click(screen.getByRole("button", { name: "Verificar y entrar" }));
    await waitFor(() =>
      expect(h.auth.login).toHaveBeenLastCalledWith({ username: "ana", password: "secreto", otp: "123456" }),
    );
  });

  it("clave incorrecta de un usuario existente tambien muestra 'Acceso no autorizado'", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err: any = new Error("401");
    err.isAxiosError = true;
    err.response = {
      status: 401,
      data: { detail: "La combinación de credenciales no tiene una cuenta activa" },
    };
    h.auth.login.mockRejectedValue(err);
    renderLogin();
    await userEvent.type(screen.getByLabelText("Usuario"), "Juan");
    await userEvent.type(screen.getByLabelText("Contraseña"), "mala");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByText("Acceso no autorizado")).toBeInTheDocument();
    expect(screen.queryByText(/cuenta activa/)).toBeNull();
    expect(spy).toHaveBeenCalledWith("Permiso no autorizado");
    spy.mockRestore();
  });

  it("con registro habilitado muestra el enlace", () => {
    h.flags.on = true;
    renderLogin();
    expect(screen.getByText(/Solicitar registro/)).toHaveAttribute("href", "/registro");
  });

  it("inicia sesión y navega al panel", async () => {
    h.auth.login.mockResolvedValue(makeUser({ role: "admin" }));
    renderLogin();
    await userEvent.type(screen.getByLabelText("Usuario"), "ana");
    await userEvent.type(screen.getByLabelText("Contraseña"), "secreto");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(h.auth.login).toHaveBeenCalledWith({ username: "ana", password: "secreto" });
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/admin"));
  });

  it("respeta state.from y ?next= internos y descarta externos", async () => {
    h.auth.login.mockResolvedValue(makeUser());
    const submit = async () => {
      await userEvent.type(screen.getByLabelText("Usuario"), "a");
      await userEvent.type(screen.getByLabelText("Contraseña"), "b");
      await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    };
    renderLogin({ pathname: "/", state: { from: "/admin/equipos/3" } });
    await submit();
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/admin/equipos/3"));
  });

  it("usa ?next= y bloquea redirecciones externas", async () => {
    h.auth.login.mockResolvedValue(makeUser());
    const { unmount } = renderLogin("/?next=%2Fadmin%2Ffallas");
    await userEvent.type(screen.getByLabelText("Usuario"), "a");
    await userEvent.type(screen.getByLabelText("Contraseña"), "b");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/admin/fallas"));
    unmount();

    renderLogin("/?next=%2F%2Fevil.com");
    await userEvent.type(screen.getByLabelText("Usuario"), "a");
    await userEvent.type(screen.getByLabelText("Contraseña"), "b");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/admin"));
    expect(screen.getByTestId("where")).not.toHaveTextContent("evil");
  });

  it("muestra el error del backend o el genérico", async () => {
    const err = new AxiosError("x", "E", undefined, undefined, { status: 403, statusText: "", headers: {}, config: {} as any, data: { detail: "Cuenta bloqueada" } } as any);
    h.auth.login.mockRejectedValueOnce(err);
    renderLogin();
    await userEvent.type(screen.getByLabelText("Usuario"), "a");
    await userEvent.type(screen.getByLabelText("Contraseña"), "b");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cuenta bloqueada");

    h.auth.login.mockRejectedValueOnce("raro");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Credenciales inválidas"));
  });
});

describe("RegistroPage", () => {
  const renderIt = () =>
    render(
      <MemoryRouter initialEntries={["/registro"]}>
        <Routes>
          <Route path="/registro" element={<RegistroPage />} />
          <Route path="/" element={<p>login</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it("valida todos los campos obligatorios", async () => {
    renderIt();
    fireEvent.submit(screen.getByRole("button", { name: "Enviar solicitud" }).closest("form")!);
    expect(await screen.findByText("El nombre es obligatorio")).toBeInTheDocument();
    expect(screen.getByText("El apellido es obligatorio")).toBeInTheDocument();
    expect(screen.getByText("El documento es obligatorio")).toBeInTheDocument();
    expect(screen.getAllByText("Selecciona un cargo")).toHaveLength(2);
    expect(screen.getByText("El correo es obligatorio")).toBeInTheDocument();
    expect(screen.getByText("Mínimo 8 caracteres")).toBeInTheDocument();
  });

  it("valida formatos de documento, correo y contraseña", async () => {
    renderIt();
    await userEvent.type(screen.getByLabelText("Documento de identidad"), "12ab");
    await userEvent.type(screen.getByLabelText("Correo institucional"), "malo");
    await userEvent.type(screen.getByLabelText("Contraseña"), "abcdefgh");
    await userEvent.type(screen.getByLabelText("Confirmar contraseña"), "otra");
    fireEvent.submit(screen.getByRole("button", { name: "Enviar solicitud" }).closest("form")!);
    expect(await screen.findByText("El documento debe tener entre 6 y 15 dígitos")).toBeInTheDocument();
    expect(screen.getByText("Correo no válido")).toBeInTheDocument();
    expect(screen.getByText("Debe incluir al menos una mayúscula y un número")).toBeInTheDocument();
    expect(screen.getByText("Las contraseñas no coinciden")).toBeInTheDocument();
  });

  it("envía la solicitud y muestra la confirmación", async () => {
    renderIt();
    await userEvent.type(screen.getByLabelText("Nombre"), "Ana");
    await userEvent.type(screen.getByLabelText("Apellido"), "Ruiz");
    await userEvent.type(screen.getByLabelText("Documento de identidad"), "1234567");
    await userEvent.selectOptions(screen.getByLabelText("Cargo"), "medico");
    await userEvent.type(screen.getByLabelText("Correo institucional"), "ana@clinica.co");
    await userEvent.type(screen.getByLabelText("Contraseña"), "Abcdefg1");
    await userEvent.type(screen.getByLabelText("Confirmar contraseña"), "Abcdefg1");
    await userEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));
    expect(await screen.findByText("Solicitud enviada", undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText("ana@clinica.co")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Ir a iniciar sesión"));
    expect(screen.getByText("login")).toBeInTheDocument();
  });
});

describe("RecuperarPasswordPage / NotFound / Placeholder / Home", () => {
  it("Recuperar explica el procedimiento", () => {
    render(
      <MemoryRouter>
        <RecuperarPasswordPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("¿Olvidaste tu contraseña?")).toBeInTheDocument();
    expect(screen.getByText("Escribir a soporte").closest("a")).toHaveAttribute("href", expect.stringContaining("mailto:"));
  });

  it("NotFound muestra 'Ir al panel' solo autenticado", () => {
    const { unmount } = render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Ir al panel")).toBeNull();
    unmount();
    h.auth.isAuthenticated = true;
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Ir al panel")).toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("Placeholder con y sin descripción", () => {
    const { rerender } = render(<PlaceholderPage title="Reportes" description="desc" />);
    expect(screen.getByText("desc")).toBeInTheDocument();
    rerender(<PlaceholderPage title="Reportes" />);
    expect(screen.queryByText("desc")).toBeNull();
    expect(screen.getByText("Vista en construcción")).toBeInTheDocument();
  });

  it("Home muestra secciones y el CTA de registro según la bandera", () => {
    const { unmount } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Inventario disperso")).toBeInTheDocument();
    expect(screen.getAllByText("Hojas de vida").length).toBeGreaterThan(0);
    expect(screen.queryByText("Solicitar registro")).toBeNull();
    unmount();
    h.flags.on = true;
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Solicitar registro")).toBeInTheDocument();
  });
});

describe("PerfilPage", () => {
  const renderIt = () =>
    render(
      <MemoryRouter initialEntries={["/admin/perfil"]}>
        <Routes>
          <Route path="/admin/perfil" element={<PerfilPage />} />
          <Route path="/" element={<p>pantalla login</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it("sin usuario no renderiza nada", () => {
    const { container } = renderIt();
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra los datos del usuario (con y sin sede/teléfono)", () => {
    h.auth.usuario = makeUser({ first_name: "Ana", last_name: "Ruiz", username: "ana", phone: "300", branch_name: "Sede Norte", role: "admin" } as any);
    const { unmount } = renderIt();
    expect(screen.getByText("AR")).toBeInTheDocument();
    expect(screen.getByText("Sede Norte")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    unmount();
    h.auth.usuario = makeUser({ first_name: "", last_name: "", username: "zed", is_active: false, role: "tecnico" } as any);
    renderIt();
    expect(screen.getByText("Z")).toBeInTheDocument();
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
    expect(screen.getByText(/Sin sede asignada/)).toBeInTheDocument();
  });

  it("cierra sesión y navega al login", async () => {
    h.auth.usuario = makeUser();
    renderIt();
    await userEvent.click(screen.getByText("Cerrar sesión"));
    expect(h.auth.logout).toHaveBeenCalled();
    expect(screen.getByText("pantalla login")).toBeInTheDocument();
  });

  async function openModal() {
    h.auth.usuario = makeUser({ id: 7 });
    renderIt();
    await userEvent.click(screen.getByLabelText("Cambiar contraseña"));
  }

  it("valida longitud y coincidencia", async () => {
    await openModal();
    await userEvent.type(screen.getByLabelText("Nueva contraseña"), "corta");
    await userEvent.click(screen.getByText("Guardar"));
    expect(screen.getByRole("alert")).toHaveTextContent("al menos 8 caracteres");
    await userEvent.clear(screen.getByLabelText("Nueva contraseña"));
    await userEvent.type(screen.getByLabelText("Nueva contraseña"), "suficiente1");
    await userEvent.type(screen.getByLabelText("Confirmar nueva contraseña"), "distinta");
    await userEvent.click(screen.getByText("Guardar"));
    expect(screen.getByRole("alert")).toHaveTextContent("no coinciden");
    expect(h.setPassword).not.toHaveBeenCalled();
  });

  it("cambia la contraseña con éxito", async () => {
    h.setPassword.mockResolvedValue({ detail: "ok" });
    await openModal();
    await userEvent.type(screen.getByLabelText("Contraseña actual"), "vieja");
    await userEvent.type(screen.getByLabelText("Nueva contraseña"), "nuevaClave1");
    await userEvent.type(screen.getByLabelText("Confirmar nueva contraseña"), "nuevaClave1");
    await userEvent.click(screen.getByText("Guardar"));
    expect(h.setPassword).toHaveBeenCalledWith(7, { current_password: "vieja", new_password: "nuevaClave1" });
    expect(await screen.findByRole("status")).toHaveTextContent("Contraseña actualizada correctamente.");
    expect(h.auth.refreshUser).toHaveBeenCalled();
  });

  it("muestra el error del backend y permite cancelar", async () => {
    h.setPassword.mockRejectedValue(new Error("Contraseña actual incorrecta"));
    await openModal();
    await userEvent.type(screen.getByLabelText("Nueva contraseña"), "nuevaClave1");
    await userEvent.type(screen.getByLabelText("Confirmar nueva contraseña"), "nuevaClave1");
    await userEvent.click(screen.getByText("Guardar"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Contraseña actual incorrecta");
    await userEvent.click(screen.getByText("Cancelar"));
    expect(screen.queryByText("Cambiar contraseña", { selector: "h2" })).toBeNull();
  });
});
