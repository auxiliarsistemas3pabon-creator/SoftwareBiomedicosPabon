/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import type { Rol, Usuario } from "@/types/authentication/auth";

let seq = 100;

/** Usuario de prueba con valores razonables; sobreescribe lo que necesites. */
export function makeUser(overrides: Partial<Usuario> & { role?: Rol } = {}): Usuario {
  seq += 1;
  return {
    id: seq,
    username: `user${seq}`,
    email: `user${seq}@test.co`,
    first_name: "Ana",
    last_name: "Ruiz",
    role: "tecnico",
    phone: "",
    area: "",
    is_active: true,
    ...overrides,
  } as any;
}

/** Render dentro de un MemoryRouter. */
export function renderWithRouter(ui: ReactElement, route = "/") {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

/** Respuesta paginada de DRF. */
export function page<T>(results: T[], extra: Record<string, unknown> = {}) {
  return { count: results.length, next: null, previous: null, results, ...extra };
}
