import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";

vi.mock("@/lib/featureFlags", () => ({ PUBLIC_REGISTRATION_ENABLED: true }));

describe("HomePage", () => {
  it("renders the product overview and its main navigation", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: /un solo lugar para gestionar todos los equipos biomédicos/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Acceder al sistema" }),
    ).toHaveAttribute("href", "/login");
    expect(screen.getByText("Inventario disperso")).toBeInTheDocument();
    expect(screen.getByText("Mantenimientos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Solicitar registro" })).toHaveAttribute(
      "href",
      "/registro",
    );
  });
});
