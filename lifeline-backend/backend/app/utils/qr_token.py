"""app/utils/qr_token.py

Cryptographically secure token generation for the emergency QR feature.
Uses Python's `secrets` module — never `random`.
"""
import secrets


def generate_qr_token() -> str:
    """Return a 32-byte URL-safe, base64-encoded random token.

    secrets.token_urlsafe(32) produces 43 characters of [A-Za-z0-9_-].
    The token is suitable for embedding in a URL path segment and has
    ~192 bits of entropy, making brute-force scanning computationally
    infeasible even without a rate limit.
    """
    return secrets.token_urlsafe(32)
