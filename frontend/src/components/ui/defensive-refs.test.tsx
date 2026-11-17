import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Combobox } from "./Combobox";
import { IconHint } from "./IconHint";

describe("components handle unavailable DOM refs", () => {
  it("does not show an IconHint before its wrapper ref is available", () => {
    const { unmount } = render(
      <IconHint label="Ayuda contextual">
        <button aria-label="Ayuda">?</button>
      </IconHint>,
    );
    const wrapper = screen.getByRole("button", { name: "Ayuda" }).parentElement!;
    const propsKey = Object.keys(wrapper).find((key) =>
      key.startsWith("__reactProps$"),
    )!;
    const onMouseEnter = (
      wrapper as unknown as Record<string, { onMouseEnter: () => void }>
    )[propsKey].onMouseEnter;

    unmount();
    onMouseEnter();

    expect(screen.queryByText("Ayuda contextual")).not.toBeInTheDocument();
  });

  it("opens the Combobox without positioning a menu when its input ref is unavailable", () => {
    render(
      <Combobox
        options={[{ value: "pump", label: "Bomba" }]}
        onSelect={vi.fn()}
        ariaLabel="Equipo"
      />,
    );
    const input = screen.getByRole("combobox", { name: "Equipo" });

    const querySelector = vi.spyOn(input.parentElement!, "querySelector").mockReturnValue(null);
    fireEvent.focus(input);

    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    querySelector.mockRestore();
  });
});
