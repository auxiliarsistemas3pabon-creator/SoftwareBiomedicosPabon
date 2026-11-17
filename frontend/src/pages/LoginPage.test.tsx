import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

vi.mock("@/lib/featureFlags", () => ({ PUBLIC_REGISTRATION_ENABLED: true }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ login: vi.fn() }) }));

describe("LoginPage registration link", () => {
  it("links to registration when public registration is enabled", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: /Solicitar registro/ }),
    ).toHaveAttribute("href", "/registro");
  });
});
