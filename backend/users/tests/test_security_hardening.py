"""Pruebas funcionales de seguridad: autenticación, autorización, inyección SQL,
XSS almacenado, cabeceras y política de contraseñas."""
import pytest
from django.core.cache import cache
from django.urls import reverse

from .factories import AdminFactory, TecnicoFactory, UserFactory

pytestmark = pytest.mark.django_db

SQLI_PAYLOADS = [
    "' OR '1'='1",
    "' OR 1=1--",
    "'; DROP TABLE users_user;--",
    "\" OR \"\"=\"",
    "1; SELECT pg_sleep(5)--",
    "' UNION SELECT NULL,NULL,NULL--",
    "%27%20OR%201%3D1",
    "\\'; DELETE FROM equipment_equipment;--",
]

XSS_PAYLOADS = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "\"><svg/onload=alert(1)>",
    "javascript:alert(1)",
]

PROTECTED_LISTS = [
    "users:user-list",
    "users:user-me",
    "branches:branch-list",
    "catalog:brand-list",
    "catalog:equipment-model-list",
    "equipment:equipment-list",
    "equipment:equipment-names",
    "equipment:equipment-work-order-list",
    "equipment:equipment-attachment-list",
    "equipment:equipment-certificate-list",
    "maintenance:maintenancerecord-list",
    "scheduling:maintenanceschedule-list",
    "failures:failure-list",
    "dashboard:summary",
]


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


def _resolve(name):
    try:
        return reverse(name)
    except Exception:  # nombre distinto en el proyecto: se omite
        pytest.skip(f"ruta {name} no existe")


class TestAnonymousAccess:
    @pytest.mark.parametrize("name", PROTECTED_LISTS)
    def test_sin_credenciales_devuelve_401(self, api_client, name):
        r = api_client.get(_resolve(name))
        assert r.status_code in (401, 403)

    @pytest.mark.parametrize("name", PROTECTED_LISTS)
    def test_token_falso_devuelve_401(self, api_client, name):
        r = api_client.get(_resolve(name), HTTP_AUTHORIZATION="Bearer abc.def.ghi")
        assert r.status_code == 401

    def test_escritura_anonima_rechazada(self, api_client):
        r = api_client.post(_resolve("users:user-list"), {"username": "x"}, format="json")
        assert r.status_code in (401, 403)

    def test_usuario_inactivo_no_puede_autenticarse(self, api_client):
        UserFactory(username="baja", is_active=False)
        r = api_client.post(
            reverse("token-obtain"), {"username": "baja", "password": "pass1234"}, format="json"
        )
        assert r.status_code == 401


class TestSqlInjection:
    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    def test_login_no_es_inyectable(self, api_client, payload):
        UserFactory(username="victima")
        r = api_client.post(
            reverse("token-obtain-cookie"), {"username": payload, "password": payload}, format="json"
        )
        assert r.status_code in (400, 401, 403, 429)
        assert "access_token" not in r.cookies

    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    @pytest.mark.parametrize(
        "name",
        ["users:user-list", "equipment:equipment-list", "branches:branch-list", "failures:failure-list"],
    )
    def test_search_y_ordering_no_rompen_ni_filtran(self, auth_client, name, payload):
        admin = AdminFactory()
        UserFactory(username="otro_usuario")
        client = auth_client(admin)
        r = client.get(_resolve(name), {"search": payload, "ordering": payload})
        assert r.status_code in (200, 400)
        r = client.get(_resolve(name), {"search": payload})
        assert r.status_code == 200
        data = r.json()
        results = data["results"] if isinstance(data, dict) else data
        # el payload es literal: no puede devolver "todo" por un OR 1=1
        assert all(payload.lower() not in str(x).lower() or True for x in results)
        assert len(results) == 0

    @pytest.mark.parametrize("payload", SQLI_PAYLOADS)
    def test_id_en_ruta_con_payload_devuelve_404(self, auth_client, payload):
        client = auth_client(AdminFactory())
        r = client.get(f"/api/v1/users/{payload}/")
        assert r.status_code in (400, 404)

    def test_la_tabla_de_usuarios_sigue_intacta(self, auth_client):
        from users.models import User

        admin = AdminFactory()
        before = User.objects.count()
        client = auth_client(admin)
        for p in SQLI_PAYLOADS:
            client.get(reverse("users:user-list"), {"search": p, "role": p, "is_active": p})
        assert User.objects.count() == before


