import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
const state = vi.hoisted(() => ({
  auth: { usuario: null as any, isAuthenticated: false, loading: false },
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ theme: "light", toggleTheme: () => {} }) }));

import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AdminLayout } from "./AdminLayout";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MainLayout } from "./MainLayout";
import { Sidebar } from "./Sidebar";
import { makeUser } from "@/test/helpers";
import userEvent from "@testing-library/user-event";

function login(role: any) {
  state.auth = { usuario: makeUser({ role, first_name: "Ana", last_name: "Ruiz" }), isAuthenticated: true, loading: false };
}
beforeEach(() => {
  state.auth = { usuario: null, isAuthenticated: false, loading: false };
});

const at = (ui: React.ReactElement, route = "/") =>
  render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);

describe("Footer", () => {
  it("muestra contacto, soporte y año vigente", () => {
    at(<Footer />);
    expect(screen.getByText(/Todos los derechos reservados/)).toHaveTextContent(String(new Date().getFullYear()));
    expect(screen.getByText("Escribir a soporte técnico")).toHaveAttribute("href", expect.stringContaining("mailto:"));
  });
});

describe("Header", () => {
  it("anónimo: botón de login y toggle de tema", () => {
    at(<Header />);
    expect(screen.getByText("Iniciar sesión")).toHaveAttribute("href", "/login");
    expect(screen.getByLabelText(/Cambiar a modo/)).toBeInTheDocument();
  });
  it("autenticado fuera del panel muestra nombre, rol e 'Ir al panel'", () => {
    login("admin");
    at(<Header />, "/otra");
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
    expect(screen.getByText("Ir al panel").closest("a")).toHaveAttribute("href", "/admin");
  });
  it("dentro del panel oculta 'Ir al panel'; con onToggleSidebar muestra el menú", async () => {
    login("admin");
    const toggle = vi.fn();
    at(<Header onToggleSidebar={toggle} />, "/admin/equipos");
    expect(screen.queryByText("Ir al panel")).toBeNull();
    await userEvent.click(screen.getByLabelText("Abrir menú"));
    expect(toggle).toHaveBeenCalled();
  });
});

describe("Sidebar", () => {
  const labels = () => screen.getAllByRole("link").map((a) => a.textContent);

  it.each([
    ["superadmin", ["Dashboard", "Sedes", "Equipos", "Etiquetas QR", "Mantenimientos", "Órdenes de trabajo", "Solicitudes", "Reportes de falla", "Usuarios", "Mi perfil"]],
    ["admin", ["Dashboard", "Sedes", "Equipos", "Etiquetas QR", "Órdenes de trabajo", "Solicitudes", "Reportes de falla", "Usuarios", "Mi perfil"]],
    ["coordinador", ["Dashboard", "Sedes", "Equipos", "Etiquetas QR", "Mantenimientos", "Órdenes de trabajo", "Solicitudes pendientes", "Reportes de falla", "Mi perfil"]],
    ["ingeniero", ["Dashboard", "Sedes", "Equipos", "Etiquetas QR", "Tareas asignadas", "Solicitudes pendientes", "Reportes de falla", "Mi perfil"]],
    ["tecnico", ["Dashboard", "Solicitudes", "Mi perfil"]],
    ["usuario", ["Dashboard", "Solicitudes", "Mi perfil"]],
  ])("enlaces visibles para %s", (role, expected) => {
    login(role);
    at(<Sidebar />);
    expect(labels()).toEqual(expected);
  });

  it("sin sesión no muestra enlaces", () => {
    at(<Sidebar />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("Layouts", () => {
  it("MainLayout renderiza header, outlet y footer", () => {
    at(
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<p>contenido público</p>} />
        </Route>
      </Routes>,
    );
    expect(screen.getByText("contenido público")).toBeInTheDocument();
    expect(screen.getByText("Iniciar sesión")).toBeInTheDocument();
  });

  it("AdminLayout renderiza sidebar + outlet y aísla errores en el boundary", () => {
    login("admin");
    const Boom = () => {
      throw new Error("kaboom");
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    at(
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<p>panel ok</p>} />
          <Route path="roto" element={<Boom />} />
        </Route>
      </Routes>,
      "/admin",
    );
    expect(screen.getByText("panel ok")).toBeInTheDocument();
    expect(screen.getByText("Mi perfil")).toBeInTheDocument();
    spy.mockRestore();

    const spy2 = vi.spyOn(console, "error").mockImplementation(() => {});
    at(
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="roto" element={<Boom />} />
        </Route>
      </Routes>,
      "/admin/roto",
    );
    expect(screen.queryByText("panel ok", { selector: "p" })).toBeTruthy();
    expect(spy2).toHaveBeenCalled();
    spy2.mockRestore();
  });
});

describe("ProtectedRoute", () => {
  const tree = (roles?: any[]) => (
    <Routes>
      <Route path="/" element={<p>login</p>} />
      <Route path="/admin" element={<p>panel</p>} />
      <Route element={<ProtectedRoute roles={roles} />}>
        <Route path="/privado" element={<p>privado</p>} />
      </Route>
    </Routes>
  );

  it("muestra spinner mientras carga", () => {
    state.auth = { usuario: null, isAuthenticated: false, loading: true };
    const { container } = at(tree(), "/privado");
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });
  it("redirige al login sin sesión", () => {
    at(tree(), "/privado");
    expect(screen.getByText("login")).toBeInTheDocument();
  });
  it("permite el acceso autenticado sin restricción de roles", () => {
    login("tecnico");
    at(tree(), "/privado");
    expect(screen.getByText("privado")).toBeInTheDocument();
  });
  it("permite el acceso cuando el rol está permitido", () => {
    login("admin");
    at(tree(["admin"]), "/privado");
    expect(screen.getByText("privado")).toBeInTheDocument();
  });
  it("redirige al panel cuando el rol no está permitido", () => {
    login("tecnico");
    at(tree(["admin"]), "/privado");
    expect(screen.getByText("panel")).toBeInTheDocument();
  });
});
