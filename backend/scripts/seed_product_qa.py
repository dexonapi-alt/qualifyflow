"""Real HTTP/worker synthetic product journey, confined to the UI QA database."""

import base64
import json
import secrets
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).parents[1]))
import httpx
import pyotp
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import settings
from app.db import engine
from app.models import User, Tenant
from app.shared.security import encrypt, passwords
from app.documents.jobs import process_scans
from app.screening_intake.jobs import process_pending
from app.correspondence.jobs import publish_pending

if settings().database_url.rsplit("/", 1)[-1] != "qualifyflow_ui_test":
    raise RuntimeError("Refuse any database except qualifyflow_ui_test")
root = Path(__file__).parents[2]
account_path = root / ".local/ui-qa-accounts.json"
accounts = json.loads(account_path.read_text(encoding="utf-8-sig"))
for key, role in [("product_specialist", "specialist"), ("product_reviewer", "specialist")]:
    accounts.setdefault(
        key,
        {
            "email": f"{key.replace('_', '-')}@example.com",
            "password": secrets.token_urlsafe(20),
            "secret": pyotp.random_base32(),
        },
    )
    a = accounts[key]
    with Session(engine()) as db, db.begin():
        user = db.scalar(select(User).where(User.email == a["email"]))
        if not user:
            db.add(
                User(
                    email=a["email"],
                    password_hash=passwords.hash(a["password"]),
                    platform_role=role,
                    totp_secret=encrypt(a["secret"]),
                )
            )
        else:
            user.platform_role = role
account_path.write_text(json.dumps(accounts), encoding="utf8")


def request(client, path, data=None):
    response = (
        client.get(path)
        if data is None
        else client.post(path, json=data, headers={"X-CSRF-Token": client.cookies.get("qf_csrf", "")})
    )
    if response.status_code >= 400:
        message = response.json().get("error", {}).get("message", "Request failed")
        raise AssertionError(f"{path}: HTTP {response.status_code}: {message}")
    return response.json()


def login(key):
    a = accounts[key]
    with Session(engine()) as db, db.begin():
        user = db.scalar(select(User).where(User.email == a["email"]))
        user.last_totp_step = -1
    client = httpx.Client(
        base_url="http://127.0.0.1:8001/api/v1", headers={"Origin": "http://localhost:5174"}, timeout=150
    )
    request(
        client,
        "/auth/login",
        {"email": a["email"], "password": a["password"], "code": pyotp.TOTP(a["secret"]).now()},
    )
    return client


def pdf(reference, name):
    text = (
        f"Synthetic QA evidence. Driver: {name}. Company reference: {reference}. No real screening performed."
    )
    stream = f"BT /F1 12 Tf 40 740 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    data, positions = b"%PDF-1.4\n", [0]
    for number, obj in enumerate(objects, 1):
        positions.append(len(data))
        data += f"{number} 0 obj\n".encode() + obj + b"\nendobj\n"
    start = len(data)
    data += b"xref\n0 6\n0000000000 65535 f \n" + b"".join(
        f"{p:010} 00000 n \n".encode() for p in positions[1:]
    )
    return data + f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF".encode()


admin, client = login("admin"), login("client")
with Session(engine()) as db:
    tenant = db.scalar(select(Tenant).where(Tenant.customer_ref == "UI-QA-0"))
    tid = tenant.id
    staff = {
        key: db.scalar(select(User).where(User.email == accounts[key]["email"])).id
        for key in ("product_specialist", "product_reviewer")
    }
    recipient = db.scalar(select(User).where(User.email == accounts["client"]["email"])).id
base = "/tenants/" + tid
assignments = request(admin, base + "/operator-assignments")["items"]
for key, user_id in staff.items():
    if not any(a["email"] == accounts[key]["email"] and a["status"] == "active" for a in assignments):
        request(
            admin,
            base + "/operator-assignments",
            {"user_id": user_id, "reason": "Explicit synthetic product-review service assignment"},
        )
company = request(admin, base)
if company["status"] in {"draft", "configuring", "ready_for_review"}:
    request(
        admin,
        base + "/configuration",
        {
            "version": company["version"],
            "reason": "Synthetic managed-service process approved for QA",
            "policy_reference": "SYNTHETIC-PRODUCT-QA",
            "intake_owner": "service",
            "review_owner": "service",
            "integration_required": False,
        },
    )
    company = request(admin, base)
    request(
        admin,
        base + "/review",
        {"version": company["version"], "reason": "Review actual QA onboarding prerequisites"},
    )
    company = request(admin, base)
    request(
        admin,
        base + "/activate",
        {"version": company["version"], "reason": "Activate this synthetic UI QA company only"},
    )
company = request(client, base)
branch = company["branches"][0]["id"]
definitions = request(client, base + "/requirements")["items"]
configured = {}
for code, title in [("PRODUCT-SCREEN", "Screening record"), ("PRODUCT-IDENTITY", "Identity evidence")]:
    found = next((d for d in definitions if d["code"] == code), None)
    configured[code] = (
        found["id"]
        if found
        else request(
            client,
            base + "/requirements",
            {
                "code": code,
                "title": title,
                "category": "background_screening",
                "requires_expiry": False,
                "basis": "Synthetic QA document review only; no real screening or legal eligibility conclusion.",
            },
        )["id"]
    )
