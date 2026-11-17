import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Badge } from "./Badge";
import { Card, CardHeader } from "./Card";
import { Combobox, type ComboboxOption } from "./Combobox";
import { ConfirmDialog } from "./ConfirmDialog";
import { Form } from "./Form";
import { IconHint } from "./IconHint";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { Select } from "./Select";
import { Tabs } from "./Tabs";
import { ThemeToggle } from "./ThemeToggle";
import { Toast } from "./Toast";
import { ToastContainer } from "./ToastContainer";
import { TechnicianSelect } from "./TechnicianSelect";
import { ThemeProvider } from "@/context/ThemeContext";
import { makeUser } from "@/test/helpers";

afterEach(() => {
  vi.useRealTimers();
});

describe("Badge", () => {
  it("renderiza hijos, tono y clase extra", () => {
    render(
      <Badge tone="success" className="extra">
        OK
      </Badge>,
    );
    const el = screen.getByText("OK");
    expect(el.className).toContain("emerald");
    expect(el.className).toContain("extra");
  });
  it("usa tono neutral por defecto", () => {
    render(<Badge>N</Badge>);
    expect(screen.getByText("N").className).toContain("bg-app-muted");
  });
});

describe("Card / CardHeader", () => {
  it("aplica padding y propaga props", () => {
    render(
      <Card padding="lg" data-testid="c">
        x
      </Card>,
    );
    expect(screen.getByTestId("c").className).toContain("p-8");
    render(
      <Card padding="none" data-testid="c2">
        y
      </Card>,
    );
    expect(screen.getByTestId("c2").className).not.toContain("p-");
  });
  it("CardHeader muestra título, subtítulo y acción; variante compacta", () => {
    const { rerender } = render(<CardHeader title="T" subtitle="S" action={<button>go</button>} />);
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("go")).toBeInTheDocument();
    expect(screen.getByText("T").className).toContain("text-base");
    rerender(<CardHeader title="T" compact />);
    expect(screen.getByText("T").className).toContain("text-sm");
    expect(screen.queryByText("S")).toBeNull();
  });
});

describe("Form", () => {
  it("renderiza un contenedor", () => {
    const { container } = render(<Form />);
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement);
  });
});

describe("IconHint", () => {
  it("muestra la etiqueta al hover/focus y la oculta al salir", () => {
    render(
      <IconHint label="Ayuda">
        <button>i</button>
      </IconHint>,
    );
    const btn = screen.getByText("i");
    expect(screen.queryByText("Ayuda")).toBeNull();
    fireEvent.mouseEnter(btn.parentElement!);
    expect(screen.getByText("Ayuda")).toBeInTheDocument();
    fireEvent.mouseLeave(btn.parentElement!);
    expect(screen.queryByText("Ayuda")).toBeNull();
    fireEvent.focus(btn.parentElement!);
    expect(screen.getByText("Ayuda")).toBeInTheDocument();
    fireEvent.blur(btn.parentElement!);
    expect(screen.queryByText("Ayuda")).toBeNull();
  });
});

describe("Input", () => {
  it("asocia label, muestra error sobre hint y reenvía el ref", () => {
    const ref = createRef<HTMLInputElement>();
    const { rerender } = render(<Input ref={ref} label="Nombre" hint="pista" leftIcon={<i>ic</i>} />);
    expect(screen.getByLabelText("Nombre")).toBe(ref.current);
    expect(screen.getByText("pista")).toBeInTheDocument();
    expect(screen.getByText("ic")).toBeInTheDocument();
    rerender(<Input ref={ref} label="Nombre" hint="pista" error="mal" />);
    expect(screen.getByText("mal")).toBeInTheDocument();
    expect(screen.queryByText("pista")).toBeNull();
  });
  it("sin label ni mensajes no renderiza extras; respeta id", () => {
    const { container } = render(<Input id="mi-id" />);
    expect(container.querySelector("#mi-id")).toBeTruthy();
    expect(container.querySelector("label")).toBeNull();
  });
  it("alterna visibilidad de contraseña", async () => {
    render(<Input type="password" label="Clave" />);
    const input = screen.getByLabelText("Clave") as HTMLInputElement;
    expect(input.type).toBe("password");
    await userEvent.click(screen.getByLabelText("Mostrar contraseña"));
    expect(input.type).toBe("text");
    await userEvent.click(screen.getByLabelText("Ocultar contraseña"));
    expect(input.type).toBe("password");
  });
});

