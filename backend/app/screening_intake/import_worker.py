"""Dedicated local import worker: workbook scanning cannot delay other operation queues."""

import time
from app.screening_intake.background import process_pending


if __name__ == "__main__":
    while True:
        try:
            if process_pending():
                print("Background spreadsheet phase committed.", flush=True)
        except Exception:
            print("Background import worker unavailable; retrying database polling.", flush=True)
        time.sleep(2)
