"""Pruebas complementarias de equipment: modelos, señales, serializers y vistas."""
from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers as drf

from equipment.models import (
    Equipment,
    EquipmentAttachment,
    EquipmentCertificate,
    EquipmentInstruction,
    EquipmentWorkOrder,
)
from workorders.models import WorkOrderSparePart
from equipment.serializers import (
    EquipmentSerializer,
    EquipmentWorkOrderSerializer,
)
from users.tests.factories import IngenieroFactory, TecnicoFactory

from .factories import EquipmentFactory

pytestmark = pytest.mark.django_db


class TestEstadoGarantia:
    def test_sin_fecha_devuelve_none(self, equipment):
        equipment.warranty_end_date = None
        assert equipment.estado_garantia() is None

    def test_vencida(self, equipment):
        equipment.warranty_end_date = timezone.now() - timedelta(days=2)
        assert equipment.estado_garantia() == "Fecha de garantia vencida"

    def test_por_vencer(self, equipment):
        equipment.warranty_end_date = timezone.now() + timedelta(days=5, hours=12)
        assert equipment.estado_garantia() == "Por vencer (renovar garantia)"

    def test_cerca_de_vencimiento_a_30_dias(self, equipment):
        equipment.warranty_end_date = timezone.now() + timedelta(days=30, hours=12)
        assert equipment.estado_garantia() == "Cerca de vencimiento"

    def test_lejana_devuelve_none(self, equipment):
        # OBSERVACION QA: entre 11 y 29 días y más de 30 el método no devuelve estado.
        equipment.warranty_end_date = timezone.now() + timedelta(days=90)
        assert equipment.estado_garantia() is None
        equipment.warranty_end_date = timezone.now() + timedelta(days=20, hours=12)
        assert equipment.estado_garantia() is None


class TestStrModelos:
    def test_representaciones(self, equipment):
        ins = EquipmentInstruction(equipment=equipment, sequence=3)
        assert str(ins) == f"{equipment.name} - 3"
        cert = EquipmentCertificate(equipment=equipment, certificate_number="C-1")
        assert str(cert) == "C-1"
        att = EquipmentAttachment(equipment=equipment, title="Manual")
        assert str(att) == "Manual"
        wo = EquipmentWorkOrder(equipment=equipment, number="OT-77")
        assert str(wo) == "OT-77"


class TestSenales:
    def test_guardar_sin_cambiar_garantia_no_encola_tarea(self, branch, equipment_model):
        with mock.patch("equipment.tasks.check_equipment_expiry") as task:
            eq = Equipment.objects.create(
                name="G1", asset_tag="G-1", equipment_model=equipment_model, branch=branch,
                warranty_end_date=timezone.now() + timedelta(days=100),
            )
            eq.location = "Otra"
            eq.save()
        # Solo se encola (on_commit) al crear o al cambiar la garantía; la segunda
        # grabación sin cambios no debe encolar de nuevo.
        assert task.delay.call_count <= 1

    def test_post_delete_de_repuesto_recalcula_costo(self, equipment):
        wo = EquipmentWorkOrder.objects.create(
            equipment=equipment, number="OT-SP", service_type="CORRECTIVE",
            start_date=timezone.now(), description="x",
        )
        sp = WorkOrderSparePart.objects.create(work_order=wo, name="Fusible", reference="F", quantity=2, unit_cost="10.00", total_cost="20.00")
        wo.refresh_from_db()
        assert str(wo.cost.spare_parts_cost) == "20.00"
        sp.delete()
        wo.cost.refresh_from_db()
        assert str(wo.cost.spare_parts_cost) == "0.00"


class TestSerializerEquipment:
    def test_qr_code_url_sin_archivo(self, equipment):
        s = EquipmentSerializer(equipment)
        assert s.get_qr_code_url(SimpleNamespace(qr_code="")) is None

    def test_qr_code_url_normaliza_ruta_relativa(self, equipment):
        s = EquipmentSerializer(equipment, context={})
        fake = SimpleNamespace(qr_code=mock.MagicMock(url="media/qr.png"))
        assert s.get_qr_code_url(fake).endswith("media/qr.png")

    def test_dias_para_vencer_garantia(self, equipment):
        s = EquipmentSerializer(equipment)
        equipment.warranty_end_date = timezone.now() + timedelta(days=10, hours=1)
        assert isinstance(s.get_days_to_expiration(equipment), int)
        equipment.warranty_end_date = None
        assert s.get_days_to_expiration(equipment) is None

    def test_validadores_de_codigo_y_nombre(self, equipment):
        s = EquipmentSerializer()
        with pytest.raises(drf.ValidationError):
            s.validate_asset_tag("   ")
        with pytest.raises(drf.ValidationError):
            s.validate_name("   ")
        assert s.validate_name("  Monitor   UCI ") == "Monitor UCI"
        with pytest.raises(drf.ValidationError):
            s.validate_asset_tag(equipment.asset_tag.lower())
        # en edición el propio código es válido
        s_edit = EquipmentSerializer(instance=equipment)
        assert s_edit.validate_asset_tag(equipment.asset_tag.lower()) == equipment.asset_tag.upper()

    def test_imagen_demasiado_grande(self):
        s = EquipmentSerializer()
        big = SimpleNamespace(size=50 * 1024 * 1024)
        with pytest.raises(drf.ValidationError):
            s.validate_equipment_image(big)
        assert s.validate_equipment_image(None) is None
        small = SimpleNamespace(size=10)
        assert s.validate_equipment_image(small) is small

    def test_uploaded_by_nulo(self):
        from equipment.serializers import EquipmentAttachmentSerializer

        s = EquipmentAttachmentSerializer()
        assert s.get_uploaded_by_name(SimpleNamespace(uploaded_by=None)) is None