describe("Select", () => {
  const options = [
    { value: "a", label: "A" },
    { value: "b", label: "B" },
  ];
  it("renderiza opciones, placeholder y dispara onChange", async () => {
    const onChange = vi.fn();
    render(<Select label="Letra" options={options} placeholder="Elige" onChange={onChange} hint="h" />);
    expect(screen.getByText("Elige")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Letra"), "b");
    expect(onChange).toHaveBeenCalled();
    expect(screen.getByText("h")).toBeInTheDocument();
  });
  it("muestra error", () => {
    render(<Select options={options} error="mal" />);
    expect(screen.getByText("mal")).toBeInTheDocument();
  });
  it("sin placeholder ni label", () => {
    const ref = createRef<HTMLSelectElement>();
    render(<Select ref={ref} options={options} id="s" />);
    expect(ref.current!.querySelectorAll("option")).toHaveLength(2);
  });
});

describe("Tabs", () => {
  it("marca la pestaña activa y notifica cambios", async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        value="a"
        onChange={onChange}
        className="x"
        items={[
          { value: "a", label: "Uno", icon: <i>ic</i> },
          { value: "b", label: "Dos" },
        ]}
      />,
    );
    expect(screen.getByRole("tab", { name: /Uno/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Dos" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("ThemeToggle", () => {
  it("alterna entre modo claro y oscuro", async () => {
    localStorage.setItem("theme", "light");
    render(
      <ThemeProvider>
        <ThemeToggle className="k" />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByLabelText("Cambiar a modo oscuro"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    await userEvent.click(screen.getByLabelText("Cambiar a modo claro"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

describe("Modal", () => {
  it("no renderiza cerrado; cierra con X, backdrop y Escape", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open={false} onClose={onClose} title="T">
        cont
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(
      <Modal open onClose={onClose} title="T">
        cont
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Cerrar"));
    fireEvent.click(document.querySelector(".bg-black\\/50")!);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(document, { key: "a" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
  it("Escape solo cierra el modal superior y respeta tamaños", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <>
        <Modal open onClose={outer} title="Fuera" size="xl">
          a
        </Modal>
        <Modal open onClose={inner} title="Dentro" size="xs" nested>
          b
        </Modal>
      </>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });
  it.each(["sm", "md", "lg"] as const)("tamaño %s", (size) => {
    render(
      <Modal open onClose={() => {}} title="T" size={size}>
        x
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("confirma y cancela", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog open title="¿Seguro?" description="desc" danger onConfirm={onConfirm} onClose={onClose} />,
    );
    expect(screen.getByText("desc")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Confirmar"));
    await userEvent.click(screen.getByText("Cancelar"));
    expect(onConfirm).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
  it("textos personalizados, sin descripción y en estado loading", () => {
    render(
      <ConfirmDialog
        open
        title="T"
        confirmText="Sí"
        cancelText="No"
        loading
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("No").closest("button")).toBeDisabled();
    expect(screen.getByText("Sí").closest("button")).toBeDisabled();
  });
});

describe("Toast / ToastContainer", () => {
  it("se autodescarta tras la duración y permite cerrar manualmente", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast toast={{ id: "1", title: "T", body: "B", meta: "M", duration: 1000 }} onDismiss={onDismiss} />);
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onDismiss).toHaveBeenCalledWith("1");
    fireEvent.click(screen.getByLabelText("Cerrar notificación"));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
  it("usa 6000 ms por defecto y omite body/meta", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast toast={{ id: "1", title: "Solo" }} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(5999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalled();
  });
  it("el contenedor no renderiza sin toasts y los lista en un portal", () => {
    const { rerender } = render(<ToastContainer toasts={[]} onDismiss={() => {}} />);
    expect(screen.queryByLabelText("Notificaciones")).toBeNull();
    rerender(<ToastContainer toasts={[{ id: "a", title: "Hola" }]} onDismiss={() => {}} />);
    expect(screen.getByLabelText("Notificaciones")).toBeInTheDocument();
    expect(screen.getByText("Hola")).toBeInTheDocument();
  });
});

describe("Combobox", () => {
  const options: ComboboxOption[] = [
    { value: "1", label: "Álamo", hint: "H1" },
    { value: "2", label: "Bomba" },
    { value: "3", label: "Cama" },
  ];

  function Harness(props: Partial<React.ComponentProps<typeof Combobox>>) {
    const [picked, setPicked] = useState<ComboboxOption | null>(null);
    return (
      <>
        <Combobox
          options={options}
          onSelect={(o) => {
            setPicked(o);
            props.onSelect?.(o);
          }}
          placeholder="Buscar"
          {...props}
        />
        <span data-testid="picked">{picked?.label ?? "ninguno"}</span>
      </>
    );
  }

  it("filtra por inicio de texto (sin tildes) o hint y selecciona con click", async () => {
    const onQueryChange = vi.fn();
    render(<Harness onQueryChange={onQueryChange} />);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "al");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(onQueryChange).toHaveBeenLastCalledWith("al");
    fireEvent.mouseDown(screen.getByRole("option"));
    expect(screen.getByTestId("picked")).toHaveTextContent("Álamo");
    expect((input as HTMLInputElement).value).toBe("Álamo");
    // búsqueda por hint
    await userEvent.clear(input);
    await userEvent.type(input, "H1");
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("muestra 'Sin coincidencias'", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByText("Sin coincidencias")).toBeInTheDocument();
  });

  it("navega con el teclado: flechas, Enter y Escape", async () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}{ArrowDown}{Enter}");
    expect(screen.getByTestId("picked")).toHaveTextContent("Cama");
    await userEvent.click(input);
    await userEvent.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("limpia con el botón y al vaciar el texto", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "B");
    await userEvent.click(screen.getByLabelText("Quitar selección"));
    expect(onSelect).toHaveBeenLastCalledWith(null);
    await userEvent.type(input, "B");
    await userEvent.clear(input);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("sincroniza el texto con value controlado", () => {
    const { rerender } = render(<Combobox options={options} onSelect={() => {}} value={options[1]} />);
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("Bomba");
    rerender(<Combobox options={options} onSelect={() => {}} value={null} />);
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("");
  });

  it("autoFocus no abre la lista hasta interactuar; click fuera cierra", async () => {
    render(
      <div>
        <button>fuera</button>
        <Combobox options={options} onSelect={() => {}} autoFocus ariaLabel="cb" />
      </div>,
    );
    const input = screen.getByLabelText("cb");
    expect(input).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-expanded", "true");
    fireEvent.mouseDown(screen.getByText("fuera"));
    await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "false"));
  });

  it("deshabilitado", () => {
    render(<Combobox options={options} onSelect={() => {}} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("Enter sin lista abierta no selecciona", async () => {
    const onSelect = vi.fn();
    render(<Combobox options={options} onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("TechnicianSelect", () => {
  const techs = [
    makeUser({ id: 1, username: "ana", email: "ana@x.co", first_name: "Ana", last_name: "Ruiz", role: "tecnico" }),
    makeUser({ id: 2, username: "luis", email: "luis@x.co", first_name: "Luis", last_name: "Paz", role: "ingeniero" }),
  ];

  it("lista, filtra y selecciona", async () => {
    const onChange = vi.fn();
    render(<TechnicianSelect label="Técnico" required technicians={techs} value={null} onChange={onChange} hint="pista" />);
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("pista")).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/Buscar técnico/);
    await userEvent.click(input);
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    await userEvent.type(input, "luis@");
    expect(screen.queryByText("Ana Ruiz")).toBeNull();
    await userEvent.click(screen.getByText("Luis Paz"));
    expect(onChange).toHaveBeenCalledWith(2, techs[1]);
  });

  it("sin coincidencias", async () => {
    render(<TechnicianSelect technicians={techs} value={null} onChange={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "zzz");
    expect(screen.getByText("Sin coincidencias.")).toBeInTheDocument();
  });

  it("navegación con teclado", async () => {
    const onChange = vi.fn();
    render(<TechnicianSelect technicians={techs} value={null} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "ArrowDown" }); // abre
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith(2, techs[1]);
    await userEvent.click(input);
    await userEvent.keyboard("{Escape}");
  });

  it("Enter con el menú cerrado lo abre; Enter sin resultados no hace nada", async () => {
    const onChange = vi.fn();
    render(<TechnicianSelect technicians={techs} value={null} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    await userEvent.type(input, "zzz");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("muestra el seleccionado, permite limpiarlo y reabrir", async () => {
    const onChange = vi.fn();
    render(<TechnicianSelect technicians={techs} value={1} onChange={onChange} error="obligatorio" />);
    expect(screen.getByText("@ana")).toBeInTheDocument();
    expect(screen.getByText("obligatorio")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Limpiar"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("al hacer click en el seleccionado abre la búsqueda", async () => {
    render(<TechnicianSelect technicians={techs} value={1} onChange={() => {}} />);
    await userEvent.click(screen.getByText("Ana Ruiz"));
    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument());
  });

  it("click fuera cierra el menú; el chevron lo alterna; hover cambia el resaltado", async () => {
    render(
      <div>
        <span>fuera</span>
        <TechnicianSelect technicians={techs} value={null} onChange={() => {}} disabled={false} />
      </div>,
    );
    await userEvent.click(screen.getByRole("textbox"));
    expect(screen.getByText("Luis Paz")).toBeInTheDocument();
    await userEvent.hover(screen.getByText("Luis Paz"));
    fireEvent.mouseDown(screen.getByText("fuera"));
    await waitFor(() => expect(screen.queryByText("Luis Paz")).toBeNull());
  });

  it("valor que no existe en la lista se trata como sin selección", () => {
    render(<TechnicianSelect technicians={techs} value={999} onChange={() => {}} disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
