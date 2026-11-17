import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useAuth } from "@/context/AuthContext";
import type { Branch } from "@/types/equipment/branch";
import type { Equipment } from "@/types/equipment/equipment";
import type { MaintenanceRecord } from "@/types/maintenance/maintenance";
import type { ScheduledMaintenance } from "@/types/scheduling/scheduling";
import { equipmentService } from "@/services/equipment.service";
import { maintenanceService } from "@/services/maintenance.service";
import { schedulingService } from "@/services/scheduling.service";
import { PlaceholderPage } from "@/pages/admin/PlaceholderPage";
import { EquipoFichaContent } from "./EquipoFicha";
import { FichaHistoryTab } from "./FichaHistoryTab";
import { FichaInfoTab } from "./FichaInfoTab";
import { FichaScheduledTab } from "./FichaScheduledTab";
import { SedeQrModal } from "./SedeQrModal";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/equipment.service", () => ({
  equipmentService: {
    updateImage: vi.fn(),
    regenerateQr: vi.fn(),
  },
}));
vi.mock("@/services/maintenance.service", () => ({
  maintenanceService: { list: vi.fn() },
}));
vi.mock("@/services/scheduling.service", () => ({
  schedulingService: { list: vi.fn() },
}));

const equipment: Equipment = {
  id: 1,
  name: "Monitor",
  asset_tag: "EQ-1",
  equipment_model: 1,
  risk_class: "IIA",
  branch: 1,
  location: "UCI",
  purchase_date: "",
  status: "ACTIVE",
  mtbf_hours: "12.5",
  mttr_hours: null,
};

const history: MaintenanceRecord[] = [
  {
    id: 1,
    equipment: 1,
    kind: "PREVENTIVE",
    date: "2026-01-03",
    description: "Inspección de rutina",
    observations: "Sensor revisado",
    technician: "Técnico legado",
    assigned_engineer_detail: {
      id: 2,
      username: "ing",
      full_name: "Ingeniera Ejemplo",
      role: "ingeniero",
      role_display: "Ingeniero",
    },
    cost: "120000",
    pdf_file_url: "https://example.test/maintenance.pdf",
  },
  {
    id: 2,
    equipment: 1,
    kind: "REPAIR",
    date: "2026-02-04",
    description: "Reparación",
    technician: "Técnico Ejemplo",
  },
];

const scheduled: ScheduledMaintenance[] = [
  {
    id: 1,
    equipment: 1,
    kind: "PREVENTIVE",
    requested_date: "2026-01-01",
    scheduled_date: "2026-01-03",
    notes: "Mantenimiento anual",
    is_completed: false,
  },
  {
    id: 2,
    equipment: 1,
    kind: "REPAIR",
    requested_date: "2026-01-02",
    scheduled_date: null,
    is_completed: true,
  },
];

