"""Pruebas complementarias (workorders, audit, branches, catalog)."""
from decimal import Decimal
from types import SimpleNamespace

import pytest
from django.contrib import admin as django_admin
from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers as drf

from audit.admin import AuditLogAdmin
from audit.models import AuditAction, AuditLog
from branches.serializers import BranchSerializer
from branches.tests.factories import BranchFactory
from catalog.models import EquipmentModel
from catalog.serializers import BrandSerializer, EquipmentModelSerializer
from catalog.tests.factories import BrandFactory, EquipmentModelFactory
from equipment.models import EquipmentWorkOrder
from equipment.tests.factories import EquipmentFactory
from users.tests.factories import AdminFactory
from workorders.models import (
    WorkOrderCost,
    WorkOrderEvidence,
    WorkOrderMeasurement,
    WorkOrderSignature,
    WorkOrderSparePart,
)
from workorders.serializers import WorkOrderSparePartSerializer

pytestmark = pytest.mark.django_db


@pytest.fixture
def wo():
    eq = EquipmentFactory()
    return EquipmentWorkOrder.objects.create(
        equipment=eq, number="OT-G1", service_type="CORRECTIVE",
        start_date=timezone.now(), description="x",
    )


class TestWorkOrderModelsStr:
    def test_representaciones(self, wo):
        sp = WorkOrderSparePart(work_order=wo, name="Fusible", quantity=2)
        assert str(sp).startswith("Fusible x2")
        assert str(WorkOrderMeasurement(work_order=wo, parameter="Voltaje")) == "Voltaje - OT-G1"
        ev = WorkOrderEvidence(work_order=wo, evidence_type="PHOTO")
        assert str(ev).endswith("- OT-G1")
        sig = WorkOrderSignature(work_order=wo, role="TECHNICIAN", signed_by="Ana")
        assert str(sig).endswith(": Ana")
        assert str(WorkOrderCost(work_order=wo)) == "Costos de OT-G1"


class TestSparePartSerializer:
    def test_validaciones(self):
        s = WorkOrderSparePartSerializer()
        with pytest.raises(drf.ValidationError):
            s.validate_quantity(0)
        with pytest.raises(drf.ValidationError):
            s.validate_unit_cost(Decimal("-1"))
        assert s.validate_quantity(None) is None
        assert s.validate_unit_cost(None) is None
        assert s.validate_quantity(3) == 3

    def test_update_recalcula_total(self, wo):
        sp = WorkOrderSparePart.objects.create(
            work_order=wo, name="P", reference="R", quantity=1, unit_cost=Decimal("10"), total_cost=Decimal("10"),
        )
        s = WorkOrderSparePartSerializer(instance=sp, data={"quantity": 4}, partial=True)
        assert s.is_valid(), s.errors
        out = s.save()
        assert out.total_cost == Decimal("40")


class TestWorkOrderChildViews:
    def test_no_se_puede_borrar_detalle_de_orden_terminada(self, auth_client, wo):
        sp = WorkOrderSparePart.objects.create(
            work_order=wo, name="P", reference="R", quantity=1, unit_cost=Decimal("1"), total_cost=Decimal("1"),
        )
        wo.status = "FINISHED"
        wo.save()
        r = auth_client.delete(reverse("equipment:work-order-spare-part-detail", args=[sp.pk]))
        assert r.status_code == 400
        assert "terminada" in str(r.json())

    def test_si_la_orden_esta_abierta_se_borra(self, auth_client, wo):
        sp = WorkOrderSparePart.objects.create(
            work_order=wo, name="P", reference="R", quantity=1, unit_cost=Decimal("1"), total_cost=Decimal("1"),
        )
        r = auth_client.delete(reverse("equipment:work-order-spare-part-detail", args=[sp.pk]))
        assert r.status_code == 204


class TestAudit:
    def test_str_y_admin_solo_lectura(self):
        log = AuditLog.objects.create(
            actor=AdminFactory(), action=AuditAction.CREATE, model_label="equipment.Equipment", object_id="5",
        )
        assert "equipment.Equipment#5" in str(log)
        ma = AuditLogAdmin(AuditLog, django_admin.site)
        req = SimpleNamespace()
        assert ma.has_add_permission(req) is False
        assert ma.has_change_permission(req) is False
        assert ma.has_delete_permission(req) is False


class TestBranches:
    def test_nombre_vacio_y_email_nulo(self):
        s = BranchSerializer()
        with pytest.raises(drf.ValidationError):
            s.validate_name("   ")
        assert s.validate_email(None) is None

    def test_eliminar_sede_con_equipos_devuelve_409(self, auth_client):
        branch = BranchFactory()
        EquipmentFactory(branch=branch)
        r = auth_client.delete(reverse("branches:branch-detail", args=[branch.pk]))
        assert r.status_code == 409


class TestCatalog:
    def test_managers_active_inactive(self):
        a = EquipmentModelFactory(is_active=True)
        b = EquipmentModelFactory(is_active=False)
        assert list(EquipmentModel.objects.active()) == [a]
        assert list(EquipmentModel.objects.inactive()) == [b]
        assert a in EquipmentModel.objects.get_queryset().active()
        assert b in EquipmentModel.objects.get_queryset().inactive()

    def test_marca_duplicada_excluye_instancia_en_edicion(self):
        brand = BrandFactory(name="Philips")
        s = BrandSerializer(instance=brand, data={"name": "philips"}, partial=True)
        assert s.is_valid(), s.errors
        BrandFactory(name="Otra")
        s2 = BrandSerializer(instance=brand, data={"name": "otra"}, partial=True)
        assert not s2.is_valid()

    def test_modelo_duplicado_excluye_instancia_en_edicion(self):
        m = EquipmentModelFactory(name="X1")
        s = EquipmentModelSerializer(instance=m, data={"brand": m.brand_id, "name": "x1"}, partial=True)
        assert s.is_valid(), s.errors
