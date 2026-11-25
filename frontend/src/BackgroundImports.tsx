import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, type Branch } from "./api";
import { MappingLibrary } from "./MappingTemplates";
import { State } from "./Forms";
import { Icon } from "./UI";

type Job = {
  id: string;
  filename: string;
  created_at: string;
  branch_id: string | null;
  status: string;
  phase: string;
  version: number;
  attempts: number;
  error_code: string | null;
  row_count: number;
  recorded_rows: number;
  sha256: string;
  can_manage: boolean;
  can_confirm: boolean;
  can_retry: boolean;
  can_map: boolean;
  can_cancel: boolean;
  inspection: {
    columns: string[];
    sheets: string[];
    sheet: string;
    sample: string[][];
  } | null;
  configuration: {
    sheet?: string;
    mapping?: Record<string, number>;
    template_revision_id?: string | null;
  };
  preview: {
    total: number;
    offset: number;
    counts: Record<string, number>;
    items: {
      row_number: number;
      status: string;
      reason: string;
      normalized: Record<string, string>;
    }[];
  } | null;
  parts: { batch_id: string; first_row: number; last_row: number }[];
};
const fields = {
  client_ref: "Company reference",
  external_driver_ref: "Driver reference",
  report_type: "Report type",
  external_report_ref: "Report reference",
  reported_at: "Reported date",
};
const errors: Record<string, string> = {
  IMPORT_SOURCE_UNREADABLE: "The stored source could not be opened safely. Keep the import reference and ask an authorized administrator to investigate. Any recorded receipt parts remain available.",
  IMPORT_INTEGRITY_ERROR: "The stored source failed its integrity check. Keep the import reference and ask an authorized administrator to investigate before further processing.",
  INVALID_SPREADSHEET:
    "The source could not be read safely within the file, row or worksheet limits. Review the source and queue a new copy.",
  SCAN_UNAVAILABLE:
    "The workbook did not clear its security scan. Retry when scanning is available; no rows from this phase were recorded.",
  IMPORT_WORKER_FAILED:
    "Processing stopped unexpectedly. Recorded receipt parts are retained; retry resumes the unrecorded part.",
  IMPORT_LEASE_EXPIRED:
    "Worker recovery reached its attempt limit. Recorded receipt parts are retained. Escalate the stopped import.",
  MAPPING_CHANGED:
    "The saved mapping changed or was retired. Previously recorded receipts remain. Use a new import with a reviewed mapping for the remaining work.",
  CURRENT_AUTHORIZATION_DENIED:
    "The uploader no longer has the access required to process this import.",
  NOT_FOUND:
    "The uploader's current access no longer permits this processing step.",
  FORBIDDEN:
    "The uploader's current access no longer permits this processing step.",
};
function phaseText(job: Job) {
  if (job.status === "completed") return "Metadata receipts recorded";
  if (job.status === "canceled") return "Remaining processing stopped";
  if (job.status === "failed") return "Processing needs attention";
  if (job.status === "awaiting_mapping") return "Choose your column mapping";
  if (job.status === "awaiting_confirmation")
    return "Review rows before recording";
  return (
    (job.status === "queued" ? "Queued: " : "Working: ") +
    ({
      inspect: "inspect source file",
      validate: "validate mapped rows",
      record: "record receipt parts",
    }[job.phase] || job.phase)
  );
}

