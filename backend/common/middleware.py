"""Cabeceras de seguridad adicionales para la API."""

PERMISSIONS_POLICY = (
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), "
    "interest-cohort=()"
)


class SecurityHeadersMiddleware:
    """Añade Permissions-Policy, Referrer-Policy y evita que las respuestas de la
    API (datos autenticados) queden en caché del navegador o de proxies."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault("Permissions-Policy", PERMISSIONS_POLICY)
        response.setdefault("Referrer-Policy", "same-origin")
        response.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if request.path.startswith("/api/") and not request.path.startswith(
            ("/api/docs", "/api/redoc", "/api/schema")
        ):
            response["Cache-Control"] = "no-store, max-age=0"
            response["Pragma"] = "no-cache"
        return response
