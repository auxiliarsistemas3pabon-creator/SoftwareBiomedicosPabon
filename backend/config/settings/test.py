"""Settings para ejecutar la suite de pruebas (Postgres desechable, sin Redis/SMTP/S3)."""
from .dev import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "qa", "USER": "qa", "PASSWORD": "qa",
        "HOST": "127.0.0.1", "PORT": "55432",
    }
}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CELERY_TASK_ALWAYS_EAGER = True
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
MFA_REQUIRED = False  # las pruebas de MFA lo activan explicitamente
