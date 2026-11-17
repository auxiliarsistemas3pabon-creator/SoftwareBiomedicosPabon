"""MFA obligatorio (TOTP) y dispositivos registrados."""
import pytest
from django.conf import settings
from django.core.cache import cache
from django.urls import reverse

from users import mfa
from users.models import TrustedDevice

from .factories import AdminFactory, SuperadminFactory, UserFactory

pytestmark = pytest.mark.django_db

PWD = "ClaveSegura#2026"
URL = reverse("token-obtain-cookie")
CLASSIC = reverse("token-obtain")


@pytest.fixture(autouse=True)
def _mfa_on(settings):
    settings.MFA_REQUIRED = True
    cache.clear()
    yield
    cache.clear()


def _login(client, username="ana", otp=None, url=URL, **extra):
    body = {"username": username, "password": PWD}
    if otp is not None:
        body["otp"] = otp
    return client.post(url, body, format="json", **extra)


@pytest.fixture
def ana(db):
    return UserFactory(username="ana", password=PWD)


class TestTotp:
    def test_vector_rfc6238(self):
        # RFC 6238, secreto "12345678901234567890" y T=59 -> 94287082 (6 dígitos: 287082)
        import base64

        secret = base64.b32encode(b"12345678901234567890").decode().rstrip("=")
        assert mfa.totp_now(secret, at=59) == "287082"

    def test_verify_rechaza_basura(self):
        s = mfa.generate_secret()
        for bad in (None, 123456, "", "abc", "12345", "1234567", "12 34 5x"):
            assert mfa.verify_totp(s, bad) is False
        assert mfa.verify_totp(s, mfa.totp_now(s)) is True


class TestEnrolamiento:
    def test_primer_login_pide_configurar_y_no_da_sesion(self, api_client, ana):
        r = _login(api_client)
        assert r.status_code == 401
        body = r.json()
        assert body["code"] == "mfa_setup_required"
        assert body["otpauth_uri"].startswith("otpauth://totp/")
        assert "access_token" not in r.cookies and "refresh_token" not in r.cookies
        ana.refresh_from_db()
        assert ana.mfa_enabled is False and ana.totp_secret == body["secret"]

    def test_confirmar_codigo_activa_mfa_y_registra_dispositivo(self, api_client, ana):
        secret = _login(api_client).json()["secret"]
        r = _login(api_client, otp=mfa.totp_now(secret))
        assert r.status_code == 200
        assert "access_token" in r.cookies and mfa.DEVICE_COOKIE_NAME in r.cookies
        assert r.cookies[mfa.DEVICE_COOKIE_NAME]["httponly"]
        ana.refresh_from_db()
        assert ana.mfa_enabled is True
        assert TrustedDevice.objects.filter(user=ana).count() == 1

    def test_codigo_incorrecto_en_enrolamiento(self, api_client, ana):
        _login(api_client)
        r = _login(api_client, otp="000000")
        assert r.status_code == 401 and r.json()["code"] == "mfa_invalid"
        ana.refresh_from_db()
        assert ana.mfa_enabled is False


