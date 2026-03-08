"""Auth0 JWT validation for FastAPI endpoints."""
import os
import time
import httpx
from jose import jwt, JWTError
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")

_jwks_cache: dict = {}
_jwks_fetched_at: float = 0
_JWKS_TTL = 3600  # Re-fetch keys every hour

security = HTTPBearer(auto_error=False)


def _get_jwks() -> dict:
    global _jwks_cache, _jwks_fetched_at
    now = time.time()
    if _jwks_cache and (now - _jwks_fetched_at) < _JWKS_TTL:
        return _jwks_cache
    url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    _jwks_cache = resp.json()
    _jwks_fetched_at = now
    return _jwks_cache


def verify_token(token: str) -> dict:
    """Validate an Auth0 JWT. Returns the decoded payload."""
    try:
        jwks = _get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = {}
        for key in jwks.get("keys", []):
            if key["kid"] == unverified_header.get("kid"):
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
                break
        if not rsa_key:
            raise HTTPException(status_code=401, detail="Unable to find matching key")
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/",
        )
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token validation failed: {e}")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> dict | None:
    """FastAPI dependency — returns user payload if token present, None if not."""
    if not credentials:
        return None
    return verify_token(credentials.credentials)


def require_user(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> dict:
    """FastAPI dependency — requires a valid token, raises 401 if missing."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization required")
    return verify_token(credentials.credentials)
