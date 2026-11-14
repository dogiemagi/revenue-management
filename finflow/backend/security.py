"""Password hashing (scrypt), signed session cookies, simple rate limiting."""
import hashlib
import hmac
import os
import secrets
import time
from collections import defaultdict
from typing import Optional

from .models import DATA

SESSION_DAYS = 30


def _load_secret() -> str:
    if os.environ.get("SECRET"):
        return os.environ["SECRET"]
    f = DATA / "secret.key"
    if not f.exists():
        f.write_text(secrets.token_hex(32))
    return f.read_text().strip()


SECRET = _load_secret().encode()


def hash_pw(pw: str) -> str:
    salt = os.urandom(16)
    return salt.hex() + ":" + hashlib.scrypt(pw.encode(), salt=salt, n=16384, r=8, p=1, dklen=64).hex()


def check_pw(pw: str, stored: str) -> bool:
    try:
        salt, digest = stored.split(":")
        calc = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, dklen=64)
        return hmac.compare_digest(calc, bytes.fromhex(digest))
    except ValueError:
        return False


def _sign(s: str) -> str:
    return hmac.new(SECRET, s.encode(), hashlib.sha256).hexdigest()


def make_token(uid: int) -> str:
    payload = f"{uid}.{int((time.time() + SESSION_DAYS * 86400) * 1000)}"
    return payload + "." + _sign(payload)


def read_token(token: Optional[str]) -> Optional[int]:
    try:
        uid, exp, sig = (token or "").split(".")
        if not hmac.compare_digest(_sign(f"{uid}.{exp}"), sig) or int(exp) < time.time() * 1000:
            return None
        return int(uid)
    except ValueError:
        return None


_hits: dict[str, list[float]] = defaultdict(list)


def limited(ip: str, key: str, max_hits: int, window_s: float) -> bool:
    now = time.time()
    k = key + ip
    _hits[k] = [t for t in _hits[k] if now - t < window_s] + [now]
    return len(_hits[k]) > max_hits