export function BackgroundImports({
  base,
  branches,
  branchId,
  companyReference,
  onClose,
  onOpenReceipt,
}: {
  base: string;
  branches: Branch[];
  branchId: string | null;
  companyReference: string;
  onClose: () => void;
  onOpenReceipt: (id: string) => void;
}) {
  const endpoint = base.replace("/intake-batches", "/spreadsheet-imports");
  const [jobs, setJobs] = useState<Job[] | null>(null),
    [job, setJob] = useState<Job | null>(null),
    [revision, refresh] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [source, setSource] = useState<{
      filename: string;
      content_base64: string;
    } | null>(null),
    [branch, setBranch] = useState(branchId || ""),
    [sheet, setSheet] = useState("");
  const [mapping, setMapping] = useState<Record<string, number>>({}),
    [template, setTemplate] = useState<string | null>(null),
    [offset, setOffset] = useState(0);
  const [editMapping, setEditMapping] = useState(false);
  const command = useRef(crypto.randomUUID()),
    errorSummary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorSummary.current?.focus();
  }, [error]);
  useEffect(() => {
    let active = true;
    void api<{ items: Job[] }>(endpoint)
      .then((r) => {
        if (active) setJobs(r.items);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [endpoint, revision]);
  useEffect(() => {
    if (!job || !["queued", "processing"].includes(job.status)) return;
    let active = true,
      inflight = false;
    const timer = setInterval(() => {
      if (inflight) return;
      inflight = true;
      void api<Job>(endpoint + "/" + job.id)
        .then((r) => {
          if (active) {
            setJob(r);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          inflight = false;
        });
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [endpoint, job?.id, job?.status]);
  useEffect(() => {
    if (!job?.can_map || !job.inspection) return;
    setEditMapping(false);
    setMapping(
      job.configuration.mapping ||
        Object.fromEntries(
          Object.keys(fields).map((f) => [
            f,
            job.inspection!.columns.includes(f)
              ? job.inspection!.columns.indexOf(f)
              : -2,
          ]),
        ),
    );
    setTemplate(job.configuration.template_revision_id || null);
  }, [job?.id, job?.version]);
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
  async function load(id: string, nextOffset = 0) {
    setJob(await api<Job>(endpoint + "/" + id + "?offset=" + nextOffset));
    setOffset(nextOffset);
  }
  async function action(name: string, payload: object = {}) {
    if (!job) return;
    await api(endpoint + "/" + job.id + "/" + name, {
      version: job.version,
      ...payload,
    });
    await load(job.id);
    refresh((n) => n + 1);
  }
  async function queue(e: FormEvent) {
    e.preventDefault();
    if (!source) return;
    await act(async () => {
      const result = await api<{ id: string }>(endpoint, {
        ...source,
        command_id: command.current,
        branch_id: branch || null,
        sheet: sheet || null,
      });
      await load(result.id);
      setSource(null);
      refresh((n) => n + 1);
    });
  }
  const mappingClean =
    !!job &&
    (!job.can_manage ||
      (Object.keys(fields).every(
        (key) => mapping[key] === job.configuration.mapping?.[key],
      ) &&
        (template || null) ===
          (job.configuration.template_revision_id || null)));
  return (
    <section className="background-imports" aria-busy={busy}>
      <header className="import-heading">
        <div>
          <h2>Background spreadsheet imports</h2>
          <p>
            Queue larger handoffs, review their mapping, then confirm metadata
            receipt processing.
          </p>
        </div>
        <button type="button" className="secondary" onClick={onClose}>
          Back to screening inbox
        </button>
      </header>
      {error && (
        <p className="error" role="alert" ref={errorSummary} tabIndex={-1}>
          {error}
        </p>
      )}
      {!job ? (
        <>
          <form
            onSubmit={(e) => void queue(e)}
            className="background-upload"
            aria-label="Queue background import"
          >
            <fieldset disabled={busy}>
              <legend>New background import</legend>
              <p>
                CSV or values-only XLSX · up to 2 MB and 1,000 selected-sheet
                rows. The private source is preserved; inspection runs in a
                separate worker.
              </p>
              <div className="background-upload-grid">
                <label>
                  Intake location
                  <select
                    aria-label="Background intake location"
                    value={branch}
                    onChange={(e) => {
                      setBranch(e.target.value);
                      command.current = crypto.randomUUID();
                    }}
                  >
                    {!branchId && <option value="">Whole company</option>}
                    {branches
                      .filter(
                        (b) =>
                          b.status === "active" &&
                          (!branchId || b.id === branchId),
                      )
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Worksheet name (optional)
                  <input
                    value={sheet}
                    maxLength={64}
                    onChange={(e) => {
                      setSheet(e.target.value);
                      command.current = crypto.randomUUID();
                    }}
                  />
                  <small>Leave empty to inspect the first worksheet.</small>
                </label>
              </div>
              <label>
                Spreadsheet file
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setSource(null);
                    command.current = crypto.randomUUID();
                    if (!file) return;
                    void act(async () => {
                      if (file.size > 2_000_000)
                        throw new Error("Choose a CSV or XLSX up to 2 MB.");
                      const bytes = new Uint8Array(await file.arrayBuffer());
                      let raw = "";
                      for (let i = 0; i < bytes.length; i += 32768)
                        raw += String.fromCharCode(
                          ...bytes.subarray(i, i + 32768),
                        );
                      setSource({
                        filename: file.name,
                        content_base64: btoa(raw),
                      });
                    });
                  }}
                />
              </label>
              <button disabled={busy || !source}>
                {busy ? "Queuing…" : "Queue private file"}
              </button>
            </fieldset>
          </form>
          <section className="background-history">
            <div className="import-heading">
              <h3>Recent uploads</h3>
              <button
                className="quiet"
                type="button"
                disabled={busy}
                onClick={() => refresh((n) => n + 1)}
              >
                Refresh uploads
              </button>
            </div>
            {!jobs ? (
              <p role="status">Loading saved imports…</p>
            ) : !jobs.length ? (
              <p>
                No background files have been queued for your authorized scope.
              </p>
            ) : (
              <ul>
                {jobs.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="quiet background-job-row"
                      onClick={() => void act(() => load(row.id))}
                    >
                      <Icon name="file" size={18} />
                      <span>
                        <strong>{row.filename}</strong>
                        <small>
                          {phaseText(row)} ·{" "}
                          {new Date(row.created_at).toLocaleString()}
                        </small>
                      </span>
                      <span>
                        {row.recorded_rows} / {row.row_count || "—"} rows
                        recorded
                      </span>
                      <Icon name="arrow" size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="background-job-identity">
            <Icon name="file" size={22} />
            <div>
              <h3>{job.filename}</h3>
              <p>
                {new Date(job.created_at).toLocaleString()} · private source
                preserved
              </p>
            </div>
            <button
              type="button"
              className="quiet"
              onClick={() => {
                setJob(null);
                refresh((n) => n + 1);
              }}
            >
              View all imports
            </button>
          </div>
          <section className="background-progress" aria-label="Import progress">
            <p role="status" aria-live="polite">
              {phaseText(job)}
            </p>
            <div>
              <strong>{job.recorded_rows.toLocaleString()}</strong>
              <span>
                {" "}
                / {job.row_count ? job.row_count.toLocaleString() : "—"} source
                rows recorded as metadata
              </span>
            </div>
            {job.row_count > 0 && (
              <progress
                max={job.row_count}
                value={job.recorded_rows}
                aria-label="Source rows recorded"
              />
            )}
            <p>
              Progress counts committed metadata rows. Driver matching and
              evidence review remain separate.
            </p>
            <div className="background-job-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void act(() => load(job.id, offset))}
              >
                Refresh status
              </button>
              {job.can_retry && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => action("retry"))}
                >
                  Retry interrupted phase
                </button>
              )}
              {job.can_cancel && (
                <button
                  type="button"
                  className="quiet"
                  disabled={busy}
                  onClick={() => void act(() => action("cancel"))}
                >
                  Stop remaining processing
                </button>
              )}
            </div>
          </section>
          {job.error_code && (
            <p className="error" role="alert">
              {errors[job.error_code] ||
                "Processing stopped. Inspect the source and recorded parts before starting another import."}{" "}
              <small>Code: {job.error_code}</small>
            </p>
          )}
          {job.can_map &&
            job.inspection &&
            job.status === "awaiting_confirmation" &&
            !editMapping && (
              <div className="background-mapping-summary">
                <div>
                  <h3>Column mapping validated</h3>
                  <p>
                    {job.inspection.sheet} · {job.row_count} source rows.
                    Changes require another validation.
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditMapping(true)}
                >
                  Change column mapping
                </button>
              </div>
            )}
          {job.can_map &&
            job.inspection &&
            (job.status !== "awaiting_confirmation" || editMapping) && (
              <section className="background-mapping">
                <h3>Map the inspected columns</h3>
                <p>
                  {job.row_count} rows · {job.inspection.sheet}. Identifiers
                  must remain text; ambiguous numeric identifier rows stay
                  invalid for manual correction.
                </p>
                <fieldset disabled={busy}>
                  {job.inspection.sheets.length > 1 && (
                    <label>
                      Worksheet
                      <select
                        aria-label="Background worksheet"
                        value={job.inspection.sheet}
                        onChange={(e) =>
                          void act(() =>
                            action("sheet", { sheet: e.target.value }),
                          )
                        }
                      >
                        {job.inspection.sheets.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <MappingLibrary
                    base={base}
                    branch={job.branch_id || ""}
                    columns={job.inspection.columns}
                    canManage={false}
                    onManual={() => setTemplate(null)}
                    onApply={(saved, id) => {
                      setMapping(saved);
                      setTemplate(id);
                    }}
                  />
                  <div className="mapping-fields">
                    {Object.entries(fields).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <select
                          aria-label={"Background column for " + label}
                          value={mapping[key] ?? -2}
                          onChange={(e) => {
                            setMapping((m) => ({
                              ...m,
                              [key]: Number(e.target.value),
                            }));
                            setTemplate(null);
                          }}
                        >
                          <option value={-2}>Select a column</option>
                          {key === "client_ref" && (
                            <option value={-1}>
                              Selected company: {companyReference}
                            </option>
                          )}
                          {job.inspection!.columns.map((c, i) => (
                            <option value={i} key={i}>
                              {i + 1}. {c}
                            </option>
                          ))}
                        </select>
                        <small>
                          {mapping[key] >= 0
                            ? job.inspection!.sample[0]?.[mapping[key]] ||
                              "First source row is empty"
                            : mapping[key] === -1
                              ? companyReference
                              : "No source selected"}
                        </small>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(() =>
                        action("mapping", {
                          mapping,
                          template_revision_id: template,
                        }),
                      )
                    }
                  >
                    Validate mapped rows in background
                  </button>
                  {job.status === "awaiting_confirmation" && (
                    <button
                      type="button"
                      className="quiet"
                      onClick={() => {
                        setMapping(job.configuration.mapping!);
                        setTemplate(
                          job.configuration.template_revision_id || null,
                        );
                        setEditMapping(false);
                      }}
                    >
                      Keep validated mapping
                    </button>
                  )}
                </fieldset>
              </section>
            )}
          {job.status === "awaiting_confirmation" && job.preview && (
            <section
              className="background-preview"
              aria-label="Validated import preview"
            >
              <h3>Review validated rows</h3>
              {!mappingClean && (
                <p className="error" role="status">
                  Selected columns changed. Validate the mapping again before
                  confirming this import.
                </p>
              )}
              <div className="background-counts">
                {Object.entries(job.preview.counts).map(([state, count]) => (
                  <span key={state}>
                    <State value={state} /> {count}
                  </span>
                ))}
              </div>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Background row preview"
              >
                <table className="management-table">
                  <thead>
                    <tr>
                      <th scope="col">Source data row</th>
                      <th scope="col">Driver / report</th>
                      <th scope="col">Outcome</th>
                      <th scope="col">Context</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.preview.items.map((r) => (
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
              <div className="background-pagination">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || offset === 0}
                  onClick={() =>
                    void act(() => load(job.id, Math.max(0, offset - 25)))
                  }
                >
                  Previous rows
                </button>
                <span>
                  Rows {offset + 1}–{Math.min(offset + 25, job.preview.total)}{" "}
                  of {job.preview.total}
                </span>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || offset + 25 >= job.preview.total}
                  onClick={() => void act(() => load(job.id, offset + 25))}
                >
                  Next rows
                </button>
              </div>
              <p>
                Confirmation records every row outcome, including invalid and
                duplicate metadata. Current data is rechecked while each part
                records; final outcomes may differ from this preview. Matching
                and evidence review remain separate.
              </p>
              {job.can_confirm && (
                <button
                  type="button"
                  disabled={busy || !mappingClean}
                  onClick={() => void act(() => action("confirm"))}
                >
                  Confirm receipt processing
                </button>
              )}
            </section>
          )}
          {job.parts.length > 0 && (
            <section className="background-parts">
              <h3>Recorded receipt parts</h3>
              <p>
                These parts are durable even if later processing stops. Open a
                receipt to review or correct its source rows.
              </p>
              <ul>
                {job.parts.map((p) => (
                  <li key={p.batch_id}>
                    <span>
                      Source data rows {p.first_row}–{p.last_row}
                    </span>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => onOpenReceipt(p.batch_id)}
                    >
                      Open receipt for rows {p.first_row}–{p.last_row}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <details className="background-provenance">
            <summary>Private source reference</summary>
            <p>
              SHA-256: <code>{job.sha256}</code>
            </p>
            <small>
              Import {job.id}. The original file is retained privately; no
              public file link is created.
            </small>
          </details>
        </>
      )}
    </section>
  );
}
