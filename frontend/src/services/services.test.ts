import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post, patch, del } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: { get, post, patch, delete: del } }));

import { authService } from "./auth.service";
import { branchesService } from "./branches.service";
import { brandsService } from "./brands.service";
import { dashboardService } from "./dashboard.service";
import { equipmentService } from "./equipment.service";
import { failuresService } from "./failures.service";
import { maintenanceService } from "./maintenance.service";
import { modelsService } from "./models.service";
import { schedulingService } from "./scheduling.service";
import { usersService } from "./users.service";
import { workOrdersService } from "./workorders.service";

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  del.mockReset();
});

/* eslint-disable @typescript-eslint/no-explicit-any */
// [nombre, servicio, ruta base, tiene listAll, tiene retrieve]
const crudServices: [string, any, string, boolean, boolean][] = [
  ["branches", branchesService, "/branches/", true, true],
  ["brands", brandsService, "/catalog/brands/", true, true],
  ["models", modelsService, "/catalog/equipment-models/", true, true],
  ["users", usersService, "/users/", true, true],
  ["equipment", equipmentService, "/equipment/", true, true],
  ["failures", failuresService, "/failures/", false, true],
  ["maintenance", maintenanceService, "/maintenance/records/", true, true],
  ["scheduling", schedulingService, "/scheduling/maintenances/", false, true],
  ["workorders", workOrdersService, "/equipment/work-orders/", true, false],
];

describe.each(crudServices)("%s service", (_n, svc, base, hasAll, hasRetrieve) => {
  const page = { count: 2, next: null, previous: null, results: [{ id: 1 }, { id: 2 }] };

  it("list desenvuelve resultados paginados", async () => {
    get.mockResolvedValue({ data: page });
    expect(await svc.list({ search: "x" })).toEqual(page.results);
    expect(get).toHaveBeenCalledWith(base, { params: { search: "x" } });
  });

  it("list acepta respuesta sin paginar (array)", async () => {
    get.mockResolvedValue({ data: [{ id: 9 }] });
    expect(await svc.list()).toEqual([{ id: 9 }]);
  });

  it("listPaginated devuelve el bloque paginado tal cual", async () => {
    get.mockResolvedValue({ data: page });
    expect(await svc.listPaginated()).toBe(page);
  });

  it("listPaginated simula un bloque unico si el backend devuelve array", async () => {
    get.mockResolvedValue({ data: [{ id: 1 }] });
    expect(await svc.listPaginated()).toEqual({
      count: 1,
      next: null,
      previous: null,
      results: [{ id: 1 }],
    });
  });

  if (hasAll) {
    it("listAll recorre todas las paginas", async () => {
      get
        .mockResolvedValueOnce({ data: { results: [{ id: 1 }], next: "p2" } })
        .mockResolvedValueOnce({ data: { results: [{ id: 2 }], next: null } });
      expect(await svc.listAll({})).toEqual([{ id: 1 }, { id: 2 }]);
      expect(get).toHaveBeenCalledTimes(2);
      expect(get.mock.calls[1][1]).toEqual({ params: { page: 2 } });
    });

    it("listAll devuelve el array directo si no hay paginacion", async () => {
      get.mockResolvedValue({ data: [{ id: 7 }] });
      expect(await svc.listAll()).toEqual([{ id: 7 }]);
      expect(get).toHaveBeenCalledTimes(1);
    });
  }

  if (hasRetrieve) {
    it("retrieve consulta el detalle", async () => {
      get.mockResolvedValue({ data: { id: 5 } });
      expect(await svc.retrieve(5)).toEqual({ id: 5 });
      expect(get).toHaveBeenCalledWith(`${base}5/`);
    });
  }

  it("create hace POST y retorna el recurso", async () => {
    post.mockResolvedValue({ data: { id: 1 } });
    expect(await svc.create({ a: 1 })).toEqual({ id: 1 });
    expect(post).toHaveBeenCalledWith(base, { a: 1 });
  });

  it("update hace PATCH", async () => {
    patch.mockResolvedValue({ data: { id: 3 } });
    expect(await svc.update(3, { a: 2 })).toEqual({ id: 3 });
    expect(patch).toHaveBeenCalledWith(`${base}3/`, { a: 2 });
  });

  it("remove hace DELETE", async () => {
    del.mockResolvedValue({});
    await svc.remove(4);
    expect(del).toHaveBeenCalledWith(`${base}4/`);
  });
});

describe("authService", () => {
  it("login envia credenciales", async () => {
    post.mockResolvedValue({});
    await authService.login({ username: "a", password: "b" } as never);
    expect(post).toHaveBeenCalledWith("/auth/token/cookie/", { username: "a", password: "b" });
  });
  it("me retorna el usuario", async () => {
    get.mockResolvedValue({ data: { id: 1 } });
    expect(await authService.me()).toEqual({ id: 1 });
  });
  it("logout ignora errores de red", async () => {
    post.mockRejectedValue(new Error("x"));
    await expect(authService.logout()).resolves.toBeUndefined();
  });
});

describe("dashboardService", () => {
  it("summary", async () => {
    get.mockResolvedValue({ data: { total: 3 } });
    expect(await dashboardService.summary()).toEqual({ total: 3 });
    expect(get).toHaveBeenCalledWith("/dashboard/summary/");
  });
});

