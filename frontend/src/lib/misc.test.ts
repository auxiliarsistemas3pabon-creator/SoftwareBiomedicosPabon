import { afterEach, describe, expect, it, vi } from "vitest";

import { PUBLIC_REGISTRATION_ENABLED } from "./featureFlags";
import { resolveMediaUrl } from "./media";
import {
  assignedFirstName,
  assignedRoleLabel,
  assignedUserName,
  assignmentPayload,
  fullNameOf,
} from "./users";
import { downloadEquipmentInventory } from "@/utils/equipment.inventory.export";

/* eslint-disable @typescript-eslint/no-explicit-any */

describe("featureFlags", () => {
  it("el registro público está deshabilitado", () => {
    expect(PUBLIC_REGISTRATION_ENABLED).toBe(false);
  });
});

describe("resolveMediaUrl", () => {
  it("devuelve null para vacío", () => {
    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl(undefined)).toBeNull();
    expect(resolveMediaUrl("")).toBeNull();
  });
  it("reescribe URLs absolutas a /media/ same-origin conservando query", () => {
    expect(resolveMediaUrl("http://localhost:8000/media/qr/a.png?x=1")).toBe("/media/qr/a.png?x=1");
    expect(resolveMediaUrl("/api/v1/equipment/media/a.png")).toBe("/media/a.png");
  });
  it("normaliza rutas /media sin slash final y media/ relativa", () => {
    expect(resolveMediaUrl("/media")).toBe("/media");
    // OBSERVACION QA: el prefijo "/media" sin barra captura tambien "/mediafile.png".
    expect(resolveMediaUrl("http://x/mediafile.png")).toBe("/mediafile.png");
  });
  it("deja intactas las URL que no son media", () => {
    expect(resolveMediaUrl("https://cdn.test/foto.png")).toBe("https://cdn.test/foto.png");
  });
  it("usa el fallback cuando URL() lanza", () => {
    const Orig = globalThis.URL;
    (globalThis as any).URL = class {
      constructor() {
        throw new Error("bad");
      }
    };
    try {
      expect(resolveMediaUrl("/media/a.png")).toBe("/media/a.png");
      expect(resolveMediaUrl("media/a.png")).toBe("/media/a.png");
      expect(resolveMediaUrl("otro")).toBe("otro");
    } finally {
      globalThis.URL = Orig;
    }
  });
});

describe("lib/users", () => {
  it("fullNameOf: nombre normal, rol partido y username", () => {
    expect(fullNameOf({ first_name: "Ana", last_name: "Ruiz", role: "tecnico", username: "ar" } as any)).toBe("Ana Ruiz");
    expect(fullNameOf({ first_name: "Coordi", last_name: "Nador", role: "coordinador", username: "c" } as any)).toBe("Coordinador");
    expect(fullNameOf({ first_name: "tecnico", last_name: "", role: "tecnico", username: "t" } as any)).toBe("Usuario operativo");
    expect(fullNameOf({ first_name: "", last_name: "", role: "tecnico", username: "solo" } as any)).toBe("solo");
    expect(fullNameOf({ role: "tecnico", username: "x" } as any)).toBe("x");
  });
  it("assignedUserName / FirstName / RoleLabel", () => {
    expect(assignedUserName(null)).toBeNull();
    expect(assignedUserName({ full_name: " Ana Ruiz ", username: "a" } as any)).toBe("Ana Ruiz");
    expect(assignedUserName({ full_name: "", username: "a" } as any)).toBe("a");
    expect(assignedFirstName({ full_name: "Ana Ruiz", username: "a" } as any)).toBe("Ana");
    expect(assignedFirstName(undefined)).toBeNull();
    expect(assignedRoleLabel({ role_display: " Técnico " } as any)).toBe("Técnico");
    expect(assignedRoleLabel(null)).toBe("Asignado");
  });
  it("assignmentPayload enruta por rol", () => {
    expect(assignmentPayload(null)).toEqual({ assigned_technician: null, assigned_engineer: null });
    expect(assignmentPayload({ id: 4, role: "ingeniero" } as any)).toEqual({ assigned_technician: null, assigned_engineer: 4 });
    expect(assignmentPayload({ id: 5, role: "tecnico" } as any)).toEqual({ assigned_technician: 5, assigned_engineer: null });
  });
});

describe("downloadEquipmentInventory", () => {
  const originalCreate = (URL as any).createObjectURL;
  const originalRevoke = (URL as any).revokeObjectURL;
  afterEach(() => {
    (URL as any).createObjectURL = originalCreate;
    (URL as any).revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });

  async function run(rows: any[]) {
    let blob: Blob | undefined;
    (URL as any).createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return "blob:x";
    });
    (URL as any).revokeObjectURL = vi.fn();
    let name = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download;
    });
    downloadEquipmentInventory(rows);
    const text = new TextDecoder().decode(new Uint8Array(await blob!.arrayBuffer()));
    return { name, text, blob: blob! };
  }

  it("genera un xlsx con una fila y nombre basado en la placa", async () => {
    const { name, text, blob } = await run([
      {
        name: "Monitor <A> & \"B\"",
        asset_tag: "AB 1/2",
        risk_class: "I",
        risk_class_display: null,
        status: "ACTIVE",
        status_display: "Activo",
        equipment_cost: 10,
        observations: null,
      },
    ]);
    expect(name).toBe("inventario-AB_1_2.xlsx");
    expect(blob.type).toContain("spreadsheetml.sheet");
    expect(text).toContain("PK");
    expect(text).toContain("Monitor &lt;A&gt; &amp; &quot;B&quot;");
    expect(text).toContain("Inventario equipos");
    expect(text).toContain("Activo");
  });

  it("usa nombre genérico con varias filas y nombra columnas más allá de Z", async () => {
    const { name, text } = await run([
      { asset_tag: "A", name: "x", risk_class: "I", status: "ACTIVE" },
      { asset_tag: "B", name: "y", risk_class: "IIA", risk_class_display: "Clase IIA", status: "INACTIVE" },
    ]);
    expect(name).toBe("inventario-equipos.xlsx");
    expect(text).toContain('r="AA1"');
    expect(text).toContain("Clase IIA");
  });
});
