"""Independent synthetic provider HTTP service. Bind ONLY to127.0.0.1."""

import hmac
import json
from pathlib import Path
from threading import Lock
from uuid import uuid4
from fastapi import FastAPI, Request, HTTPException, Query
from app.shared.security import encrypt, decrypt
from app.integrations.adapter import SCHEMA
from app.screening_intake.routes import HEADERS

ROOT = Path(__file__).resolve().parents[3] / ".local"
CREDENTIAL_FILE = ROOT / "provider-simulator.json"
RECORD_FILE = ROOT / "provider-simulator-reports.encrypted"
LOCK = Lock()
app = FastAPI(title="QualifyFlow synthetic provider — local only")


def account(request):
    try:
        config = json.loads(CREDENTIAL_FILE.read_text(encoding="utf8"))
    except (OSError, ValueError):
        raise HTTPException(503, "Prepare local synthetic provider credentials first") from None
    supplied = request.headers.get("authorization", "")
    if not hmac.compare_digest(supplied, "Bearer " + config["credential"]):
        raise HTTPException(401, "Synthetic provider authentication rejected")
    return config


def records():
    return json.loads(decrypt(RECORD_FILE.read_text(encoding="ascii"))) if RECORD_FILE.exists() else []


@app.get("/v1/account")
def whoami(request: Request):
    config = account(request)
    return {"schema_version": SCHEMA, "environment": "local_synthetic", "account_ref": config["account_ref"]}


@app.get("/v1/reports")
def reports(request: Request, cursor: int = Query(0, ge=0, le=1000)):
    account(request)
    with LOCK:
        events = records()
    if cursor > len(events):
        raise HTTPException(409, "Cursor is beyond retained synthetic source")
    page = events[cursor : cursor + 50]
    return {"schema_version": SCHEMA, "events": page, "next_cursor": cursor + len(page)}


@app.post("/v1/reports")
async def create(request: Request):
    config = account(request)
    raw = bytearray()
    async for part in request.stream():
        raw.extend(part)
        if len(raw) > 4000:
            raise HTTPException(413, "Synthetic record too large")
    try:
        data = json.loads(raw)
    except ValueError:
        raise HTTPException(422, "Invalid synthetic JSON") from None
    if (
        not isinstance(data, dict)
        or set(data) != set(HEADERS)
        or any(not isinstance(v, str) or len(v) > 200 for v in data.values())
    ):
        raise HTTPException(422, "Use the five bounded canonical metadata fields")
    event = {
        "schema_version": SCHEMA,
        "event_id": str(uuid4()),
        "account_ref": config["account_ref"],
        "record": data,
    }
    with LOCK:
        events = records()
        if len(events) >= 1000:
            raise HTTPException(429, "Local synthetic provider quota reached")
        events.append(event)
        ROOT.mkdir(exist_ok=True)
        pending = RECORD_FILE.with_suffix(".pending")
        pending.write_text(encrypt(json.dumps(events)), encoding="ascii")
        pending.replace(RECORD_FILE)
    return {"schema_version": SCHEMA, "event": event}
