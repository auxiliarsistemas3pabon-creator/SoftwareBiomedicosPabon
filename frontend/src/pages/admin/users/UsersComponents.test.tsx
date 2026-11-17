import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Usuario } from "@/types/authentication/auth";
import type { FormState } from "@/types/authentication/form";
import type { UserTableProps } from "@/types/authentication/props";
import { UserFormModal } from "./UserFormModal";
import { UserPagination } from "./UserPagination";
import { UserTable } from "./UserTable";
import { PasswordModal } from "./PasswordModal";

const admin: Usuario = {
  id: 1,
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

const tableProps: UserTableProps = {
  items: [],
  loading: false,
  canEdit: true,
  canDelete: true,
  role: "admin",
  usuario: admin,
  togglingId: null,
  requestToggle: vi.fn(),
  setPwdTarget: vi.fn(),
  setNewPassword: vi.fn(),
  openEdit: vi.fn(),
  setToDelete: vi.fn(),
  canCreate: true,
  assignableRoles: ["tecnico", "ingeniero", "usuario"],
  openCreate: vi.fn(),
};

const emptyForm: FormState = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  role: "tecnico",
  phone: "",
  area: "",
  password: "",
  is_active: true,
};

describe("UserTable", () => {
  it("renders loading, empty, and populated states", () => {
    const { rerender } = render(<UserTable {...tableProps} loading />);
    expect(screen.getByText("Cargando...")).toBeInTheDocument();

    rerender(<UserTable {...tableProps} />);
    expect(screen.getByText("Sin usuarios.")).toBeInTheDocument();

    rerender(<UserTable {...tableProps} items={[technician]} />);
    expect(screen.getByText("Tania Técnica")).toBeInTheDocument();
  });

  it("disables the status action while a user update is in flight", () => {
    render(
      <UserTable
        {...tableProps}
        items={[technician]}
        togglingId={technician.id}
      />,
    );
    expect(screen.getByRole("button", { name: "Desactivar usuario" })).toBeDisabled();
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("allows an editor to activate an inactive account", async () => {
    const user = userEvent.setup();
    const requestToggle = vi.fn();
    render(
      <UserTable
        {...tableProps}
        requestToggle={requestToggle}
        items={[{ ...technician, is_active: false }]}
      />,
    );
    const toggle = screen.getByRole("button", { name: "Activar usuario" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveTextContent("Inactivo");
    await user.click(toggle);
    expect(requestToggle).toHaveBeenCalledWith({ ...technician, is_active: false });
  });

  it("shows a neutral status badge when the account cannot be edited", () => {
    render(
      <UserTable
        {...tableProps}
        canEdit={false}
        canDelete={false}
        canCreate={false}
        items={[{ ...technician, is_active: false }]}
      />,
    );
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activar usuario" })).not.toBeInTheDocument();
  });
});

describe("UserPagination", () => {
  function Harness({ count = 45, loading = false }:{ count?: number; loading?: boolean }) {
    const [page, setPage] = useState(1);
    return (
      <UserPagination
        count={count}
        start={count === 0 ? 0 : (page - 1) * 20 + 1}
        end={Math.min(page * 20, count)}
        page={page}
        totalPages={Math.max(1, Math.ceil(count / 20))}
        loading={loading}
        setPage={setPage}
      />
    );
  }

  it("shows empty results and disables navigation while loading", () => {
    const { rerender } = render(<Harness count={0} />);
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    rerender(<Harness loading />);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });

  it("changes pages and clamps navigation to the available range", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText("Mostrando 1–20 de 45")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });
});

describe("UserFormModal", () => {
  it("renders create fields, updates form state, and submits", async () => {
    const user = userEvent.setup();
    const setForm = vi.fn();
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <UserFormModal
        creating
        editing={null}
        closeModal={vi.fn()}
        submit={submit}
        form={emptyForm}
        setForm={setForm}
        roleOptions={[{ value: "tecnico", label: "Técnico" }]}
        role="admin"
        saving={false}
      />,
    );

    expect(screen.getByLabelText("Área")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña inicial")).toBeInTheDocument();
    expect(screen.getByText(/Como admin no puedes asignar/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Usuario (username)"), "nuevo");
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "nuevo@example.test" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Nuevo" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Usuario" } });
    fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText(/Tel/), { target: { value: "3001234567" } });
    fireEvent.change(screen.getByLabelText(/rea/i), { target: { value: "Biomedicina" } });
    fireEvent.change(screen.getByLabelText(/Contrase.*inicial/), { target: { value: "Secure123" } });
    expect(setForm).toHaveBeenCalled();
    fireEvent.submit(screen.getByRole("button", { name: "Crear" }).closest("form")!);
    expect(submit).toHaveBeenCalledOnce();
  });

  it("renders edit state without create-only fields and closes the modal", async () => {
    const user = userEvent.setup();
    const closeModal = vi.fn();
    render(
      <UserFormModal
        creating={false}
        editing={technician}
        closeModal={closeModal}
        submit={vi.fn()}
        form={{ ...emptyForm, role: "admin", is_active: false }}
        setForm={vi.fn()}
        roleOptions={[{ value: "admin", label: "Administrador" }]}
        role="coordinador"
        saving
      />,
    );

    expect(screen.getByRole("heading", { name: "Editar usuario" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Área")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Contraseña inicial")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Usuario activo")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    await user.click(screen.getByLabelText("Usuario activo"));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(closeModal).toHaveBeenCalledOnce();
  });
});

describe("PasswordModal", () => {
  it("renders closed and open states, updates the password, and supports both close actions", async () => {
    const user = userEvent.setup();
    const setPwdTarget = vi.fn();
    const setNewPassword = vi.fn();
    const submitPassword = vi.fn().mockResolvedValue(undefined);
    const props = {
      pwdTarget: null,
      setPwdTarget,
      newPassword: "",
      setNewPassword,
      submitPassword,
      pwdSaving: false,
    };
    const { rerender } = render(<PasswordModal {...props} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<PasswordModal {...props} pwdTarget={technician} />);
    expect(screen.getByText(/Como administrador puedes definir/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nueva contraseña"), "secret123");
    expect(setNewPassword).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cambiar" }));
    expect(submitPassword).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(setPwdTarget).toHaveBeenCalledWith(null);

    rerender(<PasswordModal {...props} pwdTarget={technician} pwdSaving />);
    expect(screen.getByRole("button", { name: "Cambiar" })).toBeDisabled();
  });
});
