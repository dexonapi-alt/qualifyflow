class DomainError(Exception):
    def __init__(self, code, message, status=400, fields=None):
        self.code, self.message, self.status, self.fields = code, message, status, fields or {}


def conflict():
    raise DomainError("CONFLICT", "This record changed. Refresh before trying again.", 409)
