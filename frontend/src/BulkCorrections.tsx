import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "./api";
import { DetailPanel } from "./DetailPanel";
import type { IntakeRow } from "./IntakeRowReview";

type Result = {
  item_id: string;
  row_number: number;
  normalized: Record<string, string>;
  outcome: string;
  code: string | null;
  message: string;
  replacement?: { batch_id: string; item_id: string };
};
type Run = {
  actor: string;
  reason: string;
  id: string;
  created_at: string;
  items: Result[];
  replayed?: boolean;
};
const fields = {
  client_ref: "Company reference",
  external_driver_ref: "Driver reference",
  report_type: "Report type",
  external_report_ref: "Report reference",
  reported_at: "Reported date (YYYY-MM-DD)",
};

function Results({
  items,
  onOpen,
}: {
  items: Result[];
  onOpen: (batch: string) => void;
}) {
  return (
    <ul className="bulk-results">
      {items.map((row) => (
        <li key={row.item_id}>
          <div className="bulk-result-heading">
            <strong>Row {row.row_number}</strong>
            <span className={"bulk-outcome bulk-outcome--" + row.outcome}>
              {row.outcome === "ready" ? "Ready to record" : row.outcome}
            </span>
          </div>
          <p>
            {row.normalized.external_driver_ref} ·{" "}
            {row.normalized.external_report_ref}
          </p>
          <p>{row.message}</p>
          {row.replacement && (
            <button
              type="button"
              className="secondary"
              onClick={() => onOpen(row.replacement!.batch_id)}
            >
              Open replacement for row {row.row_number}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function BulkCorrections({
  base,
  batchId,
  rows,
  onClose,
  onRecorded,
  onOpen,
}: {
  base: string;
  batchId: string;
  rows: IntakeRow[];
  onClose: () => void;
  onRecorded: () => Promise<void>;
  onOpen: (batch: string) => void;
}) {
  const [draft, setDraft] = useState(() =>
    rows.map((row) => ({
      item_id: row.id!,
      row_number: row.row_number,
      normalized: { ...row.normalized },
    })),
  );
  const [reason, setReason] = useState(""),
    [preview, setPreview] = useState<Result[] | null>(null),
    [run, setRun] = useState<Run | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const command = useRef(crypto.randomUUID()),
    errorSummary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorSummary.current?.focus();
  }, [error]);
  function changed() {
    setPreview(null);
    setError("");
    command.current = crypto.randomUUID();
  }
  function payload() {
    return {
      command_id: command.current,
      reason,
      items: draft.map(({ item_id, normalized }) => ({ item_id, normalized })),
    };
  }
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
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!preview?.some((row) => row.outcome === "ready")) return;
    await act(async () => {
      const saved = await api<Run>(
        base + "/" + batchId + "/correction-runs",
        payload(),
      );
      try {
        await onRecorded();
      } catch {
        setError(
          "Corrections were recorded, but the receipt could not refresh. Close and reopen it; do not submit a new run.",
        );
      }
      setRun(saved);
    });
  }
  return (
    <DetailPanel
      title="Correct selected source rows"
      context={draft.length + " selected · original metadata stays unchanged"}
      onClose={onClose}
    >
      {error && (
        <p ref={errorSummary} className="error" role="alert" tabIndex={-1}>
          {error}
        </p>
      )}
      {run ? (
        <section aria-label="Recorded correction outcomes">
          <p className="action-confirmation" role="status">
            {run.items.filter((r) => r.outcome === "corrected").length}{" "}
            replacement receipts recorded ·{" "}
            {run.items.filter((r) => r.outcome === "blocked").length} blocked ·{" "}
            {run.items.filter((r) => r.outcome === "unchanged").length}{" "}
            unchanged.
          </p>
          <p className="bulk-boundary">
            Driver matching, document uploads and evidence reviews remain
            separate. This run is saved in the original receipt’s correction
            history.
          </p>
          <p className="bulk-boundary">
            Recorded by {run.actor}. {run.reason}
          </p>
          <Results items={run.items} onOpen={onOpen} />
          <button type="button" className="secondary" onClick={onClose}>
            Return to receipt
          </button>
        </section>
      ) : (
        <form
          onSubmit={(e) => void submit(e)}
          aria-label="Bulk source corrections"
        >
          <p className="bulk-boundary">
            Edit the incorrect values and record a factual basis. Valid
            corrections get linked replacement receipts; blocked and unchanged
            rows remain intact. Up to 25 rows per run.
          </p>
          <fieldset disabled={busy} className="bulk-editor">
            <legend className="sr-only">Selected metadata rows</legend>
            {draft.map((row, index) => (
              <section className="bulk-edit-row" key={row.item_id}>
                <header>
                  <h3>Source row {row.row_number}</h3>
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => {
                      setDraft((v) =>
                        v.filter((r) => r.item_id !== row.item_id),
                      );
                      changed();
                    }}
                  >
                    Remove row {row.row_number}
                  </button>
                </header>
                <div className="bulk-field-grid">
                  {Object.entries(fields).map(([key, label]) => (
                    <label key={key}>
                      {" "}
                      {label}
                      <input
                        aria-label={"Row " + row.row_number + " " + label}
                        value={row.normalized[key] || ""}
                        maxLength={200}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDraft((v) =>
                            v.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    normalized: {
                                      ...r.normalized,
                                      [key]: value,
                                    },
                                  }
                                : r,
                            ),
                          );
                          changed();
                        }}
                      />
                    </label>
                  ))}
                </div>
              </section>
            ))}
            <label className="bulk-rationale">
              Verified basis for these corrections
              <textarea
                value={reason}
                minLength={20}
                maxLength={2000}
                required
                onChange={(e) => {
                  setReason(e.target.value);
                  changed();
                }}
              />
              <small>
                Explain the verified source and changes covered by this run.
                This basis is recorded with every replacement.
              </small>
            </label>
            <button
              type="button"
              className="secondary"
              disabled={!draft.length || reason.trim().length < 20}
              onClick={() =>
                void act(async () => {
                  const result = await api<{ items: Result[] }>(
                    base + "/" + batchId + "/correction-runs/preview",
                    payload(),
                  );
                  setPreview(result.items);
                })
              }
            >
              {busy ? "Checking…" : "Preview corrections"}
            </button>
          </fieldset>
          {preview && (
            <section className="bulk-preview" aria-label="Correction preview">
              <h3>Check each outcome</h3>
              <p role="status">
                {preview.filter((r) => r.outcome === "ready").length} ready ·{" "}
                {preview.filter((r) => r.outcome === "blocked").length} blocked
                · {preview.filter((r) => r.outcome === "unchanged").length}{" "}
                unchanged. Nothing recorded yet.
              </p>
              <Results items={preview} onOpen={onOpen} />
              <button
                disabled={busy || !preview.some((r) => r.outcome === "ready")}
              >
                {busy ? "Recording…" : "Record corrections"}
              </button>
            </section>
          )}
        </form>
      )}
    </DetailPanel>
  );
}

export function CorrectionHistory({
  base,
  batchId,
  revision,
  onOpen,
}: {
  base: string;
  batchId: string;
  revision: number;
  onOpen: (batch: string) => void;
}) {
  const [runs, setRuns] = useState<Run[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRuns(null);
    setError("");
    void api<{ items: Run[] }>(base + "/" + batchId + "/correction-runs")
      .then((r) => {
        if (active) setRuns(r.items);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [base, batchId, revision]);
  return (
    <details className="bulk-history">
      <summary>
        Recent correction runs{runs ? " (" + runs.length + ")" : ""}
      </summary>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : !runs ? (
        <p role="status">Loading correction history…</p>
      ) : !runs.length ? (
        <p>No bulk corrections have been recorded for this receipt.</p>
      ) : (
        runs.map((run) => (
          <details key={run.id}>
            <summary>
              {new Date(run.created_at).toLocaleString()} ·{" "}
              {run.items.filter((r) => r.outcome === "corrected").length}{" "}
              corrected / {run.items.length} selected
            </summary>
            <p className="bulk-boundary">
              Recorded by {run.actor}. {run.reason}
            </p>
            <Results items={run.items} onOpen={onOpen} />
          </details>
        ))
      )}
    </details>
  );
}
