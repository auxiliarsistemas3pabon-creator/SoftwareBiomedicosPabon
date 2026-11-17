import { afterEach, describe, expect, it, vi } from "vitest";

import { PAGE_SIZE as CATALOG_PAGE } from "./catalog.utils";
import {
  MonthLabel,
  buildAdministratorChartData,
  buildCoordinatorChartData,
  dateKey,
  formatCost,
  formatHours as dashFormatHours,
  formatWeekday,
  grainKey,
  grainLabel,
  inDateRange,
  KIND_COLOR,
  SEVERITY_LABEL,
  STATUS_COLOR,
  STATUS_LABEL as DASH_STATUS_LABEL,
} from "./dashboard.utils";
import {
  equipmentToForm,
  formToPayload,
} from "./equipment.form.utils";
import { downloadTextFile, startsWithLetter, uniqueNames } from "./equipment.names.utils";
import * as equipmentUtils from "./equipment.utils";
import * as failureUtils from "./failure.utils";
import {
  KIND_LABEL as FICHA_KIND,
  KIND_TONE as FICHA_TONE,
  STATUS_LABEL as FICHA_STATUS,
  STATUS_TONE as FICHA_STATUS_TONE,
  formatHours,
  kindLabelScheduled,
  kindToneScheduled,
} from "./ficha.utils";
import { labelForTechnician } from "./maintenance.utils";
import * as maintenanceUtils from "./maintenance.utils";
import {
  formatDateTime as schedFormat,
  labelForRequester,
  labelForScheduleTechnician,
  scheduleEstado,
  today as schedToday,
} from "./scheduling.utils";
import * as schedulingUtils from "./scheduling.utils";
import * as userUtils from "./user.utils";
import * as workorderUtils from "./workorder.utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

