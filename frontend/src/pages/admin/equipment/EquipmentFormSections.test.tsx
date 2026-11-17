import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { empty } from "@/utils/equipment.utils";
import { EquipmentAcquisitionSection } from "./EquipmentAcquisitionSection";
import { EquipmentCalibrationSection } from "./EquipmentCalibrationSection";
import { EquipmentClassificationSection } from "./EquipmentClassificationSection";
import { EquipmentElectricalSection } from "./EquipmentElectricalSection";
import { EquipmentIdentificationSection } from "./EquipmentIdentificationSection";
import { EquipmentLifeSection } from "./EquipmentLifeSection";
import { EquipmentLocationSection } from "./EquipmentLocationSection";
import { EquipmentMaintenanceSection } from "./EquipmentMaintenanceSection";
import { EquipmentObservationsSection } from "./EquipmentObservationsSection";
import { EquipmentRegulatorySection } from "./EquipmentRegulatorySection";
import { EquipmentWarrantySection } from "./EquipmentWarrantySection";

describe("equipment form sections", () => {
  it("edits identification fields", () => {
    const setForm = vi.fn();
    render(
      <EquipmentIdentificationSection form={empty} setForm={setForm} />,
    );

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Monitor" },
    });
    expect(setForm).toHaveBeenLastCalledWith({ ...empty, name: "Monitor" });
    fireEvent.change(screen.getByLabelText("Asset tag"), {
      target: { value: "EQ-1" },
    });
    expect(setForm).toHaveBeenLastCalledWith({ ...empty, asset_tag: "EQ-1" });
    fireEvent.change(screen.getByLabelText("Código N.T."), {
      target: { value: "NT-1" },
    });
    expect(setForm).toHaveBeenLastCalledWith({ ...empty, internal_code: "NT-1" });
    fireEvent.change(screen.getByLabelText("Serie"), {
      target: { value: "SN-1" },
    });
    expect(setForm).toHaveBeenLastCalledWith({ ...empty, serial: "SN-1" });
    fireEvent.change(screen.getByLabelText("Identificador Software"), {
      target: { value: "SW-1" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      software_identifier: "SW-1",
    });
  });

  it("edits acquisition dates, supplier, and cost", () => {
    const setForm = vi.fn();
    render(<EquipmentAcquisitionSection form={empty} setForm={setForm} />);

    fireEvent.change(screen.getByLabelText("Fecha de compra"), {
      target: { value: "2026-01-01" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      purchase_date: "2026-01-01",
    });
    fireEvent.change(screen.getByLabelText("Fecha de fabricación"), {
      target: { value: "2025-01-01" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      manufacture_date: "2025-01-01",
    });
    fireEvent.change(screen.getByLabelText("Fecha inicio funcionamiento"), {
      target: { value: "2025-02-01" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      start_use_date: "2025-02-01",
    });
    fireEvent.change(screen.getByLabelText("Proveedor de adquisición"), {
      target: { value: "Proveedor" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      supplier_acquisition: "Proveedor",
    });
    fireEvent.change(screen.getByLabelText("Costo del equipo"), {
      target: { value: "1200.50" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      equipment_cost: "1200.50",
    });
  });

  it("edits warranty dates", () => {
    const setForm = vi.fn();
    render(<EquipmentWarrantySection form={empty} setForm={setForm} />);
    fireEvent.change(screen.getByLabelText("Inicio de garantía"), {
      target: { value: "2026-01-01" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      warranty_start_date: "2026-01-01",
    });
    fireEvent.change(screen.getByLabelText("Finalización de garantía"), {
      target: { value: "2027-01-01" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      warranty_end_date: "2027-01-01",
    });
  });

  it("edits maintenance provider, frequency, and dates", () => {
    const setForm = vi.fn();
    render(<EquipmentMaintenanceSection form={empty} setForm={setForm} />);
    fireEvent.change(screen.getByLabelText("Proveedor de mantenimiento"), {
      target: { value: "Servicio técnico" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      maintenance_provider: "Servicio técnico",
    });
    fireEvent.change(
      screen.getByLabelText("Frecuencia de mantenimiento (meses)"),
      { target: { value: "6" } },
    );
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      maintenance_frequency_months: "6",
    });
    fireEvent.change(screen.getByLabelText("Último preventivo"), {
      target: { value: "2026-01-01" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      last_preventive: "2026-01-01",
    });
    fireEvent.change(screen.getByLabelText("Próximo preventivo"), {
      target: { value: "2026-07-01" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      next_preventive: "2026-07-01",
    });
  });

  it("edits calibration frequency and dates", () => {
    const setForm = vi.fn();
    render(<EquipmentCalibrationSection form={empty} setForm={setForm} />);
    fireEvent.change(screen.getByLabelText("Frecuencia de calibración (meses)"), {
      target: { value: "12" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      calibration_frequency_months: "12",
    });
    fireEvent.change(screen.getByLabelText("Última calibración"), {
      target: { value: "2026-02-01" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      last_calibration: "2026-02-01",
    });
    fireEvent.change(screen.getByLabelText("Próxima Calibración"), {
      target: { value: "2027-02-01" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      next_calibration: "2027-02-01",
    });
  });

  it("edits electrical-safety fields", () => {
    const setForm = vi.fn();
    render(<EquipmentElectricalSection form={empty} setForm={setForm} />);
    fireEvent.change(screen.getByLabelText("Clase de seguridad eléctrica"), {
      target: { value: "I" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      electrical_safety_class: "I",
    });
    fireEvent.change(screen.getByLabelText("Tipo de seguridad eléctrica"), {
      target: { value: "CF" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      electrical_safety_type: "CF",
    });
  });

  it("edits regulatory information and observations", () => {
    const setForm = vi.fn();
    const { rerender } = render(
      <EquipmentRegulatorySection form={empty} setForm={setForm} />,
    );
    fireEvent.change(screen.getByLabelText("Registro INVIMA"), {
      target: { value: "INV-100" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      invima_registration: "INV-100",
    });
    fireEvent.change(screen.getByLabelText("ECRI"), {
      target: { value: "ECRI-1" },
    });
    expect(setForm).toHaveBeenLastCalledWith({ ...empty, ecri: "ECRI-1" });

    rerender(<EquipmentObservationsSection form={empty} setForm={setForm} />);
    fireEvent.change(
      screen.getByPlaceholderText("Observaciones adicionales del equipo..."),
      { target: { value: "Requiere revisión" } },
    );
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      observations: "Requiere revisión",
    });
  });

  it("edits expected life and equipment status", () => {
    const setForm = vi.fn();
    render(<EquipmentLifeSection form={empty} setForm={setForm} />);
    fireEvent.change(screen.getByLabelText("Vida útil (años)"), {
      target: { value: "8" },
    });
    expect(setForm).toHaveBeenLastCalledWith({ ...empty, life_use_years: "8" });
    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "IN_REPAIR" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      status: "IN_REPAIR",
    });
  });

  it("preserves legacy providers and allows choosing a catalog provider", async () => {
    const user = userEvent.setup();
    const setForm = vi.fn();
    const legacy = { ...empty, owner: "Proveedor antiguo" };
    const { rerender } = render(
      <EquipmentLocationSection form={legacy} setForm={setForm} />,
    );

    const provider = screen.getByRole("combobox", { name: "Proveedor" });
    expect(provider).toHaveValue("Proveedor antiguo");
    rerender(<EquipmentLocationSection form={empty} setForm={setForm} />);
    const emptyProvider = screen.getByRole("combobox", { name: "Proveedor" });
    await user.click(emptyProvider);
    await user.click(screen.getByRole("option", { name: "SIEMENS" }));
    expect(setForm).toHaveBeenLastCalledWith({ ...empty, owner: "SIEMENS" });

    fireEvent.change(screen.getByLabelText("Código de calibración"), {
      target: { value: "CAL-1" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      calibration_date: "CAL-1",
    });
    fireEvent.change(screen.getByLabelText("Fabricante"), {
      target: { value: "Fabricante" },
    });
    expect(setForm).toHaveBeenLastCalledWith({ ...empty, manufacturer: "Fabricante" });
    fireEvent.change(screen.getByLabelText("Cliente"), {
      target: { value: "Clínica" },
    });
    expect(setForm).toHaveBeenLastCalledWith({ ...empty, client_name: "Clínica" });
    fireEvent.change(screen.getByLabelText("Marca/texto"), {
      target: { value: "Texto adicional" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...empty,
      branch_text: "Texto adicional",
    });
    fireEvent.change(screen.getByLabelText("Departamento"), {
      target: { value: "Antioquia" },
    });
    expect(setForm).toHaveBeenLastCalledWith({ ...empty, department: "Antioquia" });
    fireEvent.change(screen.getByLabelText("Ciudad"), {
      target: { value: "Medellín" },
    });
    expect(setForm).toHaveBeenLastCalledWith({ ...empty, city: "Medellín" });
    fireEvent.change(screen.getByLabelText("Área"), {
      target: { value: "UCI" },
    });
    expect(setForm).toHaveBeenLastCalledWith({ ...empty, area: "UCI" });
    fireEvent.change(screen.getByLabelText("Ubicación"), {
      target: { value: "Piso 2" },
    });
    expect(setForm).toHaveBeenLastCalledWith({ ...empty, location: "Piso 2" });
  });

  it("updates classification and catalog selections", async () => {
    const user = userEvent.setup();
    const setForm = vi.fn();
    const form = { ...empty, brand: 1 };
    render(
      <EquipmentClassificationSection
        form={form}
        setForm={setForm}
        branchOptions={[{ value: "1", label: "Sede Norte" }]}
        brands={[{ id: 1, name: "Biomed", is_active: true }]}
        brandOptions={[
          { value: "1", label: "Biomed" },
          { value: "__new_brand__", label: "Crear marca" },
        ]}
        models={[
          { id: 3, brand: 1, name: "Modelo 3", is_active: true },
          { id: 4, brand: 1, name: "Modelo 4", is_active: false },
        ]}
        modelsForForm={[
          { id: 3, brand: 1, name: "Modelo 3", is_active: true },
        ]}
        modelOptionsForm={[
          { value: "3", label: "Modelo 3" },
          { value: "__new_model__", label: "Crear modelo" },
        ]}
        openCatalogForm={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Sede"), {
      target: { value: "1" },
    });
    expect(setForm).toHaveBeenLastCalledWith({ ...form, branch: 1 });
    await user.click(screen.getByRole("combobox", { name: "Marca" }));
    await user.click(screen.getByRole("option", { name: "Biomed" }));
    expect(setForm).toHaveBeenLastCalledWith({
      ...form,
      brand: 1,
      equipment_model: 3,
    });

    await user.click(screen.getByRole("combobox", { name: "Modelo" }));
    await user.click(screen.getByRole("option", { name: "Modelo 3" }));
    expect(setForm).toHaveBeenLastCalledWith({ ...form, equipment_model: 3 });
    await user.click(screen.getByRole("combobox", { name: "Tipo de tecnología" }));
    await user.click(screen.getByRole("option", { name: "Electrónico" }));
    expect(setForm).toHaveBeenLastCalledWith({
      ...form,
      technology_type: "ELECTRONIC",
    });
    fireEvent.change(screen.getByLabelText("Clasificación biomédica"), {
      target: { value: "Clase II" },
    });
    expect(setForm).toHaveBeenLastCalledWith({
      ...form,
      biomedical_classification: "Clase II",
    });
    const riskInput = screen.getByRole("combobox", { name: "Clase de riesgo" });
    await user.clear(riskInput);
    await user.click(riskInput);
    await user.click(
      screen.getByRole("option", { name: "Clase IIA · Riesgo moderado" }),
    );
    expect(setForm).toHaveBeenLastCalledWith({ ...form, risk_class: "IIA" });
  });

  it("explains when the catalog is empty or the selected brand has no models", () => {
    const props = {
      setForm: vi.fn(),
      branchOptions: [],
      brands: [],
      brandOptions: [],
      models: [],
      modelsForForm: [],
      modelOptionsForm: [],
      openCatalogForm: vi.fn(),
    };
    const { rerender } = render(
      <EquipmentClassificationSection form={empty} {...props} />,
    );

    expect(screen.getByText("Crea una marca primero en Catálogo.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Modelo" })).toHaveAttribute(
      "placeholder",
      "Selecciona una marca primero",
    );

    rerender(
      <EquipmentClassificationSection
        form={{ ...empty, brand: 1 }}
        {...props}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Modelo" })).toHaveAttribute(
      "placeholder",
      "No hay modelos para esta marca",
    );
  });
});
