# Local synthetic provider and reporting

This sandbox uses actual HTTP transport and existing intake/review operations. It is not a commercial provider connector. Use synthetic records only. Ordinary assigned specialists can inspect connection diagnostics; whole-company employer administrators approve provider access and schedules. Provisioning administrators do not gain report access.

From `backend`, using the existing configured environment:

```powershell
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe scripts/prepare_provider_simulator.py
.venv/Scripts/python.exe -m uvicorn app.integrations.simulator:app --host 127.0.0.1 --port 8090 --no-access-log
```

Keep that service running. Its private account reference and credential are in ignored `.local/provider-simulator.json`; do not commit, log, screenshot or paste credentials into chat. The fixture serves one synthetic provider account. A page containing another company's records is rejected in full rather than attached across tenants. Separate commercial or multi-account adapters require their own contracts and mapping tests.

In another terminal, run the durable worker:

```powershell
.venv/Scripts/python.exe -m app.screening_intake.worker
```

This polls intake, in-app publication, scheduled provider pulls, provider jobs and private exports. Evidence scanning remains a separate `python -m app.documents.worker` process. Celery registers the same handlers; native local execution is the verified setup, not proof of a production Redis deployment.

1. In **Connections**, configure the private fixture account. Saving means **configured**.
2. Run **Test connection**. The separate service must return its authenticated account and supported schema before the state becomes **sandbox verified**.
3. Expand **Create a synthetic provider record**. Use the exact company driver reference and a synthetic report reference/date. This writes metadata at the provider; it does not upload evidence.
4. **Queue provider pull**. Inspect jobs and recorded runs using **Refresh connections**. Completed reception creates canonical Screening inbox receipts, preserving original provider envelopes and exact event IDs.
5. Open the actual receipt and driver file. Upload, scan and review evidence through the existing workflow. Reception never accepts evidence or creates a missing driver automatically.

The pull worker retries transient transport/429 failures with bounded backoff/jitter, five attempts maximum. Crash leases expire after two minutes. Authentication/schema/binding failures become visible dead letters; fix the cause and queue a new authorized pull. The unchanged cursor and stable event IDs prevent receipt duplication. A paused/revoked connection or revoked owner blocks queued work.

**Scheduled metadata pulls** defaults to preview only. Explicitly choose an interval and save approved scheduling to enable it. Dry run writes no schedule or intake. Pause, revoke, credential rotation and failed connection tests disable schedules. Current approver/owner permissions and the approved credential version are rechecked on each run. These rules queue metadata only; they cannot send correspondence, accept evidence or decide eligibility.

Webhook reception uses `/api/v1/provider-webhooks/{connection_id}` with `X-QF-Timestamp` and `X-QF-Signature`: HMAC-SHA256 over the decimal Unix timestamp, a period and the exact raw JSON body, using the separately issued signing key. Timestamp tolerance is five minutes. Schema is `qf-sandbox-v1`; account and client references must match the binding. A stable event ID plus canonical envelope fingerprint distinguishes an exact retry from a changed replay. Raw envelopes remain encrypted. Browser cookies do not authenticate a provider.

**Reports** shows scoped configured-evidence states. Request a purpose-labeled CSV and refresh until the actual worker completes it. Download expires in one hour and rechecks current permissions. Export history is private to the requesting user. Source documents and screening findings are not exported. The current local limits are 1000 assigned requirements/report and ten requests/user/hour.

Later: legitimate commercial-provider sandbox, multiple-account contract, scoped client API credentials, general rule automation, production object storage, external delivery approval, retention/holds/offboarding, restore/load drills and independent release reviews. None is implied by a successful local sandbox test.