class TestSerializerWorkOrder:
    def test_numero_vacio_y_duplicado_en_edicion(self, equipment):
        s = EquipmentWorkOrderSerializer()
        with pytest.raises(drf.ValidationError):
            s.validate_number("   ")
        wo = EquipmentWorkOrder.objects.create(
            equipment=equipment, number="OT-X", service_type="CORRECTIVE",
            start_date=timezone.now(), description="x",
        )
        s2 = EquipmentWorkOrderSerializer(instance=wo)
        assert s2.validate_number("OT-X") == "OT-X"  # excluye la propia instancia
        EquipmentWorkOrder.objects.create(
            equipment=equipment, number="OT-Y", service_type="CORRECTIVE",
            start_date=timezone.now(), description="y",
        )
        with pytest.raises(drf.ValidationError):
            s2.validate_number("ot-y")

    def test_schedule_info_con_programacion(self, equipment):
        from scheduling.tests.factories import MaintenanceScheduleFactory

        sched = MaintenanceScheduleFactory(equipment=equipment)
        wo = EquipmentWorkOrder.objects.create(
            equipment=equipment, number="OT-S", service_type="PREVENTIVE",
            start_date=timezone.now(), description="x", schedule=sched,
        )
        info = EquipmentWorkOrderSerializer().get_schedule_info(wo)
        assert info["id"] == sched.id
        assert info["kind"] == sched.kind

    def test_ingeniero_no_puede_finalizar_directo(self, equipment):
        eng = IngenieroFactory()
        wo = EquipmentWorkOrder.objects.create(
            equipment=equipment, number="OT-F", service_type="PREVENTIVE",
            start_date=timezone.now(), description="x", status="PENDING",
        )
        s = EquipmentWorkOrderSerializer(
            instance=wo, data={"status": "FINISHED"}, partial=True,
            context={"request": SimpleNamespace(user=eng)},
        )
        assert not s.is_valid()
        assert "status" in s.errors


class TestViews:
    def test_names_lista_nombres_distintos(self, auth_client, branch):
        EquipmentFactory(name="Zeta", branch=branch)
        EquipmentFactory(name="Alfa", branch=branch)
        EquipmentFactory(name="Alfa", branch=branch)
        r = auth_client.get(reverse("equipment:equipment-names"))
        assert r.status_code == 200
        assert r.json() == ["Alfa", "Zeta"]

    def test_tecnico_sin_area_ve_lista_vacia(self, api_client, branch):
        EquipmentFactory(branch=branch)
        api_client.force_authenticate(user=TecnicoFactory(area=""))
        r = api_client.get(reverse("equipment:equipment-list"))
        assert r.status_code == 200
        assert (r.json().get("results") if isinstance(r.json(), dict) else r.json()) == []

    def test_historial_sin_paginacion(self, auth_client, equipment):
        url = reverse("equipment:equipment-history", args=[equipment.pk])
        with mock.patch("equipment.views.EquipmentViewSet.paginate_queryset", return_value=None):
            r = auth_client.get(url)
        assert r.status_code == 200
        assert r.json() == []

    def test_filtro_work_orders_por_nombre_de_equipo(self, auth_client, branch):
        a = EquipmentFactory(name="Monitor X", branch=branch)
        b = EquipmentFactory(name="Bomba Y", branch=branch)
        for eq, num in ((a, "OT-A"), (b, "OT-B")):
            EquipmentWorkOrder.objects.create(
                equipment=eq, number=num, service_type="CORRECTIVE",
                start_date=timezone.now(), description="x",
            )
        r = auth_client.get(reverse("equipment:equipment-work-order-list"), {"equipment_name": "mon"})
        assert r.status_code == 200
        assert [w["number"] for w in r.json()["results"]] == ["OT-A"]

    def test_completar_orden_cancelada_falla(self, auth_client, equipment):
        wo = EquipmentWorkOrder.objects.create(
            equipment=equipment, number="OT-C", service_type="CORRECTIVE",
            start_date=timezone.now(), description="x", status="CANCELLED",
        )
        url = reverse("equipment:equipment-work-order-complete", args=[wo.pk])
        r = auth_client.post(url, {"observations": "hecho"}, format="json")
        assert r.status_code == 400
        assert "cancelada" in str(r.json())

    def test_registro_de_mantenimiento_por_enlace_agendamiento_y_ninguno(self, equipment):
        from equipment.views import _maintenance_record_for
        from maintenance.tests.factories import MaintenanceRecordFactory
        from scheduling.tests.factories import MaintenanceScheduleFactory

        sched = MaintenanceScheduleFactory(equipment=equipment)
        record = MaintenanceRecordFactory(equipment=equipment, scheduled_maintenance=sched)
        wo = EquipmentWorkOrder.objects.create(
            equipment=equipment, number="OT-REC", service_type="PREVENTIVE",
            start_date=timezone.now(), description="x", schedule=sched,
        )
        assert _maintenance_record_for(wo) == record
        sin = EquipmentWorkOrder.objects.create(
            equipment=equipment, number="OT-NONE", service_type="PREVENTIVE",
            start_date=timezone.now(), description="x",
        )
        assert _maintenance_record_for(sin) is None
