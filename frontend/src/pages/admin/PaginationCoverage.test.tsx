import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FailurePagination } from "./failures/FailurePagination";
import { MaintenancePagination } from "./maintenance/MaintenancePagination";
import { SchedulingPagination } from "./scheduling/SchedulingPagination";
import { WorkOrderPagination } from "./equipment/workorders/WorkOrderPagination";

describe("administration pagination boundaries", () => {
  it("covers empty, first-page, middle-page, and last-page states", async () => {
    const user = userEvent.setup();
    const load = vi.fn().mockResolvedValue(undefined);
    const onPageChange = vi.fn();
    const { rerender } = render(
      <FailurePagination count={0} start={0} end={0} page={1} totalPages={1} loading={false} load={load} />,
    );
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    rerender(
      <FailurePagination count={40} start={1} end={20} page={1} totalPages={2} loading={false} load={load} />,
    );
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(load).toHaveBeenLastCalledWith(2);
    rerender(
      <FailurePagination count={40} start={21} end={40} page={2} totalPages={2} loading={false} load={load} />,
    );
    expect(screen.getByText(/Mostrando 21/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(load).toHaveBeenCalledWith(1);

    rerender(
      <MaintenancePagination count={0} start={0} end={0} page={1} totalPages={1} loading={false} load={load} />,
    );
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    rerender(
      <MaintenancePagination count={10} start={1} end={10} page={1} totalPages={2} loading={false} load={load} />,
    );
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(load).toHaveBeenLastCalledWith(2);
    rerender(
      <MaintenancePagination count={10} start={1} end={10} page={2} totalPages={2} loading={false} load={load} />,
    );
    await user.click(screen.getByRole("button", { name: "Anterior" }));

    rerender(
      <SchedulingPagination count={0} start={0} end={0} page={1} totalPages={1} loading={false} onPageChange={onPageChange} />,
    );
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    rerender(
      <SchedulingPagination count={10} start={1} end={10} page={1} totalPages={2} loading={false} onPageChange={onPageChange} />,
    );
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    rerender(
      <SchedulingPagination count={10} start={1} end={10} page={2} totalPages={2} loading={false} onPageChange={onPageChange} />,
    );
    await user.click(screen.getByRole("button", { name: "Anterior" }));

    rerender(
      <WorkOrderPagination count={0} start={0} end={0} page={1} totalPages={1} loading={false} onPageChange={onPageChange} />,
    );
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    rerender(
      <WorkOrderPagination count={10} start={1} end={10} page={1} totalPages={2} loading={false} onPageChange={onPageChange} />,
    );
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    rerender(
      <WorkOrderPagination count={10} start={1} end={10} page={2} totalPages={2} loading={true} onPageChange={onPageChange} />,
    );
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });
});
