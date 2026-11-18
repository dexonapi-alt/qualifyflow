import { useEffect, useState } from "react";
import { api } from "./api";
import { Form, Field, State } from "./Forms";

type Row = {
  driver_id: string;
  driver_reference: string;
  requirement: string;
  code: string;
  state: string;
};
type Report = {
  items: Row[];
  total: number;
  states: Record<string, number>;
  generated_at: string;
  basis: string;
};
type Export = {
  id: string;
  status: string;
  row_count: number | null;
  error_code: string | null;
  expires_at: string;
  created_at: string;
};
export function Reports({
  companyId,
  onOpenDriver,
}: {
  companyId: string;
  onOpenDriver: (id: string) => void;
}) {
  const base = `/tenants/${companyId}/reports`;
  const [report, setReport] = useState<Report | null>(null),
    [exports, setExports] = useState<{ items: Export[]; total: number } | null>(
      null,
    );
  const [offset, setOffset] = useState(0),
    [exportOffset, setExportOffset] = useState(0),
    [revision, setRevision] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    Promise.all([
      api<Report>(base + "/requirements?offset=" + offset),
      api<{ items: Export[]; total: number }>(
        base + "/exports?offset=" + exportOffset,
      ),
    ])
      .then(([value, jobs]) => {
        if (active) {
          setReport(value);
          setExports(jobs);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [base, offset, exportOffset, revision]);
  return (
    <section className="connections-workspace reports-workspace">
      <div className="intake-heading">
        <div>
          <h2>Configured evidence</h2>
          <p className="muted">
            Current employer engagements and assigned requirements in your
            authorized scope.
          </p>
        </div>
        <button className="secondary" onClick={() => setRevision((v) => v + 1)}>
          Refresh report
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!report && !error && <p role="status">Loading configured evidence…</p>}
      {report && (
        <>
          <div
            className="overview-summary"
            aria-label="Configured evidence totals"
          >
            <div>
              <strong>{report.total}</strong> Assigned requirements
            </div>
            <div>
              <strong>{report.states.verified || 0}</strong> Evidence verified
            </div>
            <div>
              <strong>{report.states.missing || 0}</strong> Missing evidence
            </div>
            <div>
              <strong>{report.states.expired || 0}</strong> Explicitly expired
            </div>
          </div>
          <p className="connection-boundary">
            {report.basis}. These totals describe evidence review against
            client-configured requirements.
          </p>
          {report.total === 0 ? (
            <div className="intake-empty">
              <h3>No assigned requirements in this scope</h3>
              <p>
                Assign agreed requirements to a current driver engagement before
                it appears in this report.
              </p>
            </div>
          ) : (
            <div
              className="table-scroll"
              role="region"
              aria-label="Configured evidence report"
              tabIndex={0}
            >
              <table className="management-table">
                <thead>
                  <tr>
                    <th scope="col">Driver reference</th>
                    <th scope="col">Requirement</th>
                    <th scope="col">Evidence state</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.map((row, i) => (
                    <tr key={row.driver_id + row.code + i}>
                      <td>{row.driver_reference}</td>
                      <td>
                        <strong>{row.requirement}</strong>
                        <small>{row.code}</small>
                      </td>
                      <td>
                        <State value={row.state} />
                      </td>
                      <td>
                        <button
                          className="quiet"
                          onClick={() => onOpenDriver(row.driver_id)}
                        >
                          View file
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {report.total > 25 && (
            <div className="intake-pagination">
              <button
                className="secondary"
                disabled={!offset}
                onClick={() => setOffset((v) => v - 25)}
              >
                Previous requirements
              </button>
              <span>
                {offset + 1}–{Math.min(offset + 25, report.total)} of{" "}
                {report.total}
              </span>
              <button
                className="secondary"
                disabled={offset + 25 >= report.total}
                onClick={() => setOffset((v) => v + 25)}
              >
                Next requirements
              </button>
            </div>
          )}
          <details className="connection-create">
            <summary>Export configured evidence</summary>
            <p>
              Private CSV snapshot, limited to your current scope. Downloads
              expire after one hour and recheck permission. No documents or
              screening results are included.
            </p>
            <Form
              label="Request scoped CSV export"
              onSave={async (d) => {
                await api(base + "/exports", {
                  ...d,
                  command_id: crypto.randomUUID(),
                });
                setRevision((v) => v + 1);
                return "Export queued. Refresh this report to check its outcome.";
              }}
            >
              <Field
                name="purpose"
                label="Export purpose"
                minLength={10}
                maxLength={500}
              />
            </Form>
          </details>
        </>
      )}
      {exports && exports.items.length > 0 && (
        <>
          <h3>Your export requests</h3>
          <div
            className="table-scroll"
            role="region"
            aria-label="Private export requests"
            tabIndex={0}
          >
            <table className="management-table">
              <thead>
                <tr>
                  <th scope="col">Requested</th>
                  <th scope="col">State</th>
                  <th scope="col">Rows / expiry</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {exports.items.map((job) => (
                  <tr key={job.id} data-export-job={job.id}>
                    <td>{new Date(job.created_at).toLocaleString()}</td>
                    <td>
                      <State value={job.status} />
                      {job.error_code && <small>{job.error_code}</small>}
                    </td>
                    <td>
                      {job.row_count ?? "—"}
                      <small>{new Date(job.expires_at).toLocaleString()}</small>
                    </td>
                    <td>
                      {job.status === "completed" &&
                      new Date(job.expires_at) > new Date() ? (
                        <a
                          className="secondary"
                          href={`/api/v1${base}/exports/${job.id}/download`}
                        >
                          Download CSV
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {exports.total > 25 && (
            <div className="intake-pagination">
              <button
                className="secondary"
                disabled={!exportOffset}
                onClick={() => setExportOffset((v) => v - 25)}
              >
                Previous exports
              </button>
              <button
                className="secondary"
                disabled={exportOffset + 25 >= exports.total}
                onClick={() => setExportOffset((v) => v + 25)}
              >
                Next exports
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
