# Local development
Synthetic data only. No production/staging startup is enabled.

For the prepared manual-testing instance, start with [manual-testing.md](manual-testing.md). Generated local account details are in ignored .local/LOCAL_LOGIN.md. Native inbox http://localhost:8025 now works without Mailpit/Docker using `python scripts/local_mail_sink.py --dispatch`; it polls the actual development outbox. This is local synthetic delivery, not a production email provider or Redis worker verification.

## Native Windows path (tested environment)
1. Install Python 3.12+, uv, Node 24 and PostgreSQL 18. From root: `uv sync --project backend`. Backend venv is backend/.venv.
2. Copy .env.example to .env; generate ENCRYPTION_KEY using backend/.venv/Scripts/python.exe and cryptography. Never commit .env or print its contents in logs.
3. Initialize isolated workspace DB: `initdb -D .local/postgres -U qualifyflow --auth=trust --encoding=UTF8 --no-locale`. Local synthetic loopback only; trust authentication must never be used on a network/production service.
4. `pg_ctl -D .local/postgres -l .local/postgres.log -o "-p 55432 -h 127.0.0.1" start`. Create qualifyflow and qualifyflow_test with createdb on that port. Do not alter existing service on 5432.
5. In backend: `.venv/Scripts/alembic.exe upgrade head` then `.venv/Scripts/uvicorn.exe app.main:app --host 127.0.0.1 --port 8000`.
6. Set BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD (12+ chars), BOOTSTRAP_TOTP_SECRET (valid base32) in environment and run `.venv/Scripts/python.exe -m app.cli bootstrap`. Default role service_admin. Repeat with distinct email and BOOTSTRAP_ROLE=specialist for service assignment. Secrets must be user-generated, never committed. Register seed in authenticator; login rejects reuse of same 30-second code.
7. In frontend: `npm ci`, `npm run dev`. Open http://localhost:5173 (configured origin). Create a company draft, branches, responsibilities; invite administrator, assign specialist. Use local mail sink for invite; review/activate only once prerequisites pass.
8. Mailpit provides SMTP on 1025/UI 8025. Worker: `celery -A app.worker:celery_app worker --beat --pool=solo --loglevel=warning` with Redis, or manually `python -m app.worker` for one durable outbox sweep. No real email endpoints allowed.
9. Tests: backend `.venv/Scripts/python.exe -m pytest -q`, `.venv/Scripts/ruff.exe check app tests`; frontend `npm run build`, `npm run test:e2e`. Test suite truncates ONLY a database whose name ends _test. Never point it at development/customer data.
10. Stop isolated DB: `pg_ctl -D .local/postgres stop`. Keep .local outside Git; it holds only synthetic state.

## Native browser verification
Use a separate database named qualifyflow_e2e_test on 55432. In backend set DATABASE_URL to that database, migrate, then `python scripts/seed_e2e.py`. Seed credentials are generated into ignored .local/e2e-accounts.json; never commit or upload it. Start API using this same DATABASE_URL and ENCRYPTION_KEY, plus `python scripts/local_mail_sink.py` in another terminal. Start Vite at localhost:5173. In frontend set the same DATABASE_URL then `npm run test:e2e`. Browser tests call the actual worker and read only synthetic local SMTP artifacts; no invitation token bypass endpoint exists. Install test Chromium using `npx playwright install chromium`. Screenshots appear in .local/screenshots. Reset login replay counter for repeated runs using seed_e2e.py rather than weakening authentication.

CI workflows define backend, frontend and browser jobs. They have not been executed on GitHub in this session; local equivalents have separate recorded evidence.

## Compose path (not yet executed on this host)
Set .env credentials/key. `docker compose up --build` starts API/web/worker/Postgres/Redis/Mailpit/MinIO. Frontend is localhost:5173; Mailpit localhost:8025. No database/Redis public ports. MinIO console loopback only; document workflow not yet enabled. Compose is local infrastructure, not a production deployment. Build/image availability/startup must be verified on a Docker-capable host.

## Delivery recovery
Invitation status queued means pending, sent means local SMTP accepted, send_failed means retry scheduled or exhausted. Worker tries at most 5 times; admin Resend creates a new token and cancels unsent old intents. Revoke invalidates pending invitation. SMTP has an ambiguous crash-after-acceptance window; stable Message-ID alone cannot prove exactly-once email. Production delivery requires idempotent provider/reconciliation before release.
