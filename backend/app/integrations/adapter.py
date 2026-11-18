"""Allowlisted local provider HTTP contract. No redirects, arbitrary hosts or legal decisions."""

import http.client
import json
from app.config import settings

SCHEMA = "qf-sandbox-v1"


class ProviderError(Exception):
    def __init__(self, code):
        self.code = code


def request(credential, method, path, body=None):
    connection = http.client.HTTPConnection("127.0.0.1", settings().provider_simulator_port, timeout=5)
    try:
        connection.request(
            method,
            path,
            body=json.dumps(body).encode() if body is not None else None,
            headers={"Authorization": "Bearer " + credential, "Content-Type": "application/json"},
        )
        response = connection.getresponse()
        if response.status != 200:
            raise ProviderError(
                {
                    401: "PROVIDER_AUTH_REJECTED",
                    403: "PROVIDER_AUTH_REJECTED",
                    429: "PROVIDER_RATE_LIMIT",
                }.get(response.status, "PROVIDER_UNAVAILABLE")
            )
        data = response.read(64001)
        if len(data) > 64000:
            raise ProviderError("PROVIDER_SCHEMA_INVALID")
        value = json.loads(data)
        if not isinstance(value, dict) or value.get("schema_version") != SCHEMA:
            raise ProviderError("PROVIDER_SCHEMA_INVALID")
        return value
    except (OSError, http.client.HTTPException):
        raise ProviderError("PROVIDER_UNAVAILABLE") from None
    except (ValueError, UnicodeError):
        raise ProviderError("PROVIDER_SCHEMA_INVALID") from None
    finally:
        connection.close()
