import { useRef, useState } from "react";
import { api, type Branch } from "./api";
import { Icon } from "./UI";
import { State } from "./Forms";
import { MappingLibrary } from "./MappingTemplates";

const fields = [
  "client_ref",
  "external_driver_ref",
  "report_type",
  "external_report_ref",
  "reported_at",
] as const;
const labels: Record<string, string> = {
  client_ref: "Company reference",
  external_driver_ref: "Driver reference",
  report_type: "Report type",
  external_report_ref: "Report reference",
  reported_at: "Reported date",
};
type Source = { filename: string; content_base64: string };
type Inspection = {
  columns: string[];
  sheets: string[];
  sheet: string;
  sample: string[][];
  row_count: number;
};
type PreviewRow = {
  row_number: number;
  normalized: Record<string, string>;
  status: string;
  reason: string;
};

export function SpreadsheetImport({
  base,
  branches,
  branchId,
  companyReference,
  canManageMappings,
  onReceived,
  onCancel,
}: {
  base: string;
  branches: Branch[];
  branchId: string | null;
  companyReference: string;
  canManageMappings: boolean;
  onReceived: (id: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [source, setSource] = useState<Source | null>(null),
    [inspection, setInspection] = useState<Inspection | null>(null),
    [sheet, setSheet] = useState("");
  const [mapping, setMapping] = useState<Record<string, number>>({}),
    [preview, setPreview] = useState<PreviewRow[] | null>(null),
    [branch, setBranch] = useState(branchId || "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const command = useRef(crypto.randomUUID());
  const [templateRevision, setTemplateRevision] = useState<string | null>(null);
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function inspect(selectedSheet?: string) {
    if (!source) throw new Error("Choose a metadata CSV or XLSX first.");
    const result = await api<Inspection>(base + "/spreadsheet/inspect", {
      ...source,
      branch_id: branch || null,
      sheet: selectedSheet || null,
    });
    setInspection(result);
    setSheet(result.sheet);
    setPreview(null);
    setTemplateRevision(null);
    command.current = crypto.randomUUID();
    setMapping(
      Object.fromEntries(
        fields.map((f) => [
          f,
          result.columns.includes(f) ? result.columns.indexOf(f) : -2,
        ]),
      ),
    );
  }
  const step = preview ? 2 : inspection ? 1 : 0;
  return (
    <section
      className="spreadsheet-import"
      aria-label="Spreadsheet import"
      aria-busy={busy}
    >
      <header className="import-heading">
        <div>
          <h3>Bring in client records</h3>
          <p>Map metadata, check each row, then send it for review.</p>
        </div>
        <button className="quiet" disabled={busy} onClick={onCancel}>
          Cancel import
        </button>
      </header>
      <ol className="import-steps" aria-label="Import progress">
        {["Choose file", "Map columns", "Check rows", "Record receipt"].map(
          (label, i) => (
            <li key={label} aria-current={step === i ? "step" : undefined}>
              <span>{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
              {label}
            </li>
          ),
        )}
      </ol>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <fieldset disabled={busy}>
        <div className="import-source-controls">
          <label htmlFor="mapped-branch">
            Intake location
            <select
              id="mapped-branch"
              value={branch}
              onChange={(e) => {
                setTemplateRevision(null);
                setBranch(e.target.value);
                setPreview(null);
                command.current = crypto.randomUUID();
              }}
            >
              {!branchId && <option value="">Whole company</option>}
              {branches
                .filter(
                  (b) =>
                    b.status === "active" && (!branchId || b.id === branchId),
                )
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </label>
          <label htmlFor="mapped-file">
            Client metadata file
            <input
              id="mapped-file"
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setInspection(null);
                setTemplateRevision(null);
                setPreview(null);
                setSource(null);
                setError("");
                if (!file) return;
                void act(async () => {
                  if (file.size > 256000)
                    throw new Error(
                      "Choose a metadata file up to 256 KB (CSV up to 64 KB).",
                    );
                  const bytes = new Uint8Array(await file.arrayBuffer());
                  let text = "";
                  for (let i = 0; i < bytes.length; i += 32768)
                    text += String.fromCharCode(
                      ...bytes.subarray(i, i + 32768),
                    );
                  setSource({
                    filename: file.name,
                    content_base64: btoa(text),
                  });
                });
              }}
            />
            <small>
              UTF-8 CSV or values-only XLSX · up to 100 rows and 32 columns. Use
              text for identifiers. XLSX files require a security scan.
            </small>
          </label>
        </div>
        {!inspection && (
          <button
            disabled={!source || busy}
            onClick={() => void act(() => inspect())}
          >
            {busy ? "Checking file…" : "Inspect spreadsheet"}
            <Icon name="arrow" size={15} />
          </button>
        )}
        {inspection && (
          <>
            <div className="import-source-summary">
              <Icon name="file" size={18} />
              <strong>{source?.filename}</strong>
              <span>{inspection.row_count} rows</span>
              {inspection.sheets.length > 1 && (
                <label>
                  Worksheet
                  <select
                    aria-label="Worksheet"
                    value={sheet}
                    onChange={(e) => void act(() => inspect(e.target.value))}
                  >
                    {inspection.sheets.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <MappingLibrary
              base={base}
              branch={branch}
              columns={inspection.columns}
              canManage={canManageMappings}
              onManual={() => {
                setTemplateRevision(null);
                setPreview(null);
                command.current = crypto.randomUUID();
              }}
              onApply={(saved, id) => {
                setMapping(saved);
                setTemplateRevision(id);
                setPreview(null);
                command.current = crypto.randomUUID();
              }}
            />
            <div className="import-mapping">
              <div>
                <h4>Connect your columns</h4>
                <p>
                  Choose the source column for each field. Report types use the
                  existing metadata categories; dates must be ISO dates or Excel
                  date cells.
                </p>
              </div>
              <div className="mapping-fields">
                {fields.map((f) => (
                  <label key={f}>
                    {labels[f]}
                    <select
                      value={mapping[f] ?? -2}
                      aria-label={"Source column for " + labels[f]}
                      onChange={(e) => {
                        setMapping((m) => ({
                          ...m,
                          [f]: Number(e.target.value),
                        }));
                        setTemplateRevision(null);
                        setPreview(null);
                        command.current = crypto.randomUUID();
                      }}
                    >
                      <option value={-2}>Select a column</option>
                      {f === "client_ref" && (
                        <option value={-1}>
                          Selected company: {companyReference}
                        </option>
                      )}
                      {inspection.columns.map((c, i) => (
                        <option key={i} value={i}>
                          {i + 1}. {c}
                        </option>
                      ))}
                    </select>
                    <small>
                      {mapping[f] >= 0
                        ? inspection.sample[0]?.[mapping[f]] ||
                          "First row is empty"
                        : f === "client_ref" && mapping[f] === -1
                          ? companyReference
                          : "No source selected"}
                    </small>
                  </label>
                ))}
              </div>
            </div>
            <button
              className={preview ? "secondary" : ""}
              onClick={() =>
                void act(async () => {
                  const result = await api<{ items: PreviewRow[] }>(
                    base + "/spreadsheet/preview",
                    {
                      ...source,
                      sheet,
                      mapping,
                      branch_id: branch || null,
                      template_revision_id: templateRevision,
                    },
                  );
                  setPreview(result.items);
                })
              }
            >
              {busy ? "Validating…" : "Preview mapped rows"}
            </button>
          </>
        )}
      </fieldset>
      {preview && (
        <section className="import-preview">
          <header>
            <h4>Check before recording</h4>
            <span>
              {preview.length} rows ·{" "}
              {preview.filter((r) => r.status === "validation_failed").length}{" "}
              invalid
            </span>
          </header>
          <div
            className="table-scroll"
            role="region"
            aria-label="Mapped row preview"
            tabIndex={0}
          >
            <table className="management-table">
              <thead>
                <tr>
                  <th scope="col">Source row</th>
                  <th scope="col">Driver / report</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">What needs checking</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.row_number}>
                    <td>{r.row_number}</td>
                    <td>
                      {r.normalized.external_driver_ref}
                      <small>{r.normalized.external_report_ref}</small>
                    </td>
                    <td>
                      <State value={r.status} />
                    </td>
                    <td>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="import-confirm">
            <p>
              The original file, worksheet, column map and every row outcome are
              preserved privately. Invalid rows remain available for correction.
              Nothing is attached to a driver file by importing.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const result = await api<{ id: string }>(
                    base + "/spreadsheet/receive",
                    {
                      ...source,
                      sheet,
                      mapping,
                      branch_id: branch || null,
                      command_id: command.current,
                      template_revision_id: templateRevision,
                    },
                  );
                  await onReceived(result.id);
                })
              }
            >
              {busy ? "Recording…" : "Confirm mapped receipt"}
              <Icon name="arrow" size={15} />
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
