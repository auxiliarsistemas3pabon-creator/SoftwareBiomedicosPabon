import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Combobox, type ComboboxOption } from "./Combobox";

const options: ComboboxOption[] = [
  { value: "pump", label: "Bomba", hint: "Norte" },
  { value: "valve", label: "Válvula", hint: "Sur" },
  { value: "sensor", label: "Sensor" },
];

describe("Combobox", () => {
  it("filters by option label or hint and selects the highlighted option", () => {
    const onSelect = vi.fn();
    const onQueryChange = vi.fn();
    render(
      <Combobox
        options={options}
        onSelect={onSelect}
        onQueryChange={onQueryChange}
        ariaLabel="Equipo"
      />,
    );

    const input = screen.getByRole("combobox", { name: "Equipo" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "nor" } });
    expect(screen.getByRole("option", { name: /Bomba/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Válvula/ })).not.toBeInTheDocument();
    expect(onQueryChange).toHaveBeenCalledWith("nor");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(options[0]);
    expect(input).toHaveValue("Bomba");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("clears selection on empty input and when the clear button is used", () => {
    const onSelect = vi.fn();
    const onQueryChange = vi.fn();
    render(
      <Combobox
        options={options}
        value={options[1]}
        onSelect={onSelect}
        onQueryChange={onQueryChange}
        placeholder="Buscar"
      />,
    );
    const input = screen.getByRole("combobox", { name: "Buscar" });
    expect(input).toHaveValue("Válvula");

    fireEvent.change(input, { target: { value: "" } });
    expect(onSelect).toHaveBeenCalledWith(null);
    fireEvent.change(input, { target: { value: "Bomba" } });
    fireEvent.click(screen.getByRole("button", { name: "Quitar selección" }));
    expect(onQueryChange).toHaveBeenLastCalledWith("");
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("shows the empty state, closes on Escape or outside click, and stays closed when disabled", () => {
    const { rerender } = render(
      <Combobox options={options} onSelect={vi.fn()} ariaLabel="Equipo" />,
    );
    const input = screen.getByRole("combobox", { name: "Equipo" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText("Sin coincidencias")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");

    fireEvent.focus(input);
    fireEvent.mouseDown(document.body);
    expect(input).toHaveAttribute("aria-expanded", "false");

    rerender(
      <Combobox
        options={options}
        onSelect={vi.fn()}
        ariaLabel="Equipo"
        disabled
      />,
    );
    expect(screen.getByRole("combobox", { name: "Equipo" })).toBeDisabled();
  });

  it("respects controlled values and autofocus without opening the menu", () => {
    const { rerender } = render(
      <Combobox
        options={options}
        value={options[0]}
        onSelect={vi.fn()}
        autoFocus
        placeholder="Equipo"
      />,
    );
    const input = screen.getByRole("combobox", { name: "Equipo" });
    expect(input).toHaveValue("Bomba");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    rerender(<Combobox options={options} value={null} onSelect={vi.fn()} />);
    expect(input).toHaveValue("");
  });

  it("supports pointer selection from the portaled list", () => {
    const original = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      const onSelect = vi.fn();
      render(<Combobox options={options} onSelect={onSelect} ariaLabel="Equipo" />);
      fireEvent.focus(screen.getByRole("combobox", { name: "Equipo" }));
      fireEvent.scroll(window);
      fireEvent(window, new Event("resize"));
      const option = screen.getByRole("option", { name: /Válvula/ });
      expect(scrollIntoView).toHaveBeenCalled();
      fireEvent.mouseDown(option);
      expect(onSelect).toHaveBeenCalledWith(options[1]);
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    } finally {
      if (original) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", original);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    }
  });
});
