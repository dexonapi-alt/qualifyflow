import { useEffect, useRef, useState } from "react";
import { api, type Branch, type DriverAccess } from "./api";
import { State } from "./Forms";
import { SpreadsheetImport } from "./SpreadsheetImport";
import { SaveMapping } from "./MappingTemplates";
import { BulkCorrections, CorrectionHistory } from "./BulkCorrections";
import { BackgroundImports } from "./BackgroundImports";
import { IntakeRowReview, type IntakeRow } from "./IntakeRowReview";

type Row = IntakeRow;
type Batch = {
  id: string;
  received_at: string;
  source_channel: string;
  schema_version: string;
};
type Detail = Batch & {
  branch_id: string | null;
  provenance?: {
    filename: string;
    sheet: string;
    mapping_version: string;
    sha256: string;
    mapping: Record<string, number>;
    columns: string[];
    template_revision_id?: string | null;
    saved_template?: { name: string; revision: number } | null;
    background_source_id?: string;
    first_source_row?: number;
    last_source_row?: number;
  } | null;
  items: Row[];
  processing: {
    status: string;
    attempts: number;
    error_code: string | null;
  } | null;
};
const header =
  "client_ref,external_driver_ref,report_type,external_report_ref,reported_at";

export function IntakeWorkspace({
  companyId,
  access,
  branches,
  companyReference,
  onOpenDriver,
}: {
  companyId: string;
  access: DriverAccess;
  branches: Branch[];
  companyReference: string;
  onOpenDriver?: (driver: string, source: string) => void;
}) {
  const base = "/tenants/" + companyId + "/intake-batches";
  const [spreadsheet, setSpreadsheet] = useState(false),
    [reviewing, setReviewing] = useState<Row | null>(null),
    [notice, setNotice] = useState("");
  const canReview = ["client_admin", "reviewer", "specialist"].includes(
    access.role,
  );
  const [selection, setSelection] = useState<string[]>([]),
    [bulkOpen, setBulkOpen] = useState(false);
  const [background, setBackground] = useState(false);
  const bulkReturn = useRef<HTMLButtonElement>(null);
  function closeBulk() {
    setBulkOpen(false);
    requestAnimationFrame(() => {
      const target = bulkReturn.current;
      if (target && !target.disabled) target.focus({ preventScroll: true });
      else
        document
          .querySelector<HTMLButtonElement>(
            ".intake-workspace .intake-heading button:not(:disabled)",
          )
          ?.focus({ preventScroll: true });
    });
  }
  function editable(row: Row) {
    return (
      !!row.id &&
      !row.match &&
      !row.replacement &&
      !["attached", "duplicate_detected", "superseded"].includes(row.status)
    );
  }
  async function openReceipt(id: string, message = "") {
    const result = await api<Detail>(base + "/" + id);
    setSelected(result);
    setSelection([]);
    setBulkOpen(false);
    setCreating(false);
    setSpreadsheet(false);
    setReviewing(null);
    setPreview(null);
    setNotice(message);
    setRevision((n) => n + 1);
  }
  useEffect(() => {
    let active = true;
    const batch = new URLSearchParams(location.hash.slice(1)).get("batch");
    if (batch)
      void api<Detail>(base + "/" + batch)
        .then((r) => {
          if (active) setSelected(r);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [base]);
  const [page, setPage] = useState<{ total: number; items: Batch[] } | null>(
    null,
  );
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [source, setSource] = useState(header + "\n");
  const [branch, setBranch] = useState(access.branch_id || "");
  const [preview, setPreview] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const command = useRef(crypto.randomUUID());
  useEffect(() => {
    let active = true;
    setPage(null);
    api<{ total: number; items: Batch[] }>(base + "?offset=" + offset)
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [base, offset, revision]);
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
  const rows = selected?.items || preview;
  if (background)
    return (
      <BackgroundImports
        base={base}
        branches={branches}
        branchId={access.branch_id}
        companyReference={companyReference}
        onClose={() => {
          setBackground(false);
          setRevision((n) => n + 1);
        }}
        onOpenReceipt={(id) => {
          setBackground(false);
          void act(() => openReceipt(id));
        }}
      />
    );
  return (
    <section className="intake-workspace" aria-busy={busy}>
      <div className="intake-heading">
        <div>
          <h2>Received records</h2>
          <p className="muted">
            Structured metadata receipts · synthetic schema v1
          </p>
        </div>
        {!creating && !spreadsheet && !selected && access.can_write && (
          <button
            onClick={() => {
              setCreating(true);
              setPreview(null);
              setError("");
              command.current = crypto.randomUUID();
            }}
          >
            New metadata receipt
          </button>
        )}
        {(creating || selected) && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setCreating(false);
              setSelected(null);
              setPreview(null);
              setError("");
            }}
          >
            Back to receipts
          </button>
        )}
      </div>
      {!creating && !spreadsheet && !selected && access.can_write && (
        <button
          className="secondary import-spreadsheet-button"
          onClick={() => {
            setSpreadsheet(true);
            setError("");
            setNotice("");
          }}
        >
          Import spreadsheet
        </button>
      )}
      {!creating && !spreadsheet && !selected && access.can_write && (
        <button
          type="button"
          className="secondary import-spreadsheet-button"
          onClick={() => setBackground(true)}
        >
          Background imports
        </button>
      )}
      <p className="intake-boundary">
        Receive metadata here, then open the matched driver file to assign and
        review supporting evidence. No receipt or attachment establishes legal
        qualification.
      </p>
      {notice && (
        <p className="action-confirmation" role="status">
          {notice}
        </p>
      )}
      {spreadsheet && (
        <SpreadsheetImport
          base={base}
          branches={branches}
          branchId={access.branch_id}
          companyReference={companyReference}
          canManageMappings={canReview}
          onCancel={() => setSpreadsheet(false)}
          onReceived={(id) =>
            openReceipt(
              id,
              "Mapped receipt recorded. Review row outcomes before opening driver files.",
            )
          }
        />
      )}
      {error && (
        <div role="alert" className="notice error">
          {error}
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setError("");
              setRevision((v) => v + 1);
            }}
          >
            Reload receipts
          </button>
        </div>
      )}
      {creating && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act(async () => {
              const result = await api<{ items: Row[] }>(base + "/preview", {
                source,
                branch_id: branch || null,
              });
              setPreview(result.items);
            });
          }}
        >
          <fieldset disabled={busy}>
            <legend>Preview source metadata</legend>
            <label htmlFor="intake-branch">Intake location</label>
            <select
              id="intake-branch"
              value={branch}
              onChange={(e) => {
                setBranch(e.target.value);
                setPreview(null);
              }}
            >
              {!access.branch_id && <option value="">Whole company</option>}
              {branches
                .filter(
                  (b) =>
                    b.status === "active" &&
                    (!access.branch_id || b.id === access.branch_id),
                )
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
            <label htmlFor="intake-source">CSV metadata</label>
            <label htmlFor="intake-csv">
              Choose a CSV from your spreadsheet
            </label>
            <input
              id="intake-csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const upload = e.target.files?.[0];
                if (!upload) return;
                setPreview(null);
                void act(async () => {
                  if (upload.size > 64000)
                    throw new Error("Choose a UTF-8 CSV up to 64 KB.");
                  const text = new TextDecoder("utf-8", { fatal: true }).decode(
                    await upload.arrayBuffer(),
                  );
                  setSource(text);
                });
              }}
            />
            <p id="intake-source-help" className="muted">
              Use the displayed header order, ISO dates and exact company/driver
              references. Up to 100 rows and 64 KB. No names or document
              contents. Company reference: {companyReference}.
            </p>
            <textarea
              id="intake-source"
              aria-describedby="intake-source-help"
              rows={7}
              maxLength={64000}
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPreview(null);
              }}
              required
            />
            <button type="submit">{busy ? "Working…" : "Preview rows"}</button>
          </fieldset>
        </form>
      )}
      {selected?.provenance && (
        <details className="intake-provenance">
          <summary>Original file & column mapping</summary>
          <p>
            {selected.provenance.filename} ? {selected.provenance.sheet} ?{" "}
            {selected.provenance.mapping_version}
          </p>
          {selected.provenance.background_source_id && (
            <p>
              Background source data rows {selected.provenance.first_source_row}{" "}
              to {selected.provenance.last_source_row}. Receipt row numbers
              start at 1; the original file is retained privately.
            </p>
          )}
          <dl>
            {Object.entries(selected.provenance.mapping).map(
              ([field, index]) => (
                <div key={field}>
                  <dt>{field.replaceAll("_", " ")}</dt>
                  <dd>
                    {index === -1
                      ? "Selected company"
                      : selected.provenance!.columns[index]}
                  </dd>
                </div>
              ),
            )}
          </dl>
          <small>
            Original file SHA-256: <code>{selected.provenance.sha256}</code>
          </small>
          {selected.provenance.template_revision_id && (
            <div className="mapping-provenance">
              <p>
                {selected.provenance.saved_template
                  ? `Saved mapping: ${selected.provenance.saved_template.name} · v${selected.provenance.saved_template.revision}`
                  : "Saved mapping revision"}
              </p>
              <details>
                <summary>Revision reference</summary>
                <code>{selected.provenance.template_revision_id}</code>
              </details>
            </div>
          )}
          {canReview && access.can_write && (
            <SaveMapping
              key={selected.id}
              base={base}
              batchId={selected.id}
              branch={selected.branch_id || ""}
            />
          )}
        </details>
      )}
      {selected && (
        <a
          className="quiet intake-error-export"
          href={"/api/v1" + base + "/" + selected.id + "/errors.csv"}
        >
          <span>Download row errors</span>
        </a>
      )}
      {rows && (
        <>
          <div className="intake-heading">
            <h3>{selected ? "Received metadata" : "Preview — not saved"}</h3>
            <span>
              {rows.length} rows ·{" "}
              {rows.filter((r) => r.status === "validation_failed").length}{" "}
              invalid · {rows.filter((r) => r.status === "unmatched").length}{" "}
              unmatched
            </span>
          </div>
          {selected && (
            <p className="muted">
              Received {new Date(selected.received_at).toLocaleString()} ·{" "}
              {selected.schema_version}
              <br />
              Receipt reference: {selected.id}
            </p>
          )}
          {selected && (
            <div className="intake-heading">
              <p>
                Processing:{" "}
                {selected.processing?.status.replaceAll("_", " ") ||
                  "Not scheduled"}
                {selected.processing?.error_code &&
                  " · " + selected.processing.error_code}
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void act(async () =>
                    setSelected(await api<Detail>(base + "/" + selected.id)),
                  )
                }
              >
                Refresh processing
              </button>
              {selected.processing &&
                [
                  "blocked_by_policy",
                  "dead_letter",
                  "retry_scheduled",
                ].includes(selected.processing.status) && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await api(base + "/" + selected.id + "/retry", {});
                        setSelected(
                          await api<Detail>(base + "/" + selected.id),
                        );
                      })
                    }
                  >
                    Retry processing
                  </button>
                )}
            </div>
          )}
          {selected && canReview && access.can_write && (
            <div className="bulk-toolbar" aria-label="Source row selection">
              <span role="status">
                {selection.length} selected · up to 25 per correction run
              </span>
              <button
                type="button"
                className="quiet"
                ref={bulkReturn}
                disabled={busy || !selected.items.some(editable)}
                onClick={() =>
                  setSelection(
                    selected.items
                      .filter(editable)
                      .slice(0, 25)
                      .map((r) => r.id!),
                  )
                }
              >
                {selected.items.filter(editable).length > 25
                  ? "Select first 25 editable rows"
                  : `Select ${selected.items.filter(editable).length} editable rows`}
              </button>
              <button
                type="button"
                className="quiet"
                disabled={!selection.length || busy}
                onClick={() => setSelection([])}
              >
                Clear selection
              </button>
              <button
                type="button"
                disabled={!selection.length || busy}
                onClick={() => setBulkOpen(true)}
              >
                Correct selected rows
              </button>
            </div>
          )}
          <div
            className="table-scroll"
            role="region"
            aria-label="Intake row outcomes"
            tabIndex={0}
          >
            <table className="management-table intake-review-table">
              <thead>
                <tr>
                  {selected && canReview && access.can_write && (
                    <th scope="col">Select</th>
                  )}
                  <th scope="col">Row / source report</th>
                  <th scope="col">Driver reference</th>
                  <th scope="col">Report type</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Review context</th>
                  {selected && <th scope="col">Next action</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.row_number}>
                    {selected && canReview && access.can_write && (
                      <td>
                        <label className="bulk-check-target">
                          <input
                            type="checkbox"
                            className="bulk-row-check"
                            aria-label={"Select source row " + row.row_number}
                            checked={!!row.id && selection.includes(row.id)}
                            disabled={
                              !editable(row) ||
                              (!selection.includes(row.id!) &&
                                selection.length >= 25) ||
                              busy
                            }
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelection((v) =>
                                checked
                                  ? [...v, row.id!]
                                  : v.filter((id) => id !== row.id),
                              );
                            }}
                          />
                        </label>
                      </td>
                    )}
                    <td>
                      {row.row_number} · {row.normalized.external_report_ref}
                    </td>
                    <td>
                      {row.normalized.external_driver_ref}
                      {row.candidate && (
                        <small>
                          {row.candidate.name} · suggested reference only
                        </small>
                      )}
                    </td>
                    <td>{row.normalized.report_type.replaceAll("_", " ")}</td>
                    <td>
                      <State value={row.status} />
                    </td>
                    <td>{row.reason}</td>
                    {selected && (
                      <td>
                        {row.replacement ? (
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() =>
                              void act(() =>
                                openReceipt(
                                  row.replacement!.batch_id,
                                  "Opened corrected receipt.",
                                ),
                              )
                            }
                          >
                            Open corrected receipt
                          </button>
                        ) : (
                          <>
                            {row.match && (
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() => setReviewing(row)}
                              >
                                View match
                              </button>
                            )}
                            {row.id &&
                              !row.match &&
                              row.status !== "attached" && (
                                <button
                                  className="secondary"
                                  disabled={busy}
                                  onClick={() => setReviewing(row)}
                                >
                                  Review source row
                                </button>
                              )}
                            {row.id &&
                              (row.match ||
                                row.status === "attached" ||
                                (!canReview &&
                                  selected.source_channel === "csv_metadata" &&
                                  ![
                                    "validation_failed",
                                    "duplicate_detected",
                                  ].includes(row.status))) &&
                              onOpenDriver && (
                                <button
                                  className="secondary"
                                  disabled={busy}
                                  onClick={() =>
                                    void act(async () => {
                                      const match = await api<{
                                        driver_id: string;
                                        source_item_id: string;
                                      }>(
                                        base +
                                          "/" +
                                          selected.id +
                                          "/items/" +
                                          row.id +
                                          "/driver-candidate",
                                      );
                                      onOpenDriver(
                                        match.driver_id,
                                        match.source_item_id,
                                      );
                                    })
                                  }
                                >
                                  Open driver file
                                </button>
                              )}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!selected && preview && (
            <div className="intake-confirm">
              <p>
                Confirm receipt preserves every row and its validation outcome.
                It does not attach evidence or accept a screening result.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    const receipt = await api<{ id: string }>(base, {
                      source,
                      branch_id: branch || null,
                      command_id: command.current,
                    });
                    const detail = await api<Detail>(base + "/" + receipt.id);
                    setSelected(detail);
                    setCreating(false);
                    setPreview(null);
                    setRevision((v) => v + 1);
                  })
                }
              >
                Confirm metadata receipt
              </button>
            </div>
          )}
        </>
      )}
      {!creating && !spreadsheet && !selected && (
        <>
          {!page ? (
            <p role="status">Loading receipts…</p>
          ) : page.total === 0 ? (
            <div className="intake-empty">
              <h3>No metadata receipts yet</h3>
              <p>
                Preview synthetic CSV metadata before recording a source
                receipt. Invalid rows remain visible alongside other outcomes.
              </p>
            </div>
          ) : (
            <div
              className="table-scroll"
              role="region"
              aria-label="Metadata receipts"
              tabIndex={0}
            >
              <table className="management-table">
                <thead>
                  <tr>
                    <th scope="col">Received</th>
                    <th scope="col">Source</th>
                    <th scope="col">Schema</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((batch) => (
                    <tr key={batch.id}>
                      <td>{new Date(batch.received_at).toLocaleString()}</td>
                      <td>Manual CSV metadata</td>
                      <td>{batch.schema_version}</td>
                      <td>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            void act(async () =>
                              setSelected(
                                await api<Detail>(base + "/" + batch.id),
                              ),
                            )
                          }
                        >
                          Open receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {page && page.total > 25 && (
            <div className="intake-pagination">
              <button
                className="secondary"
                disabled={offset === 0}
                onClick={() => setOffset((v) => Math.max(0, v - 25))}
              >
                Previous
              </button>
              <span>
                {offset + 1}–{Math.min(offset + 25, page.total)} of {page.total}
              </span>
              <button
                className="secondary"
                disabled={offset + 25 >= page.total}
                onClick={() => setOffset((v) => v + 25)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      {selected && (
        <CorrectionHistory
          base={base}
          batchId={selected.id}
          revision={revision}
          onOpen={(id) => void act(() => openReceipt(id))}
        />
      )}
      {bulkOpen && selected && (
        <BulkCorrections
          key={selected.id}
          base={base}
          batchId={selected.id}
          rows={selected.items.filter(
            (row) => !!row.id && selection.includes(row.id),
          )}
          onClose={closeBulk}
          onOpen={(id) => void act(() => openReceipt(id))}
          onRecorded={async () => {
            setSelected(await api<Detail>(base + "/" + selected.id));
            setSelection([]);
            setRevision((n) => n + 1);
          }}
        />
      )}
      {reviewing && selected && (
        <IntakeRowReview
          row={reviewing}
          batchId={selected.id}
          branchId={selected.branch_id}
          base={base}
          canReview={canReview}
          onClose={() => setReviewing(null)}
          onChanged={openReceipt}
        />
      )}
    </section>
  );
}
