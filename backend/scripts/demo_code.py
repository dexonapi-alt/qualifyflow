"""Print a current TOTP for an explicitly requested synthetic local demo account."""

from pathlib import Path
import argparse
import json
import pyotp

parser = argparse.ArgumentParser()
parser.add_argument("role", choices=["admin", "specialist"], default="admin", nargs="?")
args = parser.parse_args()
accounts = json.loads((Path(__file__).parents[2] / ".local/demo-accounts.json").read_text())
print(pyotp.TOTP(accounts[args.role]["secret"]).now())
