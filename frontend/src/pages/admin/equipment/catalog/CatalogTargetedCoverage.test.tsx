import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BrandFormModal } from "./BrandFormModal";
import { ModelFormModal } from "./ModelFormModal";
import { CatalogPager } from "./CatalogPager";

describe("catalog components", () => {
  it("renders editing forms, clears a model brand, and pages through results", async () => {
    const user = userEvent.setup();
    const setBrandForm = vi.fn();
    const setModelForm = vi.fn();
    const submitBrand = vi.fn((event: React.FormEvent) => event.preventDefault());
    const submitModel = vi.fn((event: React.FormEvent) => event.preventDefault());
    const close = vi.fn();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const { rerender } = render(
      <>
        <BrandFormModal
          creatingBrand={false}
          editingBrand={{ id: 1, name: "Biomed", is_active: true }}
          closeBrandModal={close}
          submitBrand={submitBrand}
          brandForm={{ name: "Biomed", is_active: true }}
          setBrandForm={setBrandForm}
          savingBrand={false}
        />
        <ModelFormModal
          creatingModel={false}
          editingModel={{ id: 2, brand: 1, name: "M-1", is_active: true }}
          closeModelModal={close}
          submitModel={submitModel}
          modelForm={{ name: "M-1", brand: 1, is_active: true }}
          setModelForm={setModelForm}
          brandOptions={[{ value: "1", label: "Biomed" }]}
          savingModel={false}
        />
        <CatalogPager
          count={0}
          page={1}
          pageSize={20}
          loading
          onPrev={onPrev}
          onNext={onNext}
        />
      </>,
    );

    expect(screen.getByRole("heading", { name: "Editar marca" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Editar modelo" })).toBeInTheDocument();
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nombre de la marca"), {
      target: { value: "Biomedica" },
    });
    fireEvent.change(screen.getByLabelText("Nombre del modelo"), {
      target: { value: "M-2" },
    });
    expect(setBrandForm).toHaveBeenCalled();
    expect(setModelForm).toHaveBeenCalled();
    fireEvent.submit(screen.getByLabelText("Nombre de la marca").closest("form")!);
    fireEvent.submit(screen.getByLabelText("Nombre del modelo").closest("form")!);
    expect(submitBrand).toHaveBeenCalledOnce();
    expect(submitModel).toHaveBeenCalledOnce();
    await user.click(screen.getAllByRole("button", { name: "Cancelar" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Cancelar" })[1]);
    expect(close).toHaveBeenCalledTimes(2);

    const brand = screen.getByRole("combobox", { name: "Marca" });
    await user.click(brand);
    await user.click(screen.getByRole("option", { name: "Biomed" }));
    expect(setModelForm).toHaveBeenCalledWith({ name: "M-1", brand: 1, is_active: true });
    await user.click(brand);
    await user.click(screen.getByRole("button", { name: "Quitar selección" }));
    expect(setModelForm).toHaveBeenCalledWith({ name: "M-1", brand: 0, is_active: true });
    fireEvent.change(screen.getByLabelText("Nombre de la marca"), {
      target: { value: "Biomedica" },
    });
    expect(setBrandForm).toHaveBeenCalled();

    rerender(
      <CatalogPager
        count={45}
        page={2}
        pageSize={20}
        loading={false}
        onPrev={onPrev}
        onNext={onNext}
      />,
    );
    expect(screen.getByText(/Mostrando 21/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();

    render(
      <>
        <BrandFormModal
          creatingBrand
          editingBrand={null}
          closeBrandModal={close}
          submitBrand={submitBrand}
          brandForm={{ name: "", is_active: true }}
          setBrandForm={setBrandForm}
          savingBrand={false}
        />
        <ModelFormModal
          creatingModel
          editingModel={null}
          closeModelModal={close}
          submitModel={submitModel}
          modelForm={{ name: "", brand: 0, is_active: true }}
          setModelForm={setModelForm}
          brandOptions={[]}
          savingModel={false}
        />
      </>,
    );
    expect(screen.getByRole("heading", { name: "Nueva marca" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nuevo modelo" })).toBeInTheDocument();
  });
});