describe("equipment sheet tabs", () => {
  it("loads the full equipment sheet, refreshes data, handles actions and image errors", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Network unavailable"),
    );
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const updatedEquipment = {
      ...equipment,
      qr_code_url: "/media/qr.png",
      equipment_image: "/media/image.png",
    };
    vi.mocked(useAuth).mockReturnValue({
      usuario: {
        id: 1,
        username: "admin",
        email: "admin@example.com",
        first_name: "Ana",
        last_name: "Admin",
        role: "admin",
        is_active: true,
      },
      isAuthenticated: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    vi.mocked(maintenanceService.list).mockResolvedValue(history);
    vi.mocked(schedulingService.list).mockResolvedValue(scheduled);
    vi.mocked(equipmentService.regenerateQr).mockResolvedValue(updatedEquipment);
    vi.mocked(equipmentService.updateImage)
      .mockResolvedValueOnce(updatedEquipment)
      .mockRejectedValueOnce(new Error("Upload rejected"));

    render(
      <MemoryRouter>
        <EquipoFichaContent
          equipment={equipment}
          branchName={() => "Sucursal"}
          canEdit
          canDelete
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("2")).toBeInTheDocument();
    expect(maintenanceService.list).toHaveBeenCalledWith({
      equipment: equipment.id,
      ordering: "-date",
    });
    expect(schedulingService.list).toHaveBeenCalledWith({
      equipment: equipment.id,
      ordering: "scheduled_date",
      kind: undefined,
    });
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onEdit).toHaveBeenCalledWith(equipment);
    expect(onDelete).toHaveBeenCalledWith(equipment);

    await user.click(screen.getByRole("button", { name: "Mantenimientos realizados" }));
    expect(screen.getByText("Sensor revisado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Programados" }));
    expect(await screen.findByText("Mantenimiento anual")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox"), "REPAIR");
    expect(schedulingService.list).toHaveBeenLastCalledWith({
      equipment: equipment.id,
      ordering: "scheduled_date",
      kind: "REPAIR",
    });

    await user.click(screen.getByRole("button", { name: "Regenerar" }));
    expect(equipmentService.regenerateQr).toHaveBeenCalledWith(equipment.id);
    await user.click(screen.getByRole("button", { name: "Información" }));
    await user.click(screen.getByRole("button", { name: "Descargar" }));
    expect(fetch).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("/media/qr.png"),
      "_blank",
      "noopener,noreferrer",
    );
    const imageInput = document.querySelector<HTMLInputElement>(
      'input[type="file"]',
    );
    const file = new File(["image"], "monitor.png", { type: "image/png" });
    fireEvent.change(imageInput!, { target: { files: [file] } });
    expect(await screen.findByAltText("Imagen del equipo Monitor")).toBeInTheDocument();
    expect(equipmentService.updateImage).toHaveBeenCalledWith(equipment.id, file);

    fireEvent.change(imageInput!, { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fetch.mockRestore();
    open.mockRestore();
  });

  it("renders maintenance loading, empty, assigned engineer and fallback states", () => {
    const { rerender } = render(<FichaHistoryTab loadingH history={[]} />);
    expect(screen.getByText("Cargando...")).toBeInTheDocument();

    rerender(<FichaHistoryTab loadingH={false} history={[]} />);
    expect(
      screen.getByText("Este equipo aún no tiene mantenimientos registrados."),
    ).toBeInTheDocument();

    rerender(<FichaHistoryTab loadingH={false} history={history} />);
    expect(screen.getByText("Ingeniera Ejemplo")).toBeInTheDocument();
    expect(screen.getByText("Ingeniero:")).toBeInTheDocument();
    expect(screen.getByText("Técnico Ejemplo")).toBeInTheDocument();
    expect(screen.getByText("Sensor revisado")).toBeInTheDocument();
    expect(screen.getByText("Costo:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PDF/ })).toHaveAttribute(
      "href",
      "https://example.test/maintenance.pdf",
    );
    rerender(
      <FichaHistoryTab
        loadingH={false}
        history={[...history, { ...history[1], id: 3, technician: "   " }]}
      />,
    );
    expect(
      screen.getByText((_content, element) => element?.textContent === String.fromCharCode(0x2014)),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Reparación")).toHaveLength(4);
  });

  it("renders scheduled maintenance loading, empty, and populated states", async () => {
    const user = userEvent.setup();
    const setScheduledKind = vi.fn();
    const { rerender } = render(
      <FichaScheduledTab
        scheduledKind=""
        setScheduledKind={setScheduledKind}
        loadingS
        scheduled={[]}
      />,
    );
    expect(screen.getByText("Cargando...")).toBeInTheDocument();

    rerender(
      <FichaScheduledTab
        scheduledKind=""
        setScheduledKind={setScheduledKind}
        loadingS={false}
        scheduled={[]}
      />,
    );
    expect(
      screen.getByText("No hay mantenimientos programados con los filtros actuales."),
    ).toBeInTheDocument();

    rerender(
      <FichaScheduledTab
        scheduledKind=""
        setScheduledKind={setScheduledKind}
        loadingS={false}
        scheduled={scheduled}
      />,
    );
    await user.selectOptions(screen.getByRole("combobox"), "REPAIR");
    expect(setScheduledKind).toHaveBeenCalledWith("REPAIR");
    expect(screen.getByText("Mantenimiento anual")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Cumplido")).toBeInTheDocument();
    expect(screen.getByText("2026-01-02")).toBeInTheDocument();
  });

  it("shows reliability, counts, image upload state and image errors", async () => {
    const user = userEvent.setup();
    const uploadImage = vi.fn().mockResolvedValue(undefined);
    const imageInputRef = createRef<HTMLInputElement>();
    const props = {
      canVerHistorial: true,
      canVerProgramados: true,
      history,
      scheduled,
      imageSrc: null,
      canEdit: true,
      eq: equipment,
      imageInputRef,
      uploadImage,
      uploadingImage: false,
      imageError: null,
    };
    const { rerender, container } = render(<FichaInfoTab {...props} />);

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("MTBF — Tiempo medio entre fallas")).toBeInTheDocument();
    expect(screen.getByText("12.5 h")).toBeInTheDocument();
    expect(screen.getByText("MTTR — Tiempo medio de reparación")).toBeInTheDocument();
    expect(screen.getByText("Sin datos")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Adjuntar imagen" }));
    const file = new File(["image"], "monitor.png", { type: "image/png" });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    expect(uploadImage).toHaveBeenCalledWith(file);

    rerender(
      <FichaInfoTab
        {...props}
        imageSrc="/media/monitor.png"
        uploadingImage
        imageError="No se pudo guardar la imagen"
      />,
    );
    expect(screen.getByAltText("Imagen del equipo Monitor")).toHaveAttribute(
      "src",
      "/media/monitor.png",
    );
    expect(screen.getByRole("button", { name: "Cambiar imagen" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudo guardar la imagen",
    );
  });

  it("omits counters and image controls when the user has no permissions", () => {
    render(
      <FichaInfoTab
        canVerHistorial={false}
        canVerProgramados={false}
        history={[]}
        scheduled={[]}
        imageSrc={null}
        eq={equipment}
        imageInputRef={createRef<HTMLInputElement>()}
        uploadImage={vi.fn()}
        uploadingImage={false}
        imageError={null}
      />,
    );
    expect(screen.queryByText(/mantenimientos registrados/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adjuntar imagen" })).not.toBeInTheDocument();
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
  });

  it("renders the placeholder page with and without a description", () => {
    const { rerender } = render(
      <PlaceholderPage title="Reportes" description="Disponibles próximamente" />,
    );
    expect(screen.getByRole("heading", { name: "Reportes" })).toBeInTheDocument();
    expect(screen.getByText("Disponibles próximamente")).toBeInTheDocument();
    expect(screen.getByText("Vista en construcción")).toBeInTheDocument();

    rerender(<PlaceholderPage title="Auditoría" />);
    expect(screen.queryByText("Disponibles próximamente")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Auditoría" })).toBeInTheDocument();
  });

  it("renders and prints an escaped branch QR code", async () => {
    const user = userEvent.setup();
    const write = vi.fn();
    const close = vi.fn();
    const open = vi.spyOn(window, "open").mockReturnValue({
      document: { write, close },
    } as unknown as Window);
    const branch: Branch = {
      id: 8,
      name: '<Clínica "Central">',
      address: "",
      city: "Bogotá & alrededores",
      is_active: true,
    };
    branch.name = `${branch.name} O'Brien`;
    const onClose = vi.fn();
    const { rerender } = render(
      <SedeQrModal branch={null} onClose={onClose} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<SedeQrModal branch={branch} onClose={onClose} />);
    expect(
      screen.getByText(
        `${window.location.origin}/admin/equipos?branch=8`,
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Imprimir" }));
    expect(open).toHaveBeenCalledWith("", "_blank", "width=600,height=700");
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0]).toContain("O&#39;Brien");
    expect(write.mock.calls[0][0]).toContain("&lt;Clínica &quot;Central&quot;&gt;");
    expect(write.mock.calls[0][0]).toContain("Bogotá &amp; alrededores");
    expect(close).toHaveBeenCalledOnce();
    await user.click(screen.getAllByRole("button", { name: "Cerrar" })[1]);
    expect(onClose).toHaveBeenCalledOnce();
    open.mockRestore();
  });
});
