import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./ThemeContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { renderToString } from "react-dom/server";

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalMatchMedia) {
    Object.defineProperty(window, "matchMedia", originalMatchMedia);
  } else {
    Reflect.deleteProperty(window, "matchMedia");
  }
});

function installStorage(initial: string | null, failReads = false, failWrites = false) {
  const values = new Map<string, string>();
  if (initial !== null) values.set("theme", initial);
  const getItem = vi.fn((key: string) => {
    if (failReads) throw new Error("storage unavailable");
    return values.get(key) ?? null;
  });
  const setItem = vi.fn((key: string, value: string) => {
    if (failWrites) throw new Error("storage unavailable");
    values.set(key, value);
  });
  vi.stubGlobal("localStorage", { getItem, setItem });
  return { values, getItem, setItem };
}

function installSystemPreference(matches: boolean, fail = false) {
  const matchMedia = vi.fn(() => {
    if (fail) throw new Error("matchMedia unavailable");
    return { matches };
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: matchMedia,
  });
  return matchMedia;
}

describe("ThemeProvider", () => {
  it("defaults to light when rendered without a browser window", () => {
    vi.stubGlobal("window", undefined);
    const markup = renderToString(
      <ThemeProvider>
        <span>server theme</span>
      </ThemeProvider>,
    );
    expect(markup).toContain("server theme");
  });

  it("uses and persists a valid stored theme", () => {
    const storage = installStorage("dark");
    const matchMedia = installSystemPreference(false);
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByRole("button", { name: "Cambiar a modo claro" })).toBeInTheDocument();
    expect(storage.setItem).toHaveBeenCalledWith("theme", "dark");
    expect(matchMedia).not.toHaveBeenCalled();
  });

  it("falls back to the system preference when stored data is invalid", () => {
    installStorage("sepia");
    const matchMedia = installSystemPreference(true);
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement).toHaveClass("dark");
    expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
  });

  it("uses light mode when the system preference is not dark", () => {
    installStorage("sepia");
    const matchMedia = installSystemPreference(false);
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement).not.toHaveClass("dark");
    expect(matchMedia).toHaveBeenCalledOnce();
  });

  it("falls back to light mode when storage and system preference are unavailable", () => {
    const storage = installStorage(null, true, true);
    installSystemPreference(false, true);
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement).not.toHaveClass("dark");
    expect(screen.getByRole("button", { name: "Cambiar a modo oscuro" })).toBeInTheDocument();
    expect(storage.getItem).toHaveBeenCalledWith("theme");
    expect(storage.setItem).toHaveBeenCalled();
  });

  it("toggles the root theme class when requested", () => {
    installStorage("light");
    installSystemPreference(false);
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cambiar a modo oscuro" }));
    expect(document.documentElement).toHaveClass("dark");
    fireEvent.click(screen.getByRole("button", { name: "Cambiar a modo claro" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("requires consumers to be rendered within the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<ThemeToggle />)).toThrow(
      "useTheme debe usarse dentro de ThemeProvider",
    );
  });
});
