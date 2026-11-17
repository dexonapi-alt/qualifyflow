"""Dedicated local scan worker, so slow antivirus calls cannot delay intake/messages."""

import time
from app.documents.jobs import process_scans


if __name__ == "__main__":
    while True:
        try:
            completed = process_scans(limit=1)
            if completed:
                print(f"Evidence scan jobs completed: {completed}", flush=True)
        except Exception:
            print("Evidence worker unavailable; retrying database polling.", flush=True)
        time.sleep(3)
