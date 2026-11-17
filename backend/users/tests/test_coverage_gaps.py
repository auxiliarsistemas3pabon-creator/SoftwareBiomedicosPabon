"""Pruebas complementarias: ramas de validación, permisos y managers no cubiertas."""
from types import SimpleNamespace
from unittest import mock

import pytest
from django.urls import reverse

from users.managers import UserManager
from users.models import User
from users.permissions import IsSelf
from users.serializers import (
    PasswordChangeSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
)

from .factories import AdminFactory, SuperadminFactory, TecnicoFactory, UserFactory

pytestmark = pytest.mark.django_db


def _create_data(**over):
    data = {
        "username": "nuevo",
        "email": "nuevo@example.com",
        "first_name": "Nu",
        "last_name": "Evo",
        "role": "tecnico",
        "password": "ClaveSegura#2026",
    }
    data.update(over)
    return data


class TestUserCreateSerializer:
    def test_username_en_blanco_rechazado(self):
        s = UserCreateSerializer(data=_create_data(username="   "))
        assert not s.is_valid()
        assert "username" in s.errors

    @pytest.mark.parametrize(
        "method,msg",
        [
            ("validate_username", "nombre de usuario"),
            ("validate_first_name", "nombres"),
            ("validate_last_name", "apellidos"),
        ],
    )
    def test_validadores_rechazan_vacio(self, method, msg):
        s = UserCreateSerializer()
        from rest_framework import serializers as drf

        with pytest.raises(drf.ValidationError) as exc:
            getattr(s, method)("   ")
        assert msg in str(exc.value)

    def test_password_debil_rechazada_por_validadores_django(self):
        s = UserCreateSerializer(data=_create_data(password="12345678"))
        assert not s.is_valid()
        assert "password" in s.errors

    def test_create_con_is_active_false_desactiva_usuario(self):
        s = UserCreateSerializer(data=_create_data(), context={"request": SimpleNamespace(user=SuperadminFactory())})
        assert s.is_valid(), s.errors
        u = s.save(is_active=False)
        assert u.is_active is False


class TestUserUpdateSerializer:
    def test_username_duplicado_ignorando_mayusculas(self):
        UserFactory(username="existente")
        otro = UserFactory(username="otro")
        s = UserUpdateSerializer(otro, data={"username": "EXISTENTE"}, partial=True)
        assert not s.is_valid()
        assert "username" in s.errors

    def test_username_vacio_en_validador(self):
        from rest_framework import serializers as drf

        with pytest.raises(drf.ValidationError):
            UserUpdateSerializer().validate_username("  ")

    def test_email_duplicado_y_normalizacion(self):
        UserFactory(username="a1", email="dup@example.com")
        b = UserFactory(username="b1", email="b1@example.com")
        s = UserUpdateSerializer(b, data={"email": "DUP@example.com"}, partial=True)
        assert not s.is_valid()
        assert "email" in s.errors
        ok = UserUpdateSerializer(b, data={"email": "  NUEVO@Example.com "}, partial=True)
        assert ok.is_valid(), ok.errors
        assert ok.validated_data["email"] == "nuevo@example.com"
        # mismo usuario conserva su correo
        same = UserUpdateSerializer(b, data={"email": "b1@example.com"}, partial=True)
        assert same.is_valid(), same.errors

    @pytest.mark.parametrize("method", ["validate_first_name", "validate_last_name"])
    def test_nombres_vacios(self, method):
        from rest_framework import serializers as drf

        with pytest.raises(drf.ValidationError):
            getattr(UserUpdateSerializer(), method)("   ")

    def test_nombres_validos_se_normalizan(self):
        s = UserUpdateSerializer()
        assert s.validate_first_name("  Ana  ") == "Ana"
        assert s.validate_last_name("  Ruiz ") == "Ruiz"


class TestPasswordChangeSerializer:
    def test_password_comun_rechazada(self):
        target = UserFactory()
        s = PasswordChangeSerializer(data={"new_password": "12345678"}, context={"target_user": target})
        assert not s.is_valid()
        assert "new_password" in s.errors

    def test_self_sin_current_password(self):
        target = UserFactory()
        req = SimpleNamespace(user=target)
        s = PasswordChangeSerializer(
            data={"new_password": "OtraClave#2026"}, context={"request": req, "target_user": target}
        )
        assert not s.is_valid()
        assert "current_password" in s.errors


class TestViewsBranches:
    def test_set_password_usa_serializer_de_cambio(self, api_client):
        from users.views import UserViewSet

        v = UserViewSet()
        v.action = "set_password"
        assert v.get_serializer_class() is PasswordChangeSerializer

    def test_queryset_vacio_para_usuario_no_modelo(self):
        from users.views import UserViewSet

        v = UserViewSet()
        v.request = SimpleNamespace(user=SimpleNamespace(is_authenticated=False))
        v.action = "list"
        assert v.get_queryset().count() == 0

    def test_admin_no_puede_cambiar_password_de_superadmin(self, auth_client):
        sa = SuperadminFactory()
        admin = AdminFactory()
        url = reverse("users:user-set-password", args=[sa.pk])
        r = auth_client(admin).post(url, {"new_password": "ClaveNueva#2026"}, format="json")
        assert r.status_code == 403

    def test_admin_no_puede_modificar_superadmin(self, auth_client):
        sa = SuperadminFactory()
        admin = AdminFactory()
        r = auth_client(admin).patch(reverse("users:user-detail", args=[sa.pk]), {"first_name": "X"}, format="json")
        assert r.status_code == 403

    def test_admin_no_puede_eliminar_superadmin(self, auth_client):
        sa = SuperadminFactory()
        admin = AdminFactory()
        r = auth_client(admin).delete(reverse("users:user-detail", args=[sa.pk]))
        assert r.status_code == 403

    def test_tecnico_no_puede_editar_a_otro(self, auth_client):
        r = auth_client(TecnicoFactory()).patch(
            reverse("users:user-detail", args=[TecnicoFactory().pk]), {"first_name": "X"}, format="json"
        )
        assert r.status_code == 403


class TestIsSelf:
    def test_permisos(self):
        u = UserFactory()
        req = SimpleNamespace(user=u)
        assert IsSelf().has_permission(req, None) is True
        assert IsSelf().has_permission(SimpleNamespace(user=None), None) is False
        assert IsSelf().has_object_permission(req, None, u) is True
        assert IsSelf().has_object_permission(req, None, UserFactory()) is False


class TestUserManagerSuperuser:
    def test_exige_is_staff_e_is_superuser(self):
        with pytest.raises(ValueError, match="is_staff"):
            User.objects.create_superuser("root", "root@example.com", "x", is_staff=False)
        with pytest.raises(ValueError, match="is_superuser"):
            User.objects.create_superuser("root2", "root2@example.com", "x", is_superuser=False)

    def test_manager_es_usermanager(self):
        assert isinstance(User.objects, UserManager)


class TestUserSerializerMisc:
    def test_mock_import_ok(self):
        assert mock is not None
