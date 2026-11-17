import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WorkOrderDetail } from "@/types/equipment/workorder";
import { WorkOrderIntervention } from "./WorkOrderIntervention";

const base: WorkOrderDetail = {
  id: 1,
  equipment: 2,
  number: "OT-001",
  service_type: "PREVENTIVE",
  start_date: "2026-01-03T10:00:00Z",
  description: "Inspección",
  status: "IN_PROGRESS",
  spare_parts: [],
  measurements: [],
  evidences: [],
  signatures: [],
  cost: null,
};

describe("WorkOrderIntervention", () => {
  it("shows loading only when detail is not available", () => {
    const { rerender } = render(
      <WorkOrderIntervention woLoading woDetail={null} />,
    );
    expect(screen.getByText("Cargando intervención...")).toBeInTheDocument();

    rerender(<WorkOrderIntervention woLoading={false} woDetail={null} />);
    expect(screen.queryByText("Cargando intervención...")).not.toBeInTheDocument();
  });

  it("renders empty states for a detail without intervention records", () => {
    render(<WorkOrderIntervention woLoading={false} woDetail={base} />);

    expect(screen.getByText(/Intervención.*OT-001/)).toBeInTheDocument();
    expect(screen.getAllByText("Sin registros.")).toHaveLength(4);
    expect(screen.getByText("Sin costos registrados.")).toBeInTheDocument();
  });

  it("renders every intervention record and cost total", () => {
    render(
      <WorkOrderIntervention
        woLoading={false}
        woDetail={{
          ...base,
          spare_parts: [{
            id: 1,
            work_order: 1,
            name: "Sensor",
            reference: "S-1",
            quantity: 2,
            unit_cost: "10",
            total_cost: "20",
          }],
          measurements: [{
            id: 2,
            work_order: 1,
            parameter: "Voltaje",
            expected_value: "120",
            measured_value: "118",
            unit: "V",
            passed: false,
          }, {
            id: 7,
            work_order: 1,
            parameter: "Resistencia",
            expected_value: "10",
            measured_value: "10",
            unit: "Ω",
            passed: true,
          }],
          evidences: [{
            id: 3,
            work_order: 1,
            evidence_type: "PHOTO",
            description: "Placa",
          }],
          signatures: [
            {
              id: 4,
              work_order: 1,
              role: "TECHNICIAN",
              signed_by: "Ana",
              signed_at: "2026-01-03T10:00:00Z",
            },
            { id: 6, work_order: 1, role: "WITNESS", signed_by: "Luis" },
          ],
          cost: {
            id: 5,
            work_order: 1,
            labor_cost: "10",
            spare_parts_cost: "20",
            transport_cost: "3",
            other_cost: "2",
            total: "35",
          },
        }}
      />,
    );

    expect(screen.getByText(/Sensor.*S-1.*x2.*20/)).toBeInTheDocument();
    expect(screen.getByText(/Voltaje: 118 V/)).toHaveTextContent("No");
    expect(screen.getByText(/Resistencia: 10/)).toHaveTextContent("OK");
    expect(screen.getByText("PHOTO: Placa")).toBeInTheDocument();
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
    expect(screen.getByText(/Mano de obra \$10/)).toHaveTextContent("35");
  });

  it("handles omitted intervention collections and a missing cost total", () => {
    render(
      <WorkOrderIntervention
        woLoading={false}
        woDetail={{
          ...base,
          spare_parts: undefined,
          measurements: undefined,
          evidences: undefined,
          signatures: undefined,
          cost: {
            id: 8,
            work_order: 1,
            labor_cost: "10",
            spare_parts_cost: "0",
            transport_cost: "0",
            other_cost: "0",
            total: undefined,
          },
        }}
      />,
    );

    expect(screen.getAllByText("Sin registros.")).toHaveLength(4);
    expect(screen.getByText(/Mano de obra/)).toHaveTextContent(
      String.fromCharCode(0x2014),
    );
  });
});
