import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TechnicianSelect } from "./TechnicianSelect";
import type { Usuario } from "@/types/authentication/auth";

function technician(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 1,
    username: "ana",
    email: "ana@example.com",
    first_name: "Ana",
    last_name: "Pérez",
    role: "tecnico",
    is_active: true,
    ...overrides,
  };
}

const technicians = [
  technician(),
  technician({
    id: 2,
    username: "luis",
    email: "luis@clinic.test",
    first_name: "Luis",
    last_name: "Díaz",
    role: "ingeniero",
  }),
];

describe("TechnicianSelect", () => {
  it("searches, selects, and clears an assigned user", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TechnicianSelect
        label="Responsable"
        value={null}
        onChange={onChange}
        technicians={technicians}
        required
        hint="Elige un responsable"
      />,
    );

    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("Elige un responsable")).toBeInTheDocument();
    const input = screen.getByPlaceholderText(
      "Buscar técnico por nombre, usuario o correo...",
    );
    fireEvent.focus(input);
    fireEvent.mouseDown(input);
    expect(screen.getByRole("button", { name: /Ana Pérez/ })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "luis@clinic" } });
    expect(screen.getByRole("button", { name: /Luis Díaz/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ana Pérez/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Luis Díaz/ }));
    expect(onChange).toHaveBeenLastCalledWith(2, technicians[1]);
    rerender(
      <TechnicianSelect
        label="Responsable"
        value={2}
        onChange={onChange}
        technicians={technicians}
        required
        hint="Elige un responsable"
      />,
    );
    expect(screen.getByText("@luis")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    await waitFor(() => expect(screen.getByPlaceholderText(/Buscar t/)).toHaveFocus());
    expect(screen.getByPlaceholderText(/Buscar técnico/)).toBeInTheDocument();
  });

  it("supports keyboard navigation, empty results, Escape, and outside clicks", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TechnicianSelect
        value={null}
        onChange={onChange}
        technicians={technicians}
        error="Selecciona un técnico"
      />,
    );
    expect(screen.getByText("Selecciona un técnico")).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/Buscar técnico/);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: /Ana Pérez/ })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(2, technicians[1]);
    rerender(
      <TechnicianSelect
        value={2}
        onChange={onChange}
        technicians={technicians}
        error="Selecciona un técnico"
      />,
    );
    expect(screen.getByText("@luis")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Luis Díaz/ }));
    let search = screen.getByPlaceholderText(/Buscar técnico/);
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "sin-resultados" } });
    expect(screen.getByText("Sin coincidencias.")).toBeInTheDocument();
    fireEvent.keyDown(search, { key: "Enter" });
    expect(screen.getByText("Sin coincidencias.")).toBeInTheDocument();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.queryByText("Sin coincidencias.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Luis Díaz/ }));
    search = screen.getByPlaceholderText(/Buscar técnico/);
    fireEvent.mouseDown(search);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("button", { name: /Ana Pérez/ })).not.toBeInTheDocument();
  });

  it("opens on Enter and does not allow interaction when disabled", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TechnicianSelect
        value={null}
        onChange={onChange}
        technicians={technicians}
      />,
    );
    const input = screen.getByPlaceholderText(/Buscar técnico/);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("button", { name: /Ana Pérez/ })).toBeInTheDocument();

    rerender(
      <TechnicianSelect
        value={null}
        onChange={onChange}
        technicians={technicians}
        disabled
      />,
    );
    expect(screen.getByPlaceholderText(/Buscar técnico/)).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("matches users by username when the name and email differ", () => {
    render(
      <TechnicianSelect
        value={null}
        onChange={vi.fn()}
        technicians={[
          technician({
            username: "bio-tech",
            email: "person@clinic.test",
            first_name: "María",
            last_name: "López",
          }),
        ]}
      />,
    );
    const input = screen.getByPlaceholderText(/Buscar técnico/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "bio-tech" } });
    expect(screen.getByRole("button", { name: /María López/ })).toBeInTheDocument();
  });

  it("handles an unknown selected id and focuses search when reopening a selection", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TechnicianSelect value={99} onChange={onChange} technicians={technicians} />,
    );
    expect(screen.getByPlaceholderText(/Buscar t/)).toBeInTheDocument();

    rerender(
      <TechnicianSelect value={1} onChange={onChange} technicians={technicians} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Ana/ }));
    const search = screen.getByPlaceholderText(/Buscar t/);
    await waitFor(() => expect(search).toHaveFocus());
  });
});