drivers, requirements = [], {}
for index, (first, last) in enumerate([("Jordan", "Ellis"), ("Casey", "Morgan"), ("Avery", "Patel")], 1):
    reference = f"PRODUCT-{index:03}"
    found = request(client, base + "/drivers/search", {"q": reference})["items"]
    driver = next((d for d in found if d["reference"] == reference), None)
    if not driver:
        driver = request(
            client,
            base + "/drivers",
            {
                "command_id": str(uuid4()),
                "reference": reference,
                "first_name": first,
                "last_name": last,
                "start_date": "2026-11-01",
                "branch_id": branch,
            },
        )
    did = driver["id"]
    detail = request(client, base + "/drivers/" + did)
    engagement = next(e for e in detail["engagements"] if e["end_date"] is None)
    file_base = base + "/drivers/" + did + "/file"
    for code, definition_id in configured.items():
        assigned = request(
            client,
            file_base + "/requirements",
            {"definition_id": definition_id, "engagement_id": engagement["id"]},
        )
        requirements[(index, code)] = assigned["id"]
    records = request(client, file_base)["items"]
    for row in records:
        if row["evidence"] or (index == 2 and row["code"] == "PRODUCT-IDENTITY"):
            continue
        request(
            client,
            file_base + "/requirements/" + row["id"] + "/evidence",
            {
                "command_id": str(uuid4()),
                "filename": f"synthetic-{reference.lower()}-evidence.pdf",
                "content_base64": base64.b64encode(pdf(reference, first + " " + last)).decode(),
            },
        )
    drivers.append(did)
process_scans(limit=10)  # Actual configured antivirus adapter; no fake clean results.
for index, did in enumerate(drivers, 1):
    file_base = base + "/drivers/" + did + "/file"
    for row in request(client, file_base)["items"]:
        for ev in row["evidence"]:
            if ev["status"] == "needs_review" and index != 3:
                request(
                    client,
                    file_base + "/requirements/" + row["id"] + "/evidence/" + ev["id"] + "/review",
                    {
                        "version": ev["version"],
                        "outcome": "verified_evidence",
                        "reason": "Synthetic QA document inspected for its matching test reference and one-page completeness. No real screening or eligibility determination.",
                        "identity_verified": True,
                        "category_verified": True,
                        "completeness_verified": True,
                    },
                )
specialist = login("product_specialist")
run_id = str(uuid4())[:8]
csv = "client_ref,external_driver_ref,report_type,external_report_ref,reported_at\n" + "\n".join(
    f"UI-QA-0,{reference},background_screening,PRODUCT-{run_id}-{i},2026-11-17"
    for i, reference in enumerate(["PRODUCT-002", "PRODUCT-003", ""], 1)
)
receipt = request(
    specialist, base + "/intake-batches", {"source": csv, "branch_id": branch, "command_id": str(uuid4())}
)
process_pending(limit=10)
work = request(specialist, base + "/exceptions")["items"]
with Session(engine()) as db:
    from app.models import IntakeItem, ExceptionCase

    item_ids = list(db.scalars(select(IntakeItem.id).where(IntakeItem.batch_id == receipt["id"])))
    case_ids = list(db.scalars(select(ExceptionCase.id).where(ExceptionCase.source_item_id.in_(item_ids))))
for case_id in case_ids:
    for state in ["assigned", "in_review"]:
        case = request(specialist, base + "/exceptions/" + case_id)
        request(
            specialist,
            base + "/exceptions/" + case_id + "/state",
            {
                "version": case["version"],
                "state": state,
                "reason": "Synthetic product QA specialist taking responsibility for source review.",
            },
        )
process = request(client, base + "/correspondence/policy")["policy"]
if not process:
    request(
        client,
        base + "/correspondence/policy",
        {
            "recipient_id": recipient,
            "expected_policy_id": None,
            "instructions": "Please respond through the authenticated client portal. This is a synthetic QA service process; no external email or legal decision is requested.",
        },
    )
pending_case = request(specialist, base + "/exceptions/" + case_ids[0])
message = request(
    specialist,
    base + "/exceptions/" + case_ids[0] + "/information-requests",
    {
        "command_id": str(uuid4()),
        "version": pending_case["version"],
        "body": "Please provide a clearer synthetic supporting record for PRODUCT-002. Our specialist will review the replacement before completing the file review.",
    },
)
messages = request(client, base + "/correspondence")["items"]
current = next(m for m in messages if m["id"] == message["id"])
request(
    client,
    base + "/correspondence/" + message["id"] + "/approve",
    {
        "version": current["version"],
        "reason": "Synthetic client approves this exact in-app content and intended recipient.",
    },
)
publish_pending()
invalid_case = next(
    request(specialist, base + "/exceptions/" + cid)
    for cid in case_ids
    if request(specialist, base + "/exceptions/" + cid)["category"] == "validation_failed"
)
approval = request(
    specialist,
    base + "/exceptions/" + invalid_case["id"] + "/approvals",
    {
        "version": invalid_case["version"],
        "proposal": "Administratively reject the malformed synthetic source row and retain the source history. This does not attach evidence or decide driver eligibility.",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
    },
)
home = request(client, base + "/workspace")
assert home["driver_total"] >= 3 and home["summary"]["needs_you"] >= 2
context = {
    "company_id": tid,
    "drivers": drivers,
    "receipt_id": receipt["id"],
    "case_ids": case_ids,
    "message_id": message["id"],
    "approval_id": approval["id"],
}
(root / ".local/product-review-context.json").write_text(json.dumps(context), encoding="utf8")
with Session(engine()) as db, db.begin():
    for a in accounts.values():
        user = db.scalar(select(User).where(User.email == a["email"]))
        if user:
            user.last_totp_step = -1
print(
    "Synthetic API/worker journey persisted in isolated UI QA: drivers, real antivirus scans, reviews, service ownership, client request and employer decision. Credentials remain private."
)
