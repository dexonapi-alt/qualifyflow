"""Bounded, non-executing CSV/XLSX metadata adapter. No document acceptance."""

import base64
import csv
from datetime import date, datetime
import io
import re
from pathlib import PurePosixPath
from zipfile import ZipFile
from defusedxml.ElementTree import fromstring
from app.shared.errors import DomainError
from app.documents import scanner

MAX_FILE = 256000
FIELDS = ["client_ref", "external_driver_ref", "report_type", "external_report_ref", "reported_at"]


def invalid(message):
    raise DomainError("INVALID_SPREADSHEET", message, 422)


def inspect_file(
    filename, encoded, sheet=None, *, max_rows=100, max_file=MAX_FILE, max_csv=64000, max_expanded=2_000_000
):
    try:
        content = base64.b64decode(encoded, validate=True)
    except ValueError:
        invalid("Choose a valid CSV or XLSX file.")
    if not content or len(content) > max_file:
        invalid(f"Choose a metadata file up to {max_file} bytes (CSV up to {max_csv} bytes).")
    extension = PurePosixPath(filename.replace("\\", "/")).suffix.lower()
    numeric = []
    if extension == ".csv":
        if len(content) > max_csv:
            invalid(f"CSV metadata is limited to {max_csv} bytes.")
        try:
            text = content.decode("utf-8-sig")
            rows = list(csv.reader(io.StringIO(text), strict=True))
        except (UnicodeError, csv.Error):
            invalid("Use a UTF-8 CSV with valid quoting.")
        sheets, selected = ["CSV"], "CSV"
    elif extension == ".xlsx":
        # No XML or Office parser runs before archive quotas and real antivirus clearance.
        try:
            with ZipFile(io.BytesIO(content)) as archive:
                entries = archive.infolist()
                names = [e.filename for e in entries]
                if (
                    len(entries) > 128
                    or len(set(names)) != len(names)
                    or sum(e.file_size for e in entries) > max_expanded
                ):
                    invalid("Workbook exceeds the bounded metadata archive limits.")
                if "xl/workbook.xml" not in names or "[Content_Types].xml" not in names:
                    invalid("The file is not an XLSX workbook.")
                for entry in entries:
                    name = entry.filename.lower()
                    if (
                        entry.flag_bits & 1
                        or name.startswith("/")
                        or ".." in PurePosixPath(name).parts
                        or any(v in name for v in ("vbaproject", "externallinks/", "embeddings/", "media/"))
                    ):
                        invalid(
                            "Use an unencrypted workbook without macros, external links or embedded files."
                        )
                state, _, _ = scanner.scan(content)
                if state != "needs_review":
                    raise DomainError(
                        "SCAN_UNAVAILABLE",
                        "The workbook did not clear its security scan. Retry when scanning is available or use a plain metadata CSV.",
                        409,
                    )
                for entry in entries:
                    if entry.filename.endswith((".xml", ".rels")):
                        xml = archive.read(entry)
                        root = fromstring(xml)
                        for node in root.iter():
                            if node.tag.rsplit("}", 1)[-1] == "c":
                                coordinate = node.attrib.get("r", "")
                                letters = re.match(r"[A-Z]+", coordinate)
                                if letters:
                                    column = 0
                                    for letter in letters.group():
                                        column = column * 26 + ord(letter) - 64
                                    if column > 32:
                                        invalid("Use at most 32 worksheet columns.")
                        if any(
                            node.tag.rsplit("}", 1)[-1] == "f" or node.attrib.get("TargetMode") == "External"
                            for node in root.iter()
                        ):
                            invalid(
                                "Formula cells and external relationships are not allowed. Export values-only metadata instead."
                            )
            from openpyxl import load_workbook

            book = load_workbook(io.BytesIO(content), read_only=True, data_only=False, keep_links=False)
            try:
                sheets = book.sheetnames
                if len(sheets) > 5:
                    invalid("Use a workbook with at most five worksheets.")
                selected = sheet or sheets[0]
                if selected not in sheets:
                    invalid("Select a worksheet from this workbook.")
                ws = book[selected]
                ws.reset_dimensions()
                rows = []
                for row_number, cells in enumerate(ws.iter_rows(max_col=33), 1):
                    if row_number > max_rows + 1:
                        invalid(f"A worksheet supports a header and up to {max_rows} metadata rows.")
                    values, numeric_columns = [], []
                    for column, cell in enumerate(cells):
                        value = cell.value
                        if cell.data_type in {"f", "e"}:
                            invalid("Use values-only cells without formulas or spreadsheet errors.")
                        if isinstance(value, datetime):
                            value = value.date().isoformat()
                        elif isinstance(value, date):
                            value = value.isoformat()
                        elif isinstance(value, (int, float)) and not isinstance(value, bool):
                            numeric_columns.append(column)
                            value = str(value)
                            if (
                                re.fullmatch(r"0{2,32}", cell.number_format or "")
                                and float(cell.value).is_integer()
                                and 0 <= cell.value < 10**15
                            ):
                                value = str(int(cell.value)).zfill(len(cell.number_format))
                                numeric_columns.remove(column)
                        values.append("" if value is None else str(value))
                    while values and not values[-1]:
                        values.pop()
                    rows.append(values)
                    numeric.append(numeric_columns)
            finally:
                book.close()
        except DomainError:
            raise
        except Exception:
            # Parser/library details and source contents do not leak through validation errors.
            invalid("Workbook could not be read safely. Use a simple values-only XLSX or UTF-8 CSV.")
    else:
        invalid("Choose a .csv or .xlsx metadata file; legacy XLS and macro workbooks are unsupported.")
    if (
        not rows
        or len(rows) < 2
        or len(rows) > max_rows + 1
        or not any(any(v for v in row) for row in rows[1:])
    ):
        invalid(f"Include one header row and between 1 and {max_rows} metadata rows.")
    headers = rows[0]
    if not headers or len(headers) > 32 or any(not h.strip() or len(h) > 100 or "\x00" in h for h in headers):
        invalid("Use 1–32 nonempty column headers, each up to 100 characters.")
    if any(len(row) > len(headers) or any(len(v) > 500 or "\x00" in v for v in row) for row in rows[1:]):
        invalid(
            "Rows must fit the header and contain metadata cells up to 500 characters, without null bytes."
        )
    return {
        "columns": headers,
        "rows": [r + [""] * (len(headers) - len(r)) for r in rows[1:]],
        "sheets": sheets,
        "sheet": selected,
        "numeric": numeric[1:] if numeric else [],
    }, content


def canonical_source(table, mapping, company_reference, *, max_bytes=64000):
    if set(mapping) != set(FIELDS):
        invalid("Map all five metadata fields.")
    used = []
    for field, index in mapping.items():
        if index == -1 and field == "client_ref":
            continue
        if not 0 <= index < len(table["columns"]) or index in used:
            invalid(
                "Choose one distinct source column per field; only company reference may use the selected company."
            )
        used.append(index)
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(FIELDS)
    for number, row in enumerate(table["rows"]):
        numeric = table["numeric"][number] if table["numeric"] else []
        if any(mapping[f] in numeric for f in ["client_ref", "external_driver_ref", "external_report_ref"]):
            invalid(
                "Identifier columns must be stored as text or explicit zero-padded identifiers in Excel. This preserves leading zeros and avoids guessing numeric IDs."
            )
        writer.writerow([company_reference if mapping[f] == -1 else row[mapping[f]] for f in FIELDS])
    value = output.getvalue()
    if len(value.encode("utf8")) > max_bytes:
        invalid(f"Mapped metadata exceeds {max_bytes} bytes. Split the source into smaller imports.")
    return value
