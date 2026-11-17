from typing import TYPE_CHECKING

from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from .managers import UserManager

phone_validator = RegexValidator(
    regex=r"^\+?[0-9\s\-()]{7,20}$",
    message=_("El teléfono no tiene un formato válido."),
)


class User(AbstractUser):
    if TYPE_CHECKING:
        def get_role_display(self) -> str: ...

    class Role(models.TextChoices):
        SUPERADMIN = "superadmin", _("Superadministrador")
        ADMIN = "admin", _("Administrador")
        COORDINADOR = "coordinador", _("Coordinador")
        INGENIERO = "ingeniero", _("Ingeniero biomédico")
        TECNICO = "tecnico", _("Usuario operativo")
        USUARIO = "usuario", _("Usuario")

    email = models.EmailField(_("Correo electrónico"), unique=True)
    first_name = models.CharField(_("Nombres"), max_length=150)
    last_name = models.CharField(_("Apellidos"), max_length=150)
    role = models.CharField(
        _("Rol"),
        max_length=20,
        choices=Role.choices,
        default=Role.TECNICO,
    )
    phone = models.CharField(
        _("Teléfono"),
        max_length=30,
        blank=True,
        validators=[phone_validator],
    )
    area = models.CharField(
        _("Área"),
        max_length=120,
        blank=True,
        help_text=_("Área de servicio del usuario operativo (ej. Radiología). Vacío para el resto de roles."),
    )

    totp_secret = models.CharField(_("Secreto TOTP"), max_length=64, blank=True, editable=False)
    mfa_enabled = models.BooleanField(_("MFA activo"), default=False)

    REQUIRED_FIELDS = ["email", "first_name", "last_name", "role"]

    objects = UserManager()

    class Meta:
        verbose_name = _("Usuario")
        verbose_name_plural = _("Usuarios")
        ordering = ["username"]
        indexes = [
            models.Index(fields=["role"], name="user_role_idx"),
            models.Index(fields=["is_active"], name="user_is_active_idx"),
            models.Index(fields=["email"], name="user_email_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.username} ({self.get_role_display()})"

    @property
    def is_admin_role(self) -> bool:
        return self.role in {self.Role.SUPERADMIN, self.Role.ADMIN}


class TrustedDevice(models.Model):
    """Navegador/dispositivo registrado tras superar el MFA. Solo se guarda el
    hash del token; el token en claro vive en una cookie httpOnly del navegador."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="trusted_devices")
    token_hash = models.CharField(max_length=64, unique=True)
    user_agent = models.CharField(max_length=300, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now_add=True)
    revoked = models.BooleanField(default=False)

    class Meta:
        verbose_name = _("Dispositivo registrado")
        verbose_name_plural = _("Dispositivos registrados")
        ordering = ["-last_used_at"]

    def __str__(self) -> str:
        return f"{self.user_id} - {self.user_agent[:40]}"
