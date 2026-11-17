import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useAuth } from "@/context/AuthContext";
import type { Equipment } from "@/types/equipment/equipment";
import { equipmentService } from "@/services/equipment.service";
import { EquipoDetallePage } from "./EquipoDetallePage";
import { EquipmentRow } from "./EquipmentRow";
import { EquipmentFilters } from "./EquipmentFilters";
import { EquipmentHeader } from "./EquipmentHeader";
import { EquipmentPagination } from "./EquipmentPagination";
import { EquipmentTable } from "./EquipmentTable";
import { FichaHeader } from "./FichaHeader";
import { FichaTabs } from "./FichaTabs";
import LetterFilter from "./LetterFilter";
import { StatusSelect } from "./StatusSelect";
import type { FichaHeaderProps } from "@/types/equipment/ficha";
import { downloadEquipmentInventory } from "@/utils/equipment.inventory.export";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/equipment.service", () => ({
  equipmentService: { retrieve: vi.fn() },
}));
vi.mock("@/utils/equipment.inventory.export", () => ({
  downloadEquipmentInventory: vi.fn(),
}));

const equipment: Equipment = {
  id: 7,
  name: "Monitor multiparámetro",
  asset_tag: "EQ-007",
  equipment_model: 3,
  equipment_model_name: "MX-3",
  brand: 2,
  brand_name: "Biomed",
  risk_class: "IIA",
  branch: 1,
  branch_name: "Sede Norte",
  location: "UCI",
  purchase_date: "",
  serial: "",
  technology_type: "",
  status: "ACTIVE",
};

function HeaderWithRouter(props: Omit<FichaHeaderProps, "navigate">) {
  const navigate = useNavigate();
  return <FichaHeader {...props} navigate={navigate} />;
}

function mockUser(role: "admin" | "tecnico" = "admin") {
  vi.mocked(useAuth).mockReturnValue({
    usuario: {
      id: 1,
      username: "test",
      email: "test@example.com",
      first_name: "Test",
      last_name: "User",
      role,
      is_active: true,
    },
    isAuthenticated: true,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  });
}

