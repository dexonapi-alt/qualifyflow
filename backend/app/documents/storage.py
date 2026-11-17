"""Private encrypted local object adapter; never mounted as a static directory."""

import base64
from pathlib import Path
from uuid import UUID
from app.shared.security import encrypt, decrypt
from app.config import settings

ROOT = Path(settings().private_object_dir).resolve()


def object_path(key):
    name = str(UUID(key))
    path = (ROOT / (name + ".encrypted")).resolve()
    if not path.is_relative_to(ROOT.resolve()):
        raise OSError("Private object path is outside its storage root")
    return path


def put(key, content):
    ROOT.mkdir(parents=True, exist_ok=True)
    path = object_path(key)
    # O_EXCL semantics: immutable object keys can never overwrite earlier evidence.
    with path.open("x", encoding="ascii") as target:
        target.write(encrypt(base64.b64encode(content).decode("ascii")))


def get(key):
    return base64.b64decode(decrypt(object_path(key).read_text(encoding="ascii")), validate=True)
