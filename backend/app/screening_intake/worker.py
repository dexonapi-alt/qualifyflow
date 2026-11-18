"""Local durable intake worker. Production uses the same handler through Celery."""

import time
from app.screening_intake.jobs import process_pending
from app.correspondence.jobs import publish_pending
from app.integrations.jobs import process_pending as process_provider, schedule_pending
from app.reporting.service import process_pending as process_exports


if __name__ == "__main__":
    while True:
        try:
            completed = process_pending()
            published = publish_pending()
            schedule_pending()
            provider_jobs = process_provider()
            process_exports()
            if provider_jobs:
                print(f"Provider pull attempts recorded: {provider_jobs}", flush=True)
            if published:
                print(f"In-app requests published: {published}", flush=True)
            if completed:
                print(f"Metadata receipt jobs completed: {completed}", flush=True)
        except Exception:
            # Database outages must not terminate recovery polling or disclose payloads.
            print("Intake worker unavailable; retrying database polling.", flush=True)
        time.sleep(3)
