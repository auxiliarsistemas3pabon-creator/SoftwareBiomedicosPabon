import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { render } = vi.hoisted(() => ({ render: vi.fn() }));

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({ render })),
}));

vi.mock("./App.tsx", () => ({
  default: () => <div>Aplicación montada</div>,
}));

describe("main entry point", () => {
  beforeEach(() => {
    render.mockClear();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it("mounts the app inside StrictMode on the root element", async () => {
    const rootElement = document.getElementById("root");

    await import("./main");

    expect(createRoot).toHaveBeenCalledWith(rootElement);
    expect(render).toHaveBeenCalledOnce();
    expect(render.mock.calls[0][0].type).toBe(StrictMode);
  });
});