class TestDispositivos:
    def _enrolar(self, client, user):
        secret = _login(client, user.username).json()["secret"]
        user.refresh_from_db()
        return secret

    def test_dispositivo_registrado_entra_sin_codigo(self, api_client, ana):
        secret = self._enrolar(api_client, ana)
        assert _login(api_client, otp=mfa.totp_now(secret)).status_code == 200
        # mismo navegador (cookie de dispositivo conservada): solo usuario+clave
        assert _login(api_client).status_code == 200

    def test_navegador_nuevo_o_incognito_pide_codigo_pero_registrado_puede_entrar(self, api_client, ana):
        from rest_framework.test import APIClient

        secret = self._enrolar(api_client, ana)
        assert _login(api_client, otp=mfa.totp_now(secret)).status_code == 200
        incognito = APIClient()  # sin cookie de dispositivo
        r = _login(incognito, HTTP_USER_AGENT="Mozilla/5.0 InPrivate")
        assert r.status_code == 401 and r.json()["code"] == "mfa_required"
        assert _login(incognito, otp=mfa.totp_now(secret)).status_code == 200
        assert TrustedDevice.objects.filter(user=ana).count() == 2

    def test_dispositivo_revocado_vuelve_a_pedir_codigo(self, api_client, ana):
        secret = self._enrolar(api_client, ana)
        _login(api_client, otp=mfa.totp_now(secret))
        TrustedDevice.objects.update(revoked=True)
        r = _login(api_client)
        assert r.status_code == 401 and r.json()["code"] == "mfa_required"

    def test_cookie_de_dispositivo_ajena_no_sirve(self, api_client, ana):
        from rest_framework.test import APIClient

        other = UserFactory(username="beto", password=PWD)
        sec_ana = self._enrolar(api_client, ana)
        _login(api_client, otp=mfa.totp_now(sec_ana))
        stolen = api_client.cookies[mfa.DEVICE_COOKIE_NAME].value
        self._enrolar(APIClient(), other)
        c = APIClient()
        c.cookies[mfa.DEVICE_COOKIE_NAME] = stolen
        r = _login(c, "beto")
        assert r.status_code == 401  # el token es de otro usuario

    def test_clave_incorrecta_no_revela_estado_de_mfa(self, api_client, ana):
        r = api_client.post(URL, {"username": "ana", "password": "mala"}, format="json")
        assert r.status_code == 401
        assert r.json().get("code") not in {"mfa_required", "mfa_setup_required"}


class TestFuerzaBruta:
    def test_bloqueo_tras_5_codigos_invalidos(self, api_client, ana):
        secret = _login(api_client).json()["secret"]
        for _ in range(mfa.OTP_MAX_FAILURES):
            assert _login(api_client, otp="000000").status_code == 401
        r = _login(api_client, otp=mfa.totp_now(secret))
        assert r.status_code == 429 and r.json()["code"] == "mfa_locked"


class TestClasicoYReset:
    def test_endpoint_clasico_tambien_exige_codigo_y_no_registra_dispositivo(self, api_client, ana):
        secret = _login(api_client, url=CLASSIC).json()["secret"]
        r = _login(api_client, url=CLASSIC, otp=mfa.totp_now(secret))
        assert r.status_code == 200 and "access" in r.json()
        assert TrustedDevice.objects.count() == 0
        r2 = _login(api_client, url=CLASSIC)
        assert r2.status_code == 401 and r2.json()["code"] == "mfa_required"

    def test_secreto_nunca_se_expone_en_la_api(self, auth_client, ana):
        ana.totp_secret = mfa.generate_secret()
        ana.save()
        r = auth_client(AdminFactory()).get(reverse("users:user-detail", args=[ana.pk]))
        assert "totp_secret" not in r.json() and ana.totp_secret not in r.content.decode()

    def test_admin_restablece_mfa(self, auth_client, ana):
        ana.totp_secret = mfa.generate_secret()
        ana.mfa_enabled = True
        ana.save()
        dev = TrustedDevice.objects.create(user=ana, token_hash="x" * 64)
        r = auth_client(AdminFactory()).post(reverse("users:user-reset-mfa", args=[ana.pk]))
        assert r.status_code == 204
        ana.refresh_from_db()
        dev.refresh_from_db()
        assert ana.mfa_enabled is False and ana.totp_secret == "" and dev.revoked is True

    def test_admin_no_restablece_mfa_de_superadmin_y_tecnico_no_puede(self, auth_client, ana):
        sa = SuperadminFactory()
        assert auth_client(AdminFactory()).post(reverse("users:user-reset-mfa", args=[sa.pk])).status_code == 403
        assert auth_client(ana).post(reverse("users:user-reset-mfa", args=[ana.pk])).status_code == 403

    def test_mfa_desactivado_por_configuracion(self, api_client, ana, settings):
        settings.MFA_REQUIRED = False
        assert _login(api_client).status_code == 200
        assert settings.AUTH_COOKIE_ACCESS_NAME in api_client.cookies
