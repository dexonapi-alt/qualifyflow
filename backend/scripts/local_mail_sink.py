"""Loopback-only synthetic SMTP sink for native tests; never relays mail."""

from pathlib import Path
from aiosmtpd.controller import Controller
from email import policy
from email.parser import BytesParser
import json
import time
import argparse
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).parents[1]))
from app.db import engine
from inbox_view import render_messages

parser = argparse.ArgumentParser(description="Loopback synthetic inbox; never relays mail")
parser.add_argument("--dispatch", action="store_true", help="Poll the configured local development outbox")
args = parser.parse_args()

root = Path(__file__).parents[2] / ".local/mail"
root.mkdir(parents=True, exist_ok=True)


class Sink:
    async def handle_DATA(self, server, session, envelope):
        message = BytesParser(policy=policy.default).parsebytes(envelope.content)
        # Synthetic test artifacts only, excluded from Git.
        target = root / (str(time.time_ns()) + ".json")
        target.write_text(json.dumps({"to": envelope.rcpt_tos, "body": message.get_body().get_content()}))
        return "250 Local sink accepted"


controller = Controller(Sink(), hostname="127.0.0.1", port=1025)
controller.start()
print("Synthetic SMTP sink listening on 127.0.0.1:1025", flush=True)


class Inbox(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.headers.get("Host", "").lower() not in {"localhost:8025", "127.0.0.1:8025"}:
            self.send_error(403)
            return
        if self.path != "/":
            self.send_error(404)
            return
        try:
            with Session(engine()) as db:
                messages = render_messages(db, root)
        except Exception:
            self.send_error(503, "Current workspace unavailable. Retry after the database is ready.")
            return
        content = (
            '<!doctype html><html lang="en"><meta charset="utf-8"><title>QualifyFlow local inbox</title>'
            '<meta name="viewport" content="width=device-width">'
            "<style>body{font:16px/1.6 system-ui;max-width:900px;margin:40px auto;padding:20px}"
            "article{border-top:1px solid #ccc;padding:20px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}"
            "a{color:#1741c8}</style><h1>Local test inbox</h1>"
            '<p>Synthetic mail only. Messages stay on this computer. <a href="/">Refresh inbox</a></p>'
            + messages
            + "</html>"
        )
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(content.encode())

    def log_message(self, *args):
        pass


inbox = ThreadingHTTPServer(("127.0.0.1", 8025), Inbox)
threading.Thread(target=inbox.serve_forever, daemon=True).start()
print("Local inbox: http://localhost:8025", flush=True)
if args.dispatch:
    from app.worker import deliver_pending

try:
    while True:
        if args.dispatch:
            try:
                deliver_pending()
            except Exception:
                print("Outbox unavailable; retrying on next sweep.", flush=True)
        time.sleep(2)
except (KeyboardInterrupt, SystemExit):
    controller.stop()
    inbox.shutdown()