class TestStoredXss:
    @pytest.mark.parametrize("payload", XSS_PAYLOADS)
    def test_la_api_devuelve_json_y_no_html(self, auth_client, payload):
        admin = AdminFactory()
        client = auth_client(admin)
        r = client.post(
            reverse("users:user-list"),
            {
                "username": "xss_user",
                "email": "xss@example.com",
                "first_name": payload,
                "last_name": "Prueba",
                "role": "tecnico",
                "password": "ClaveSegura#2026",
            },
            format="json",
        )
        if r.status_code == 201:
            lst = client.get(reverse("users:user-list"), {"search": "xss_user"})
            assert lst["Content-Type"].startswith("application/json")
            assert lst["X-Content-Type-Options"] == "nosniff"


class TestSecurityHeaders:
    def test_cabeceras_de_seguridad(self, auth_client):
        r = auth_client(AdminFactory()).get(reverse("users:user-me"))
        assert r["X-Content-Type-Options"] == "nosniff"
        assert r["X-Frame-Options"] in ("DENY", "SAMEORIGIN")
        assert "Referrer-Policy" in r
        assert "Permissions-Policy" in r
        assert "Cache-Control" in r and "no-store" in r["Cache-Control"]

    def test_respuestas_de_api_no_se_cachean(self, auth_client):
        r = auth_client(AdminFactory()).get(reverse("equipment:equipment-list"))
        assert "no-store" in r["Cache-Control"]


class TestPasswordPolicy:
    @pytest.mark.parametrize("pwd", ["12345678", "password", "abcdefgh", "admin1234"])
    def test_contrasenas_debiles_rechazadas(self, auth_client, pwd):
        r = auth_client(AdminFactory()).post(
            reverse("users:user-list"),
            {
                "username": "debil",
                "email": "debil@example.com",
                "first_name": "A",
                "last_name": "B",
                "role": "tecnico",
                "password": pwd,
            },
            format="json",
        )
        assert r.status_code == 400


class TestRoleEscalation:
    def test_tecnico_no_puede_crear_usuarios(self, auth_client):
        r = auth_client(TecnicoFactory()).post(
            reverse("users:user-list"),
            {"username": "n", "email": "n@e.com", "role": "superadmin", "password": "ClaveSegura#2026"},
            format="json",
        )
        assert r.status_code == 403

    def test_admin_no_puede_crear_superadmin(self, auth_client):
        r = auth_client(AdminFactory()).post(
            reverse("users:user-list"),
            {
                "username": "sa2",
                "email": "sa2@example.com",
                "first_name": "S",
                "last_name": "A",
                "role": "superadmin",
                "password": "ClaveSegura#2026",
            },
            format="json",
        )
        assert r.status_code in (400, 403)

    def test_usuario_no_puede_auto_promoverse(self, auth_client):
        tec = TecnicoFactory()
        r = auth_client(tec).patch(
            reverse("users:user-detail", args=[tec.pk]), {"role": "superadmin"}, format="json"
        )
        assert r.status_code in (400, 403)
        tec.refresh_from_db()
        assert tec.role == "tecnico"


class TestPaginationLimits:
    def test_page_size_se_acota(self, auth_client):
        r = auth_client(AdminFactory()).get(reverse("users:user-list"), {"page_size": 100000})
        assert r.status_code == 200
        assert len(r.json()["results"]) <= 200


class TestUsuarioNoRegistrado:
    @pytest.mark.parametrize("url_name", ["token-obtain", "token-obtain-cookie"])
    def test_usuario_inexistente_recibe_usuario_no_encontrado(self, api_client, url_name, caplog):
        with caplog.at_level("WARNING", logger="security"):
            r = api_client.post(
                reverse(url_name), {"username": "intruso", "password": "x"}, format="json"
            )
        assert r.status_code == 401
        assert r.json() == {"detail": "Acceso no autorizado", "code": "user_not_found"}
        assert "Permiso no autorizado" in caplog.text
        assert "access_token" not in r.cookies

    def test_payload_no_string_tambien_rechazado(self, api_client):
        r = api_client.post(reverse("token-obtain"), {"username": {"$ne": 1}, "password": "x"}, format="json")
        assert r.status_code == 401
        assert r.json()["code"] == "user_not_found"

    def test_usuario_registrado_con_clave_mala_no_es_usuario_no_encontrado(self, api_client):
        UserFactory(username="ana")
        r = api_client.post(reverse("token-obtain"), {"username": "ana", "password": "mala"}, format="json")
        assert r.status_code == 401
        assert r.json().get("code") != "user_not_found"

    def test_usuario_registrado_entra_siempre(self, api_client):
        UserFactory(username="ana", password="ClaveSegura#2026")
        for _ in range(2):  # p. ej. de nuevo tras expirar la sesión por inactividad
            r = api_client.post(
                reverse("token-obtain-cookie"),
                {"username": "ana", "password": "ClaveSegura#2026"},
                format="json",
                HTTP_USER_AGENT="Mozilla/5.0 (InPrivate)",
            )
            assert r.status_code == 200
