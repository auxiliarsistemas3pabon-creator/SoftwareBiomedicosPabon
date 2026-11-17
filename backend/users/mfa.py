"""MFA por TOTP (RFC 6238) y registro de dispositivos, sin dependencias externas."""
import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

from django.core.cache import cache
from django.utils import timezone

from .models import TrustedDevice

DEVICE_COOKIE_NAME = "device_token"
DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
OTP_MAX_FAILURES = 5
OTP_LOCK_SECONDS = 15 * 60
ISSUER = "Biometricos"


def generate_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def _hotp(secret: str, counter: int) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{code:06d}"


def totp_now(secret: str, at: float | None = None) -> str:
    return _hotp(secret, int((at if at is not None else time.time()) // 30))


def verify_totp(secret: str, code: object, window: int = 1) -> bool:
    if not secret or not isinstance(code, str):
        return False
    code = code.strip().replace(" ", "")
    if len(code) != 6 or not code.isdigit():
        return False
    counter = int(time.time() // 30)
    return any(
        hmac.compare_digest(_hotp(secret, counter + d), code) for d in range(-window, window + 1)
    )


def provisioning_uri(user, secret: str) -> str:
    label = quote(f"{ISSUER}:{user.username}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(ISSUER)}&digits=6&period=30"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def find_trusted_device(user, token: str | None) -> TrustedDevice | None:
    if not token:
        return None
    dev = TrustedDevice.objects.filter(user=user, token_hash=hash_token(token), revoked=False).first()
    if dev:
        dev.last_used_at = timezone.now()
        dev.save(update_fields=["last_used_at"])
    return dev


def register_device(user, request) -> str:
    token = secrets.token_urlsafe(32)
    TrustedDevice.objects.create(
        user=user,
        token_hash=hash_token(token),
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:300],
        ip_address=request.META.get("REMOTE_ADDR") or None,
    )
    return token


def _fail_key(user) -> str:
    return f"mfa_fail:{user.pk}"


def is_locked(user) -> bool:
    return cache.get(_fail_key(user), 0) >= OTP_MAX_FAILURES


def record_failure(user) -> None:
    key = _fail_key(user)
    cache.set(key, cache.get(key, 0) + 1, OTP_LOCK_SECONDS)


def clear_failures(user) -> None:
    cache.delete(_fail_key(user))
