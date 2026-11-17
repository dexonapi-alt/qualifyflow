import { useEffect, useRef, useState } from "react";
import { api, type Branch, type DriverAccess } from "./api";
import { State } from "./Forms";

type Row = {
  id?: string;
  row_number: number;
  normalized: Record<string, string>;
  status: string;
  reason: string;
  candidate: { reference: string; name: string } | null;
};
type Batch = {
  id: string;
  received_at: string;
  source_channel: string;
  schema_version: string;
};
type Detail = Batch & {
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
  return (
    <section className="intake-workspace" aria-busy={busy}>
      <div className="intake-heading">
        <div>
          <h2>Received records</h2>
          <p className="muted">
            Structured metadata receipts · synthetic schema v1
          </p>
        </div>
        {!creating && !selected && access.can_write && (
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
      <p className="intake-boundary">
        Receive metadata here, then open the matched driver file to assign and
        review supporting evidence. No receipt or attachment establishes legal
        qualification.
      </p>
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
          <div
            className="table-scroll"
            role="region"
            aria-label="Intake row outcomes"
            tabIndex={0}
          >
            <table className="management-table">
              <thead>
                <tr>
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
                        {row.id &&
                        !["validation_failed", "duplicate_detected"].includes(
                          row.status,
                        ) &&
                        onOpenDriver ? (
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
                        ) : (
                          "Source correction required"
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
      {!creating && !selected && (
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
    </section>
  );
}