describe("equipmentService (especificos)", () => {
  it("byAssetTag codifica la placa", async () => {
    get.mockResolvedValue({ data: { id: 1 } });
    await equipmentService.byAssetTag("A/B 1");
    expect(get).toHaveBeenCalledWith("/equipment/by-asset-tag/A%2FB%201/");
  });
  it("regenerateQr", async () => {
    post.mockResolvedValue({ data: { id: 1 } });
    expect(await equipmentService.regenerateQr(1)).toEqual({ id: 1 });
    expect(post).toHaveBeenCalledWith("/equipment/1/regenerate-qr/");
  });
  it("updateImage envia FormData multipart", async () => {
    patch.mockResolvedValue({ data: { id: 1 } });
    const file = new File(["x"], "a.png", { type: "image/png" });
    await equipmentService.updateImage(1, file);
    const [url, fd, cfg] = patch.mock.calls[0];
    expect(url).toBe("/equipment/1/");
    expect((fd as FormData).get("equipment_image")).toBeInstanceOf(File);
    expect(cfg.headers["Content-Type"]).toBe("multipart/form-data");
  });
  it("regenerateQrAll con y sin missing", async () => {
    post.mockResolvedValue({ data: { regenerated: 2 } });
    await equipmentService.regenerateQrAll();
    expect(post).toHaveBeenLastCalledWith("/equipment/regenerate-qr-all/", null, { params: {} });
    await equipmentService.regenerateQrAll({ missing: true });
    expect(post).toHaveBeenLastCalledWith("/equipment/regenerate-qr-all/", null, {
      params: { missing: 1 },
    });
  });
  it("names", async () => {
    get.mockResolvedValue({ data: ["A"] });
    expect(await equipmentService.names({ name_startswith: "A" })).toEqual(["A"]);
    expect(await equipmentService.names()).toEqual(["A"]);
  });
});

describe("maintenanceService.createWithFile", () => {
  it("arma el FormData omitiendo null/undefined y adjunta el PDF", async () => {
    post.mockResolvedValue({ data: { id: 1 } });
    const pdf = new File(["%PDF"], "a.pdf", { type: "application/pdf" });
    await maintenanceService.createWithFile(
      { equipment: 1, notes: null, extra: undefined } as never,
      pdf,
    );
    const fd = post.mock.calls[0][1] as FormData;
    expect(fd.get("equipment")).toBe("1");
    expect(fd.has("notes")).toBe(false);
    expect(fd.has("extra")).toBe(false);
    expect(fd.get("pdf_file")).toBeInstanceOf(File);
  });
});

describe("failuresService (especificos)", () => {
  it("resolve con y sin notas", async () => {
    post.mockResolvedValue({ data: { id: 1 } });
    await failuresService.resolve(1, "ok");
    expect(post).toHaveBeenLastCalledWith("/failures/1/resolve/", { resolution_notes: "ok" });
    await failuresService.resolve(1);
    expect(post).toHaveBeenLastCalledWith("/failures/1/resolve/", {});
  });
});

describe("schedulingService (especificos)", () => {
  it("complete y notify", async () => {
    post.mockResolvedValue({ data: { id: 1 } });
    await schedulingService.complete(1);
    expect(post).toHaveBeenLastCalledWith("/scheduling/maintenances/1/complete/");
    await schedulingService.notify(1);
    expect(post).toHaveBeenLastCalledWith("/scheduling/maintenances/1/notify/");
  });
});

describe("usersService.setPassword", () => {
  it("hace POST a set_password", async () => {
    post.mockResolvedValue({ data: { detail: "ok" } });
    expect(await usersService.setPassword(2, { new_password: "x" } as never)).toEqual({
      detail: "ok",
    });
    expect(post).toHaveBeenCalledWith("/users/2/set_password/", { new_password: "x" });
  });
});

describe("workOrdersService (especificos)", () => {
  it("details y complete", async () => {
    get.mockResolvedValue({ data: { id: 1 } });
    await workOrdersService.details(1);
    expect(get).toHaveBeenCalledWith("/equipment/work-orders/1/details/");
    post.mockResolvedValue({ data: { id: 1 } });
    await workOrdersService.complete(1, { observations: "x" });
    expect(post).toHaveBeenLastCalledWith("/equipment/work-orders/1/complete/", {
      observations: "x",
    });
    await workOrdersService.complete(1);
    expect(post).toHaveBeenLastCalledWith("/equipment/work-orders/1/complete/", {});
  });

  it.each(["sparePart", "measurement", "evidence", "signature", "cost"] as const)(
    "sub-recurso %s: create/update/remove",
    async (key) => {
      const res = workOrdersService[key];
      post.mockResolvedValue({ data: { id: 1 } });
      patch.mockResolvedValue({ data: { id: 1 } });
      del.mockResolvedValue({});
      expect(await res.create({ a: 1 })).toEqual({ id: 1 });
      expect(await res.update(1, { a: 2 })).toEqual({ id: 1 });
      await res.remove(1);
      expect(del).toHaveBeenCalledTimes(1);
    },
  );
});