describe("constantes de utilidades", () => {
  it("expone tamaños de página y formularios vacíos", () => {
    expect(CATALOG_PAGE).toBe(6);
    expect(failureUtils.PAGE_SIZE).toBe(6);
    expect(failureUtils.empty.severity).toBe("MEDIUM");
    expect(maintenanceUtils.PAGE_SIZE).toBe(20);
    expect(maintenanceUtils.empty.kind).toBe("PREVENTIVE");
    expect(maintenanceUtils.TECHNICIAN_ROLES).toEqual(["tecnico", "ingeniero"]);
    expect(maintenanceUtils.KIND_LABEL.REPAIR).toBe("Reparación");
    expect(maintenanceUtils.KIND_TONE.CALIBRATION).toBe("primary");
    expect(userUtils.PAGE_SIZE).toBe(20);
    expect(userUtils.empty.role).toBe("tecnico");
    expect(schedulingUtils.PAGE_SIZE).toBe(6);
    expect(schedulingUtils.empty.kind).toBe("PREVENTIVE");
    expect(schedulingUtils.KIND_LABEL.PREVENTIVE).toBe("Preventivo");
    expect(schedulingUtils.TECHNICIAN_ROLES).toContain("ingeniero");
    expect(workorderUtils.PAGE_SIZE).toBe(6);
    expect(workorderUtils.emptyForm.status).toBe("PENDING");
    expect(workorderUtils.TYPE_LABEL.INSTALLATION).toBe("Instalación");
    expect(workorderUtils.STATUS_LABEL.FINISHED).toBe("Terminada");
    expect(workorderUtils.STATUS_TONE.CANCELLED).toBe("danger");
    expect(workorderUtils.FAIL_SEV_LABEL.CRITICAL).toBe("Crítica");
    expect(workorderUtils.EVIDENCE_LABEL.PHOTO).toBe("Fotografía");
    expect(workorderUtils.SIGNATURE_LABEL.CLIENT).toBe("Cliente");
    expect(failureUtils.SEV_LABEL.LOW).toBe("Baja");
    expect(Object.values(failureUtils.SEV_TONE).every((t) => t === "danger")).toBe(true);
    expect(equipmentUtils.PAGE_SIZE).toBe(10);
    expect(equipmentUtils.STATUS_LABEL.IN_REPAIR).toBe("En reparación");
    expect(equipmentUtils.STATUS_TONE.ACTIVE).toBe("success");
    expect(equipmentUtils.RISK_LABEL.III).toContain("alto");
    expect(equipmentUtils.RISK_TONE.IIB).toBe("warning");
    expect(equipmentUtils.OWNER_OPTIONS[0]).toEqual({ value: "Impormesan", label: "Impormesan" });
    expect(equipmentUtils.empty.status).toBe("ACTIVE");
    expect(equipmentUtils.STATUS_BADGE_CLASS.INACTIVE).toContain("border-app");
    expect(equipmentUtils.NEW_BRAND_VALUE).toBe("__new_brand__");
    expect(equipmentUtils.NEW_MODEL_VALUE).toBe("__new_model__");
    expect(FICHA_STATUS.IN_MAINTENANCE).toBe("En mantenimiento");
    expect(FICHA_STATUS_TONE.INACTIVE).toBe("neutral");
    expect(FICHA_KIND.INSPECTION).toBe("Inspección");
    expect(FICHA_TONE.PREVENTIVE).toBe("info");
  });

  it("fechas de hoy tienen el formato esperado", () => {
    expect(schedToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(workorderUtils.today()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe("equipment.names.utils", () => {
  it("startsWithLetter ignora tildes y mayúsculas", () => {
    expect(startsWithLetter("  Ángel", "a")).toBe(true);
    expect(startsWithLetter("Bomba", "a")).toBe(false);
  });

  it("uniqueNames deduplica, recorta y ordena en español", () => {
    expect(uniqueNames([{ name: "b " }, { name: "a" }, { name: "b" }, { name: "ñ" }])).toEqual([
      "a",
      "b",
      "ñ",
    ]);
  });

  it("downloadTextFile crea un enlace temporal y lo libera", () => {
    const create = vi.fn(() => "blob:x");
    const revoke = vi.fn();
    (URL as any).createObjectURL = create;
    (URL as any).revokeObjectURL = revoke;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadTextFile("a.txt", ["l1", "l2"]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:x");
    click.mockRestore();
  });
});

describe("ficha.utils", () => {
  it("formatHours cubre minutos, horas y días", () => {
    expect(formatHours(null)).toBe("Sin datos");
    expect(formatHours(undefined)).toBe("Sin datos");
    expect(formatHours("")).toBe("Sin datos");
    expect(formatHours("abc")).toBe("Sin datos");
    expect(formatHours("-1")).toBe("Sin datos");
    expect(formatHours("0.5")).toBe("30 min");
    expect(formatHours("5")).toBe("5.0 h");
    expect(formatHours("48")).toBe("2 d");
    expect(formatHours("50")).toBe("2 d 2 h");
  });

  it("etiquetas y tonos de mantenimientos programados", () => {
    expect(kindLabelScheduled("PREVENTIVE")).toBe("Preventivo");
    expect(kindLabelScheduled("REPAIR")).toBe("Reparación");
    expect(kindToneScheduled("PREVENTIVE")).toBe("info");
    expect(kindToneScheduled("REPAIR")).toBe("danger");
  });
});

describe("maintenance.utils.labelForTechnician", () => {
  it("prioriza técnico, luego ingeniero, luego texto libre, luego guion", () => {
    expect(
      labelForTechnician({ assigned_technician_detail: { full_name: "David Pérez" } } as any),
    ).toBe("David");
    expect(
      labelForTechnician({ assigned_engineer_detail: { username: "ing" } } as any),
    ).toBe("ing");
    expect(labelForTechnician({ technician: "  Luis Gómez " } as any)).toBe("Luis");
    expect(labelForTechnician({ technician: "" } as any)).toBe("—");
    expect(labelForTechnician({} as any)).toBe("—");
  });
});

describe("scheduling.utils", () => {
  it("scheduleEstado", () => {
    expect(scheduleEstado({ is_completed: true } as any).label).toBe("Cumplida");
    expect(scheduleEstado({ work_order: { status: "FINISHED" } } as any).tone).toBe("success");
    expect(scheduleEstado({ work_order: { status: "IN_PROGRESS" } } as any)).toEqual({
      label: "En proceso",
      tone: "info",
    });
    expect(scheduleEstado({} as any)).toEqual({ label: "Pendiente", tone: "warning" });
  });

  it("formatDateTime", () => {
    expect(schedFormat(null)).toBe("—");
    expect(schedFormat(undefined)).toBe("—");
    expect(schedFormat("no-fecha")).toBe("no-fecha");
    expect(schedFormat("2026-01-02T03:04:05Z")).toBe(new Date("2026-01-02T03:04:05Z").toLocaleString());
    expect(workorderUtils.formatDateTime(null)).toBe("—");
    expect(workorderUtils.formatDateTime("zzz")).toBe("zzz");
    expect(workorderUtils.formatDateTime("2026-01-02T03:04:05Z")).toBe(
      new Date("2026-01-02T03:04:05Z").toLocaleString(),
    );
  });

  it("etiquetas de responsable y solicitante", () => {
    expect(labelForScheduleTechnician({ assigned_technician_detail: { username: "t" } } as any)).toBe("t");
    expect(labelForScheduleTechnician({ assigned_engineer_detail: { username: "e", full_name: "Ing Uno" } } as any)).toBe("Ing Uno");
    expect(labelForScheduleTechnician({} as any)).toBeNull();
    expect(labelForRequester({ requested_by_detail: { full_name: "Ana", username: "a" } } as any)).toBe("Ana");
    expect(labelForRequester({ requested_by_detail: { full_name: "", username: "a" } } as any)).toBe("a");
    expect(labelForRequester({} as any)).toBeNull();
  });
});

describe("dashboard.utils", () => {
  it("catálogos de etiquetas/colores", () => {
    expect(DASH_STATUS_LABEL.ACTIVE).toBe("Operativo");
    expect(STATUS_COLOR.INACTIVE).toBe("#94a3b8");
    expect(SEVERITY_LABEL.HIGH).toBe("Alta");
    expect(KIND_COLOR.REPAIR).toBe("#ef4444");
  });

  it("formatCost", () => {
    expect(formatCost("abc")).toBe("—");
    expect(formatCost(1500)).toContain("1.500");
    expect(formatCost("2000")).toContain("2.000");
  });

  it("formatHours del dashboard", () => {
    expect(dashFormatHours(null)).toBe("Sin datos");
    expect(dashFormatHours("")).toBe("Sin datos");
    expect(dashFormatHours("x")).toBe("Sin datos");
    expect(dashFormatHours(-3)).toBe("Sin datos");
    expect(dashFormatHours(2)).toBe("2.0 h");
    expect(dashFormatHours(24)).toBe("1 d");
    expect(dashFormatHours("26")).toBe("1 d 2 h");
  });

  it("formatWeekday", () => {
    expect(formatWeekday("2026-05-04")).toMatch(/4/);
    expect(formatWeekday("xx")).toBe("xx");
  });

  it("dateKey / inDateRange / grainKey", () => {
    expect(dateKey("2026-05-04T10:00:00Z")).toBe("2026-05-04");
    expect(inDateRange("2026-05-04", "2026-05-05", "")).toBe(false);
    expect(inDateRange("2026-05-04", "", "2026-05-03")).toBe(false);
    expect(inDateRange("2026-05-04", "2026-05-01", "2026-05-31")).toBe(true);
    expect(inDateRange("2026-05-04", "", "")).toBe(true);
    expect(grainKey("2026-05-04", "year")).toBe("2026");
    expect(grainKey("2026-05-04", "month")).toBe("2026-05");
    expect(grainKey("2026-05-04", "day")).toBe("2026-05-04");
  });

  it("grainLabel / MonthLabel", () => {
    expect(grainLabel("2026", "year")).toBe("2026");
    expect(grainLabel("2026-05", "month")).toMatch(/26/);
    expect(grainLabel("xx", "month")).toBe("xx");
    expect(grainLabel("2026-05-04", "day")).toMatch(/4/);
    expect(grainLabel("zz", "day")).toBe("zz");
    expect(MonthLabel({ month: "2026-05" })).toMatch(/26/);
    expect(MonthLabel({ month: "bad" })).toBe("bad");
  });

  describe.each([
    ["coordinador", buildCoordinatorChartData],
    ["administrador", buildAdministratorChartData],
  ])("build%sChartData", (_n, build: any) => {
    const series = [
      { date: "2026-05-01", kind: "PREVENTIVE" },
      { date: "2026-05-01", kind: "repair" },
      { date: "2026-05-02", kind: undefined },
      { date: "2025-01-01", kind: "REPAIR" },
    ];
    const costs = [
      { date: "2026-05-01", cost: "1000" },
      { date: "2026-05-02", cost: "abc" },
      { date: "2025-01-01", cost: "5" },
    ];

    it("agrupa por día rellenando el rango", () => {
      const rows = build(series, costs, "2026-05-01", "2026-05-03", "day");
      expect(rows.map((r: any) => r.key)).toEqual(["2026-05-01", "2026-05-02", "2026-05-03"]);
      expect(rows[0]).toMatchObject({ Preventivo: 1, Reparación: 1, costo: 1000 });
      expect(rows[1]).toMatchObject({ Preventivo: 1, costo: 0 });
    });

    it("invierte un rango desordenado", () => {
      const rows = build(series, costs, "2026-05-03", "2026-05-01", "day");
      expect(rows).toHaveLength(3);
    });

    it("agrupa por mes y por año", () => {
      const m = build(series, costs, "2025-01-01", "2026-05-31", "month");
      expect(m[0].key).toBe("2025-01");
      expect(m).toHaveLength(17);
      const y = build(series, costs, "2025-01-01", "2026-12-31", "year");
      expect(y.map((r: any) => r.key)).toEqual(["2025", "2026"]);
      expect(y[1].costo).toBe(1000);
    });

    it("sin rango solo crea buckets con datos", () => {
      const rows = build(series, costs, "", "", "year");
      expect(rows.map((r: any) => r.key)).toEqual(["2025", "2026"]);
    });

    it("filtra días vacíos cuando el rango diario supera 45 días", () => {
      const rows = build(
        [{ date: "2026-01-10", kind: "REPAIR" }],
        [],
        "2026-01-01",
        "2026-03-31",
        "day",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].Reparación).toBe(1);
    });

    it("rango invertido con from/to vacío usa hoy", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 4, 3, 12));
      const rows = build([], [], "2026-05-01", "", "day");
      expect(rows).toEqual([]);
      vi.useRealTimers();
    });
  });

  it("periodKeys con inicio posterior al fin devuelve vacío (vía builder)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12));
    // from vacío pero to presente => range = {from:"", to}, no se generan buckets
    expect(buildCoordinatorChartData([], [], "", "2026-05-01", "day")).toEqual([]);
    vi.useRealTimers();
  });
});

describe("equipment.form.utils", () => {
  const full: any = {
    name: "Monitor",
    asset_tag: "A1",
    internal_code: "I1",
    serial: "S1",
    software_identifier: "SW",
    brand: 0,
    equipment_model: 4,
    branch: 2,
    branch_text: "Sede",
    department: "Dpto",
    city: "Cali",
    area: "UCI",
    location: "Piso 2",
    technology_type: "Tec",
    biomedical_classification: "Diag",
    risk_class: "IIA",
    manufacturer: "M",
    owner: "O",
    client_name: "C",
    purchase_date: "2024-01-02T00:00:00Z",
    manufacture_date: "2023-01-02",
    supplier_acquisition: "Prov",
    start_use_date: "2024-02-02",
    equipment_cost: 1234,
    warranty_start_date: "2024-01-01",
    warranty_end_date: "2026-01-01",
    maintenance_provider: "MP",
    maintenance_frequency_months: 6,
    last_preventive: "2025-01-01",
    next_preventive: "2025-07-01",
    calibration_date: "2025-02-01",
    calibration_frequency_months: 12,
    last_calibration: "2025-02-01",
    next_calibration: "2026-02-01",
    electrical_safety_class: "I",
    electrical_safety_type: "B",
    invima_registration: "INV",
    ecri: "ECRI",
    life_use_years: 10,
    status: "ACTIVE",
    observations: "obs",
  };

  it("equipmentToForm convierte números a string y recorta fechas", () => {
    const f = equipmentToForm(full, 77);
    expect(f.brand).toBe(77);
    expect(f.purchase_date).toBe("2024-01-02");
    expect(f.equipment_cost).toBe("1234");
    expect(f.maintenance_frequency_months).toBe("6");
    expect(f.calibration_frequency_months).toBe("12");
    expect(f.life_use_years).toBe("10");
    expect(equipmentToForm({ ...full, brand: 3 }, 77).brand).toBe(3);
  });

  it("equipmentToForm tolera nulos", () => {
    const f = equipmentToForm(
      {
        equipment_model: 1,
        branch: 1,
        risk_class: "I",
        status: "ACTIVE",
        equipment_cost: null,
        maintenance_frequency_months: null,
        calibration_frequency_months: null,
        life_use_years: null,
        purchase_date: null,
      } as any,
      9,
    );
    expect(f.name).toBe("");
    expect(f.equipment_cost).toBe("");
    expect(f.maintenance_frequency_months).toBe("");
    expect(f.calibration_frequency_months).toBe("");
    expect(f.life_use_years).toBe("");
    expect(f.purchase_date).toBe("");
  });

  it("formToPayload convierte cadenas vacías en undefined y números", () => {
    const p = formToPayload(equipmentToForm(full, 1));
    expect(p.maintenance_frequency_months).toBe(6);
    expect(p.calibration_frequency_months).toBe(12);
    expect(p.life_use_years).toBe(10);
    expect(p.warranty_start_date).toBe("2024-01-01");

    const empty = formToPayload({ ...equipmentUtils.empty, technology_type: "  ", risk_class: "" as any });
    expect(empty.technology_type).toBeUndefined();
    expect(empty.risk_class).toBeUndefined();
    expect(empty.purchase_date).toBeUndefined();
    expect(empty.maintenance_frequency_months).toBeUndefined();
    expect(empty.calibration_frequency_months).toBeUndefined();
    expect(empty.life_use_years).toBeUndefined();
    expect(empty.warranty_start_date).toBeUndefined();
    expect(empty.warranty_end_date).toBeUndefined();
  });
});

afterEach(() => {
  vi.useRealTimers();
});
