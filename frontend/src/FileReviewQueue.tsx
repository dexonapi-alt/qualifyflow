import { useEffect, useState } from "react";
import { api } from "./api";
import { State } from "./Forms";
import { IdentityMark } from "./VisualInformation";

type Attention = {
  requirement_id: string;
  driver_id: string;
  reference: string;
  first_name: string;
  last_name: string;
  title: string;
  status: string;
};
export function FileReviewQueue({
  companyId,
  onOpenDriver,
}: {
  companyId: string;
  onOpenDriver?: (driver: string, source: string) => void;
}) {
  const [page, setPage] = useState<{
      items: Attention[];
      total: number;
    } | null>(null),
    [error, setError] = useState("");
  const [state, setState] = useState(""),
    [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setPage(null);
    setError("");
    api<{ items: Attention[]; total: number }>(
      "/tenants/" +
        companyId +
        "/requirements/attention?offset=" +
        offset +
        (state ? "&state=" + state : ""),
    )
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [companyId, state, offset, revision]);
  return (
    <section className="qualification-workspace">
      <div className="intake-heading">
        <div>
          <h2>Requirement review queue</h2>
          <p className="muted">
            Missing evidence, recorded expiry dates and outstanding reviews for
            current driver engagements.
          </p>
        </div>
        <button className="secondary" onClick={() => setRevision((v) => v + 1)}>
          Refresh work list
        </button>
      </div>
      <label className="queue-filter">
        Attention needed
        <select
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">All file issues</option>
          <option value="missing">Missing evidence</option>
          <option value="expired">Recorded expiry passed</option>
          <option value="needs_review">Evidence needs review</option>
        </select>
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!page && !error && <p role="status">Loading file work…</p>}
      {page?.total === 0 && (
        <div className="intake-empty">
          <h3>No matching file issues</h3>
          <p>
            This view covers assigned operational requirements only. It does not
            certify regulatory completeness. Open Drivers to assign the client's
            configured requirements.
          </p>
        </div>
      )}
      {page && page.items.length > 0 && (
        <div
          className="table-scroll"
          role="region"
          aria-label="Driver file review work"
          tabIndex={0}
        >
          <table className="management-table">
            <thead>
              <tr>
                <th scope="col">Driver</th>
                <th scope="col">Client requirement</th>
                <th scope="col">Attention</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((row) => (
                <tr key={row.requirement_id}>
                  <td>
                    <span className="person-cell">
                      <IdentityMark
                        value={row.first_name + " " + row.last_name}
                      />
                      <span>
                        {row.first_name} {row.last_name}
                        <small>{row.reference}</small>
                      </span>
                    </span>
                  </td>
                  <td>{row.title}</td>
                  <td>
                    <State value={row.status} />
                  </td>
                  <td>
                    {onOpenDriver && (
                      <button
                        className="secondary"
                        onClick={() => onOpenDriver(row.driver_id, "")}
                      >
                        Open qualification file
                      </button>
                    )}
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
            disabled={!offset}
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
    </section>
  );
}