describe("equipment components", () => {
  it("toggles equipment status and reflects a disabled update", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <StatusSelect value="ACTIVE" onChange={onChange} />,
    );
    const active = screen.getByRole("button", { name: "Desactivar equipo" });
    expect(active).toHaveAttribute("aria-pressed", "true");
    await user.click(active);
    expect(onChange).toHaveBeenCalledWith("INACTIVE");

    rerender(<StatusSelect value="INACTIVE" disabled onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Activar equipo" })).toBeDisabled();
    expect(screen.getByText("...")).toBeInTheDocument();
    rerender(<StatusSelect value="INACTIVE" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Activar equipo" }));
    expect(onChange).toHaveBeenLastCalledWith("ACTIVE");
  });

  it("filters equipment by letter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<LetterFilter value="" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Todas" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "A" }));
    expect(onChange).toHaveBeenCalledWith("A");
    rerender(<LetterFilter value="A" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "A" })).toHaveClass("bg-primary");
    await user.click(screen.getByRole("button", { name: "Todas" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    rerender(<LetterFilter value="" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Todas" })).toHaveClass("bg-primary");
  });

  it("shows only the equipment tabs allowed to the current user", async () => {
    const user = userEvent.setup();
    const setTab = vi.fn();
    const { rerender } = render(
      <FichaTabs
        tab="info"
        setTab={setTab}
        canVerHistorial
        canVerProgramados
      />,
    );
    await user.click(screen.getByRole("button", { name: /Mantenimientos realizados/ }));
    expect(setTab).toHaveBeenCalledWith("historial");
    expect(screen.getByRole("button", { name: "Programados" })).toBeInTheDocument();

    rerender(
      <FichaTabs
        tab="info"
        setTab={setTab}
        canVerHistorial={false}
        canVerProgramados={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /Mantenimientos realizados/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Información" })).toBeInTheDocument();
  });

  it("renders equipment details and invokes available row actions", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onStatus = vi.fn();
    const onMaintenance = vi.fn();
    const onCreate = vi.fn();
    render(
      <table>
        <tbody>
          <EquipmentRow
            eq={equipment}
            brands={[]}
            models={[]}
            branchName={() => "Sucursal"}
            canEdit
            canCreate
            onCreate={onCreate}
            canCreateMaintenance
            statusUpdatingId={null}
            onSelect={onSelect}
            onChangeStatus={onStatus}
            onNewMaintenance={onMaintenance}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Biomed · MX-3")).toBeInTheDocument();
    expect(screen.getByText("Sede Norte")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Registrar equipo" }));
    await user.click(screen.getByRole("button", { name: "Detalle" }));
    await user.click(screen.getByRole("button", { name: "Nuevo mantenimiento" }));
    await user.click(screen.getByRole("button", { name: "Desactivar equipo" }));
    expect(onCreate).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(equipment);
    expect(onMaintenance).toHaveBeenCalledWith(equipment);
    expect(onStatus).toHaveBeenCalledWith(equipment, "INACTIVE");
  });

  it("shows fallbacks when an equipment has no catalog labels or risk class", () => {
    render(
      <table>
        <tbody>
          <EquipmentRow
            eq={{ ...equipment, brand: undefined, brand_name: undefined, equipment_model_name: undefined, risk_class: undefined }}
            brands={[]}
            models={[]}
            branchName={() => "Sucursal"}
            canEdit={false}
            canCreate={false}
            onCreate={vi.fn()}
            canCreateMaintenance={false}
            statusUpdatingId={null}
            onSelect={vi.fn()}
            onChangeStatus={vi.fn()}
            onNewMaintenance={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText(/#3/)).toBeInTheDocument();
    expect(screen.getByText("Sin clase")).toBeInTheDocument();
  });

  it("uses catalog and branch lookups when names are missing", () => {
    render(
      <table>
        <tbody>
          <EquipmentRow
            eq={{ ...equipment, brand_name: undefined, equipment_model_name: undefined, branch_name: undefined }}
            brands={[{ id: 2, name: "Biomed", is_active: true }]}
            models={[{ id: 3, brand: 2, name: "MX-3", is_active: true }]}
            branchName={(id) => `Sucursal ${id}`}
            canEdit={false}
            canCreate={false}
            onCreate={vi.fn()}
            canCreateMaintenance={false}
            statusUpdatingId={null}
            onSelect={vi.fn()}
            onChangeStatus={vi.fn()}
            onNewMaintenance={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Biomed · MX-3")).toBeInTheDocument();
    expect(screen.getByText("Sucursal 1")).toBeInTheDocument();
  });

  it("renders equipment table loading, empty and filtered-result states", () => {
    const callbacks = {
      branchName: () => "Sucursal",
      canEdit: false,
      canCreate: false,
      onCreate: vi.fn(),
      canCreateMaintenance: false,
      statusUpdatingId: null,
      onSelect: vi.fn(),
      onChangeStatus: vi.fn(),
      onNewMaintenance: vi.fn(),
    };
    const { rerender } = render(
      <EquipmentTable
        {...callbacks}
        items={[]}
        loading
        brands={[]}
        models={[]}
      />,
    );
    expect(screen.getByText("Cargando...")).toBeInTheDocument();

    rerender(
      <EquipmentTable
        {...callbacks}
        items={[]}
        loading={false}
        brands={[]}
        models={[]}
      />,
    );
    expect(
      screen.getByText("No se encontraron equipos con los filtros actuales."),
    ).toBeInTheDocument();

    rerender(
      <EquipmentTable
        {...callbacks}
        items={[
          {
            ...equipment,
            equipment_model_name: undefined,
            brand_name: undefined,
            brand: undefined,
          },
        ]}
        loading={false}
        brands={[{ id: 2, name: "Biomed", is_active: true }]}
        models={[{ id: 3, brand: 2, name: "MX-3", is_active: true }]}
      />,
    );
    expect(screen.getByText("Biomed · MX-3")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar equipo" })).not.toBeInTheDocument();
  });

  it("updates equipment filters, search text, inventory header and pagination", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    const onBranchFilterChange = vi.fn();
    const onBrandFilterChange = vi.fn();
    const onStatusFilterChange = vi.fn();
    const onRiskFilterChange = vi.fn();
    const setPage = vi.fn();
    const { rerender } = render(
      <>
        <EquipmentHeader role="tecnico" area="UCI" />
        <EquipmentFilters
          search=""
          onSearchChange={onSearchChange}
          branchFilter=""
          onBranchFilterChange={onBranchFilterChange}
          brandFilter=""
          onBrandFilterChange={onBrandFilterChange}
          statusFilter=""
          onStatusFilterChange={onStatusFilterChange}
          riskFilter=""
          onRiskFilterChange={onRiskFilterChange}
          branchOptions={[{ value: "1", label: "Norte" }]}
          brands={[{ id: 2, name: "Biomed", is_active: true }]}
          searchOptions={[{ value: "7", label: "Monitor" }]}
        />
        <EquipmentPagination
          count={20}
          start={1}
          end={10}
          page={2}
          totalPages={2}
          loading={false}
          setPage={setPage}
        />
      </>,
    );

    expect(screen.getByText("Equipos de tu área (UCI). Consulta e informa fallas observadas.")).toBeInTheDocument();
    const search = screen.getByRole("combobox", {
      name: "Buscar equipo por nombre",
    });
    await user.type(search, "Monitor");
    expect(onSearchChange).toHaveBeenCalledWith("Monitor");
    await user.click(screen.getByRole("option", { name: "Monitor" }));
    expect(onSearchChange).toHaveBeenLastCalledWith("Monitor");
    await user.click(screen.getByRole("button", { name: "Quitar selección" }));
    expect(onSearchChange).toHaveBeenLastCalledWith("");

    const selects = screen.getAllByRole("combobox").filter(
      (item) => item !== search,
    );
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(selects[1], { target: { value: "2" } });
    fireEvent.change(selects[2], { target: { value: "INACTIVE" } });
    fireEvent.change(selects[3], { target: { value: "IIA" } });
    expect(onBranchFilterChange).toHaveBeenCalledWith("1");
    expect(onBrandFilterChange).toHaveBeenCalledWith("2");
    expect(onStatusFilterChange).toHaveBeenCalledWith("INACTIVE");
    expect(onRiskFilterChange).toHaveBeenCalledWith("IIA");

    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(setPage).toHaveBeenCalledWith(expect.any(Function));
    rerender(
      <>
        <EquipmentHeader role="tecnico" />
        <EquipmentPagination
          count={20}
          start={1}
          end={10}
          page={1}
          totalPages={2}
          loading={false}
          setPage={setPage}
        />
      </>,
    );
    expect(screen.getByText("Equipos de tu área. Consulta e informa fallas observadas.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(setPage).toHaveBeenLastCalledWith(expect.any(Function));
    rerender(
      <>
        <EquipmentHeader role="admin" />
        <EquipmentPagination
          count={0}
          start={0}
          end={0}
          page={1}
          totalPages={1}
          loading
          setPage={setPage}
        />
      </>,
    );
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.queryByText(/Equipos de tu área/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });

  it("renders the equipment sheet with permitted actions and QR alternatives", async () => {
    const user = userEvent.setup();
    const downloadQr = vi.fn().mockResolvedValue(undefined);
    const regenerateQr = vi.fn().mockResolvedValue(undefined);
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const baseProps = {
      eq: equipment,
      downloadQr,
      canEdit: true,
      regenerateQr,
      regeneratingQr: false,
      canDelete: true,
      role: "tecnico" as const,
      onEdit,
      onDelete,
      branchLabel: "Sede Norte",
    };
    const { rerender } = render(
      <MemoryRouter>
        <HeaderWithRouter {...baseProps} qrSrc={null} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Sin QR")).toBeInTheDocument();
    expect(screen.getAllByText("No aplica")).toHaveLength(3);
    expect(screen.getByText("IIA")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar" })).toBeDisabled();

    rerender(
      <MemoryRouter>
        <HeaderWithRouter {...baseProps} qrSrc="/qr/7.png" />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(screen.getByRole("button", { name: "Regenerar" }));
    await user.click(screen.getByRole("button", { name: "Descargar" }));
    await user.click(screen.getByRole("button", { name: "Inventario" }));
    await user.click(screen.getByRole("button", { name: "Registrar mantenimiento" }));
    await user.click(screen.getByRole("button", { name: "Reportar falla" }));

    expect(onEdit).toHaveBeenCalledWith(equipment);
    expect(onDelete).toHaveBeenCalledWith(equipment);
    expect(regenerateQr).toHaveBeenCalledOnce();
    expect(downloadQr).toHaveBeenCalledOnce();
    expect(downloadEquipmentInventory).toHaveBeenCalledWith([equipment]);
  });

  it("shows an invalid equipment identifier without calling the API", async () => {
    mockUser("tecnico");
    render(
      <MemoryRouter initialEntries={["/admin/equipos/invalid"]}>
        <Routes>
          <Route path="/admin/equipos/:id" element={<EquipoDetallePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Identificador de equipo inválido.",
    );
    expect(screen.getByText("Consulta el equipo asignado a tu área.")).toBeInTheDocument();
    expect(equipmentService.retrieve).not.toHaveBeenCalled();
  });

  it("shows API failures and links back to the equipment list", async () => {
    mockUser();
    vi.mocked(equipmentService.retrieve).mockRejectedValueOnce(
      new Error("Fallo de prueba"),
    );
    render(
      <MemoryRouter initialEntries={["/admin/equipos/7"]}>
        <Routes>
          <Route path="/admin/equipos/:id" element={<EquipoDetallePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver al listado de equipos" }),
    ).toHaveAttribute("href", "/admin/equipos");
  });
});
