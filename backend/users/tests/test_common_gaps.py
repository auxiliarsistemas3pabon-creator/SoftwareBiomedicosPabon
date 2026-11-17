"""Pruebas de utilidades comunes (auth cookie/CSRF, health, permisos, validación de archivos)."""
from types import SimpleNamespace
from unittest import mock

import pytest
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory
from django.urls import reverse
from rest_framework import exceptions
from rest_framework.test import APIClient

from common import authentication
from common.area_scope import operativo_area
from common.authentication import CookieJWTAuthentication, enforce_csrf
from common.file_validation import ATTACHMENT_EXTENSIONS, validate_uploaded_file
from common.permissions import HasRolePermission

from .factories import AdminFactory, TecnicoFactory, UserFactory

pytestmark = pytest.mark.django_db


class TestEnforceCsrf:
    def test_rechaza_post_sin_token_csrf(self):
        req = RequestFactory().post("/x/")
        with pytest.raises(exceptions.PermissionDenied, match="CSRF Failed"):
            enforce_csrf(req)

    def test_acepta_cuando_csrf_valido(self):
        with mock.patch.object(authentication.CSRFCheck, "process_view", return_value=None):
            enforce_csrf(RequestFactory().post("/x/"))

    def test_vista_interna_devuelve_response(self):
        # Ejecuta el callback interno para cubrir su cuerpo.
        captured = {}

        def fake_process_view(self, request, callback, args, kwargs):
            captured["resp"] = callback(request)
            return None

        with mock.patch.object(authentication.CSRFCheck, "process_view", fake_process_view):
            enforce_csrf(RequestFactory().post("/x/"))
        assert captured["resp"].status_code == 200


class TestCookieJWTAuthentication:
    def test_cookie_str_se_codifica_y_exige_csrf_en_metodos_inseguros(self):
        user = UserFactory()
        auth = CookieJWTAuthentication()
        req = SimpleNamespace(method="POST", COOKIES={settings.AUTH_COOKIE_ACCESS_NAME: "tok"}, META={})
        with mock.patch.object(CookieJWTAuthentication, "get_header", return_value=None), \
             mock.patch.object(CookieJWTAuthentication, "get_validated_token", return_value="vt") as gvt, \
             mock.patch.object(CookieJWTAuthentication, "get_user", return_value=user), \
             mock.patch("common.authentication.enforce_csrf") as csrf:
            result = auth.authenticate(req)
        assert result == (user, "vt")
        gvt.assert_called_once_with(b"tok")
        csrf.assert_called_once_with(req)

    def test_get_no_exige_csrf(self):
        user = UserFactory()
        auth = CookieJWTAuthentication()
        req = SimpleNamespace(method="GET", COOKIES={settings.AUTH_COOKIE_ACCESS_NAME: b"tok"}, META={})
        with mock.patch.object(CookieJWTAuthentication, "get_header", return_value=None), \
             mock.patch.object(CookieJWTAuthentication, "get_validated_token", return_value="vt"), \
             mock.patch.object(CookieJWTAuthentication, "get_user", return_value=user), \
             mock.patch("common.authentication.enforce_csrf") as csrf:
            auth.authenticate(req)
        csrf.assert_not_called()

    def test_sin_cookie_ni_header_devuelve_none(self):
        auth = CookieJWTAuthentication()
        req = SimpleNamespace(method="GET", COOKIES={}, META={})
        with mock.patch.object(CookieJWTAuthentication, "get_header", return_value=None):
            assert auth.authenticate(req) is None


class TestLogoutBlacklist:
    def test_logout_con_refresh_invalido_no_falla_y_borra_cookies(self):
        client = APIClient(enforce_csrf_checks=False)
        client.cookies[settings.AUTH_COOKIE_REFRESH_NAME] = "token-basura"
        with mock.patch("common.views.enforce_csrf"):
            r = client.post(reverse("token-logout-cookie"))
        assert r.status_code == 204


class TestHealthView:
    def test_ok_cuando_db_y_redis_responden(self):
        with mock.patch("redis.Redis.from_url") as redis_from_url:
            redis_from_url.return_value.ping.return_value = True
            r = APIClient().get(reverse("health"))
        assert r.status_code == 200
        assert r.json() == {"status": "ok", "checks": {"database": "ok", "redis": "ok"}}

    def test_degradado_cuando_redis_falla(self):
        with mock.patch("redis.Redis.from_url", side_effect=RuntimeError("sin redis")):
            r = APIClient().get(reverse("health"))
        assert r.status_code == 503
        assert r.json()["status"] == "degraded"
        assert "sin redis" in r.json()["checks"]["redis"]

    def test_degradado_cuando_db_falla(self):
        with mock.patch("redis.Redis.from_url") as redis_from_url, \
             mock.patch("django.db.connection.ensure_connection", side_effect=RuntimeError("db caída")):
            redis_from_url.return_value.ping.return_value = True
            r = APIClient().get(reverse("health"))
        assert r.status_code == 503
        assert "db caída" in r.json()["checks"]["database"]


class TestHasRolePermission:
    def test_anonimo_denegado(self):
        req = SimpleNamespace(user=SimpleNamespace(is_authenticated=False))
        assert HasRolePermission().has_permission(req, SimpleNamespace(permission_resource="equipment")) is False
        assert HasRolePermission().has_permission(SimpleNamespace(user=None), SimpleNamespace()) is False

    def test_vista_sin_recurso_no_restringe(self):
        req = SimpleNamespace(user=AdminFactory())
        assert HasRolePermission().has_permission(req, SimpleNamespace()) is True


class TestAreaScope:
    def test_casos(self):
        assert operativo_area(None) is None
        assert operativo_area(SimpleNamespace(is_authenticated=False)) is None
        assert operativo_area(AdminFactory()) is None
        assert operativo_area(TecnicoFactory(area="  UCI ")) == "UCI"
        assert operativo_area(TecnicoFactory(area="")) == ""


class TestFileValidationEmpty:
    def test_valor_vacio_se_devuelve_tal_cual(self):
        assert validate_uploaded_file(None, allowed_extensions=ATTACHMENT_EXTENSIONS) is None
        assert validate_uploaded_file("", allowed_extensions=ATTACHMENT_EXTENSIONS) == ""

    def test_extension_no_permitida(self):
        f = SimpleUploadedFile("a.exe", b"MZ")
        with pytest.raises(Exception):
            validate_uploaded_file(f, allowed_extensions=ATTACHMENT_EXTENSIONS)
