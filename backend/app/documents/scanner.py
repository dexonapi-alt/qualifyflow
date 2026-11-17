"""Real local antivirus adapters. Failure is never reported as a clean scan."""

import os
import socket
import struct
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from app.config import settings


def scan(content):
    if os.name == "nt":
        executable = (
            Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Windows Defender" / "MpCmdRun.exe"
        )
        if not executable.is_file():
            return "scan_failed", "microsoft_defender", "SCANNER_UNAVAILABLE"
        workspace = Path(__file__).resolve().parents[3]
        root = (workspace / ".local" / "quarantine").resolve()
        if not root.is_relative_to(workspace):
            return "scan_failed", "microsoft_defender", "QUARANTINE_PATH_UNAVAILABLE"
        root.mkdir(parents=True, exist_ok=True)
        try:
            with TemporaryDirectory(prefix="scan-", dir=root) as directory:
                if not Path(directory).resolve().is_relative_to(root):
                    raise OSError("Quarantine temporary path escaped its root")
                source = Path(directory) / "evidence.bin"
                source.write_bytes(content)
                result = subprocess.run(
                    [str(executable), "-Scan", "-ScanType", "3", "-File", str(source), "-DisableRemediation"],
                    capture_output=True,
                    timeout=120,
                    creationflags=subprocess.CREATE_NO_WINDOW,
                )
                # Remediation disabled: a nonzero exit is never treated as safe.
                if result.returncode == 0 and source.is_file() and source.read_bytes() == content:
                    return "needs_review", "microsoft_defender", None
                return "scan_failed", "microsoft_defender", "SCANNER_DID_NOT_CLEAR_FILE"
        except (OSError, subprocess.TimeoutExpired):
            return "scan_failed", "microsoft_defender", "SCANNER_UNAVAILABLE_OR_TIMEOUT"
    try:
        with socket.create_connection(
            (settings().clamav_host, settings().clamav_port), timeout=10
        ) as connection:
            connection.settimeout(120)
            connection.sendall(b"zINSTREAM\0")
            for start in range(0, len(content), 65536):
                block = content[start : start + 65536]
                connection.sendall(struct.pack(">I", len(block)) + block)
            connection.sendall(struct.pack(">I", 0))
            response = b""
            while len(response) < 4096 and not response.endswith(b"\0"):
                block = connection.recv(1024)
                if not block:
                    break
                response += block
            if response == b"stream: OK\0":
                return "needs_review", "clamav", None
            return "scan_failed", "clamav", "SCANNER_DID_NOT_CLEAR_FILE"
    except OSError:
        return "scan_failed", "clamav", "SCANNER_UNAVAILABLE_OR_TIMEOUT"
