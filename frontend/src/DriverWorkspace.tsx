import { useEffect, useRef, useState } from "react";
import {
  api,
  type Driver,
  type DriverDetail,
  type DriverAccess,
  type Branch,
} from "./api";
import { Form, Field, State } from "./Forms";
import { Icon } from "./UI";
import { IdentityMark, AuditAction } from "./VisualInformation";
import { EmptyState } from "./EmptyState";
import { QualificationFile } from "./QualificationFile";

const label = (value: string) => value.replaceAll("_", " ");

export function DriverWorkspace({
  companyId,
  companyName,
  access,
  branches,
  initialDriverId,
  initialCreate = false,
  onCreated,
  sourceItemId,
}: {
  companyId: string;
  companyName: string;
  access: DriverAccess;
  branches: Branch[];
  initialDriverId?: string;
  initialCreate?: boolean;
  onCreated?: (driver: string) => void;
  sourceItemId?: string;
}) {
  const base = "/tenants/" + companyId + "/drivers";
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [offset, setOffset] = useState(0);
  const [page, setPage] = useState<{ items: Driver[]; total: number } | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [selected, setSelected] = useState(initialDriverId || ""),
    [creating, setCreating] = useState(initialCreate),
    [refresh, setRefresh] = useState(0);
  const command = useRef(crypto.randomUUID());
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    setPage(null);
    const timer = setTimeout(
      () =>
        api<{ items: Driver[]; total: number }>(base + "/search", {
          q: query,
          status: status || null,
          offset,
          limit: 25,
        })
          .then((result) => {
            if (active) setPage(result);
          })
          .catch((e) => {
            if (active) setError(e.message);
          })
          .finally(() => {
            if (active) setBusy(false);
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [base, query, status, offset, refresh]);
  const branchOptions = (
    <>
      <option value="">Whole company</option>
      {branches
        .filter((b) => b.status === "active")
        .map((b) => (
          <option value={b.id} key={b.id}>
            {b.name}
          </option>
        ))}
    </>
  );
  if (selected)
    return (
      <DriverRecord
        key={selected}
        base={base}
        sourceItemId={
          selected === initialDriverId && access.can_write
            ? sourceItemId
            : undefined
        }
        startInFile={selected === initialDriverId && access.can_write}
        id={selected}
        companyName={companyName}
        branches={branches}
        onBack={() => {
          setSelected("");
          setRefresh((n) => n + 1);
        }}
      />
    );
  return (
    <section className="drivers-workspace" aria-label="Driver registry">
      <div className="section-actions">
        <div>
          <h2>Driver registry</h2>
          <p className="driver-context">
            {companyName} ·{" "}
            {access.branch_id ? "Assigned branch" : "Whole company"}
          </p>
        </div>
        {access.can_write && !creating && (
          <button
            onClick={() => {
              command.current = crypto.randomUUID();
              setCreating(true);
            }}
          >
            <Icon name="users" size={16} />
            Register driver
          </button>
        )}
      </div>
      {creating && access.can_write && (
        <div className="driver-create-panel">
          <div className="module-heading">
            <h3>Register a driver</h3>
            <button className="quiet" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
          <p className="muted">
            Use the employer's trusted reference. Similar names are never merged
            automatically.
          </p>
          <Form
            label="Create driver record"
            onSave={async (data) => {
              const result = await api<DriverDetail>(base, {
                ...data,
                command_id: command.current,
                branch_id: access.branch_id || data.branch_id || null,
              });
              setCreating(false);
              setSelected(result.id);
              onCreated?.(result.id);
            }}
          >
            <div className="form-grid">
              <Field
                name="reference"
                label="Company driver reference"
                maxLength={64}
              />
              <Field name="first_name" label="First name" maxLength={100} />
              <Field name="last_name" label="Last name" maxLength={100} />
              <Field
                name="start_date"
                label="Engagement start date"
                type="date"
              />
              {!access.branch_id && (
                <Field name="branch_id" label="Location" required={false}>
                  {branchOptions}
                </Field>
              )}
            </div>
          </Form>
        </div>
      )}
      <div className="driver-toolbar">
        <label className="search-field">
          <Icon name="search" />
          <input
            aria-label="Search drivers"
            placeholder="Search names or company references"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <select
          aria-label="Filter driver engagement state"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">All engagement states</option>
          {["onboarding", "active", "suspended", "inactive", "ended"].map(
            (s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ),
          )}
        </select>
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
          <button className="quiet" onClick={() => setRefresh((n) => n + 1)}>
            Retry driver list
          </button>
        </div>
      )}
      {busy && (
        <p role="status" className="inline-loading">
          Loading drivers…
        </p>
      )}
      {page &&
        (page.items.length ? (
          <>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Driver roster table"
            >
              <table className="management-table driver-table">
                <caption className="visually-hidden">
                  Drivers and employer engagements in your authorized scope
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Driver</th>
                    <th scope="col">Company reference</th>
                    <th scope="col">Location</th>
                    <th scope="col">Engagement state</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div className="person-cell">
                          <IdentityMark
                            value={d.first_name + " " + d.last_name}
                          />
                          <strong>
                            {d.first_name} {d.last_name}
                          </strong>
                        </div>
                      </td>
                      <td>{d.reference}</td>
                      <td>{d.engagement.branch_name || "Whole company"}</td>
                      <td>
                        <State value={d.engagement.status} />
                      </td>
                      <td>
                        <button
                          className="quiet"
                          aria-label={"Open record for " + d.reference}
                          onClick={() => setSelected(d.id)}
                        >
                          Open record <Icon name="arrow" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="driver-pagination">
              <span>
                Showing {offset + 1}–{offset + page.items.length} of{" "}
                {page.total} drivers
              </span>
              <div>
                <button
                  className="secondary"
                  disabled={offset === 0}
                  onClick={() => setOffset((n) => Math.max(0, n - 25))}
                >
                  Previous
                </button>
                <button
                  className="secondary"
                  disabled={offset + page.items.length >= page.total}
                  onClick={() => setOffset((n) => n + 25)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            kind={query || status ? "search" : "drivers"}
            title={
              query || status ? "No matching drivers" : "No drivers registered"
            }
          >
            {query || status
              ? "Adjust the search or engagement-state filter."
              : access.can_write
                ? "Register the first driver with a trusted company reference to begin their engagement history."
                : "Driver records appear here when an authorized team member registers them."}
          </EmptyState>
        ))}
      <p className="operational-note">
        <Icon name="info" size={15} />
        Engagement states describe administrative records, not legal driving
        eligibility.
      </p>
    </section>
  );
}

function DriverRecord({
  base,
  id,
  companyName,
  branches,
  onBack,
  sourceItemId,
  startInFile = false,
}: {
  base: string;
  id: string;
  companyName: string;
  branches: Branch[];
  onBack: () => void;
  sourceItemId?: string;
  startInFile?: boolean;
}) {
  const [record, setRecord] = useState<DriverDetail | null>(null),
    [error, setError] = useState(""),
    [mode, setMode] = useState(
      sourceItemId || startInFile ? "file" : "summary",
    ),
    [revision, setRevision] = useState(0);
  const [confirmation, setConfirmation] = useState("");
  const [historyBusy, setHistoryBusy] = useState(false);
  const path = base + "/" + id;
  useEffect(() => {
    let active = true;
    api<DriverDetail>(path)
      .then((d) => {
        if (active) setRecord(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  async function save(suffix: string, data: unknown, message: string) {
    const next = await api<DriverDetail>(path + suffix, data);
    setRecord(next);
    setRevision((n) => n + 1);
    setConfirmation(message);
    return message;
  }
  const current = record?.engagements.find((e) => !e.end_date);
  const options = (
    <>
      <option value="">Whole company</option>
      {branches
        .filter((b) => b.status === "active")
        .map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
    </>
  );
  return (
    <section className="driver-record" aria-label="Driver record">
      <button className="quiet driver-back" onClick={onBack}>
        ← Back to drivers
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
          <button
            className="quiet"
            onClick={() => {
              setError("");
              setRevision((n) => n + 1);
            }}
          >
            Refresh driver record
          </button>
        </p>
      )}
      {!record && !error && <p role="status">Loading driver record…</p>}
      {record && (
        <>
          <div className="driver-record-heading">
            <div className="person-cell">
              <IdentityMark
                value={record.first_name + " " + record.last_name}
              />
              <div>
                <h2>
                  {record.first_name} {record.last_name}
                </h2>
                <p>
                  {record.reference} · {companyName}
                </p>
              </div>
            </div>
            <div className="driver-record-tools">
              {current && (
                <span className="driver-state-context">
                  Engagement <State value={current.status} />
                </span>
              )}
              <button
                className="quiet"
                onClick={() => {
                  setError("");
                  setRevision((n) => n + 1);
                }}
              >
                Refresh record
              </button>
            </div>
          </div>
          <nav className="driver-sections" aria-label="Driver sections">
            {[
              "summary",
              ...(record.access.can_write ? ["file"] : []),
              ...(record.access.can_write ? ["engagement"] : []),
              ...(record.access.can_correct ? ["correction"] : []),
              ...(record.access.can_history ? ["history"] : []),
            ].map((t) => (
              <button
                className="quiet"
                aria-current={mode === t ? "page" : undefined}
                key={t}
                onClick={() => {
                  setMode(t);
                  setConfirmation("");
                }}
              >
                {
                  {
                    summary: "Record overview",
                    file: "Qualification file",
                    engagement: "Manage engagement",
                    correction: "Identity correction",
                    history: "Record history",
                  }[t]
                }
              </button>
            ))}
          </nav>
          {mode === "file" && record.access.can_write && (
            <QualificationFile
              key={path + sourceItemId}
              path={path + "/file"}
              engagements={record.engagements}
              sourceItemId={sourceItemId}
            />
          )}
          {mode === "summary" && (
            <div className="driver-overview">
              <section className="driver-identity-panel">
                <h3>Driver identity</h3>
                <dl className="driver-facts">
                  <div>
                    <dt>Company reference</dt>
                    <dd>{record.reference}</dd>
                  </div>
                  <div>
                    <dt>First name</dt>
                    <dd>{record.first_name}</dd>
                  </div>
                  <div>
                    <dt>Last name</dt>
                    <dd>{record.last_name}</dd>
                  </div>
                  <div>
                    <dt>Identity version</dt>
                    <dd>{record.version}</dd>
                  </div>
                </dl>
                <p className="muted">
                  This driver identity is private to this company and separate
                  from a login account.
                </p>
              </section>
              <section className="driver-current-panel">
                <h3>Current engagement in your scope</h3>
                {current ? (
                  <>
                    <div className="driver-current-location">
                      <Icon name="location" size={22} />
                      <strong>{current.branch_name || "Whole company"}</strong>
                    </div>
                    <p>
                      Started{" "}
                      <time dateTime={current.start_date}>
                        {current.start_date}
                      </time>
                    </p>
                    <State value={current.status} />
                  </>
                ) : (
                  <p>
                    No current engagement is visible in your scope. Historical
                    engagements remain below.
                  </p>
                )}
                <p className="operational-note">
                  Operational status only. Regulatory applicability has not been
                  determined.
                </p>
              </section>
            </div>
          )}
          {mode === "engagement" && record.access.can_write && (
            <div className="driver-management">
              {current ? (
                <>
                  <section>
                    <h3>Update engagement state</h3>
                    <Form
                      label="Record state change"
                      onSave={(data) =>
                        save(
                          "/engagements/" + current.id + "/state",
                          {
                            ...data,
                            version: current.version,
                            end_date: data.end_date || null,
                          },
                          "Engagement state recorded.",
                        )
                      }
                    >
                      <Field name="status" label="New engagement state">
                        <option value="">Select a permitted state</option>
                        {current.allowed_transitions.map((s) => (
                          <option value={s} key={s}>
                            {label(s)}
                          </option>
                        ))}
                      </Field>
                      <Field
                        name="end_date"
                        label="End date (when ending or deactivating)"
                        type="date"
                        required={false}
                      />
                      <Field
                        name="reason"
                        label="State change reason"
                        minLength={5}
                      />
                    </Form>
                  </section>
                  {record.access.can_transfer && (
                    <section>
                      <h3>Transfer location</h3>
                      <p className="muted">
                        Ends this engagement and creates another. Previous
                        records and dates remain in history.
                      </p>
                      <Form
                        label="Transfer driver location"
                        onSave={(data) =>
                          save(
                            "/engagements/" + current.id + "/transfer",
                            {
                              ...data,
                              version: current.version,
                              branch_id: data.branch_id || null,
                            },
                            "Location transfer recorded. Previous engagement preserved.",
                          )
                        }
                      >
                        <Field
                          name="branch_id"
                          label="Destination location"
                          required={false}
                        >
                          {options}
                        </Field>
                        <Field
                          name="effective_date"
                          label="Transfer effective date"
                          type="date"
                        />
                        <Field
                          name="reason"
                          label="Transfer reason"
                          minLength={5}
                        />
                      </Form>
                    </section>
                  )}
                </>
              ) : record.access.can_rehire ? (
                <section>
                  <h3>New employer engagement</h3>
                  <Form
                    label="Create engagement"
                    onSave={(data) =>
                      save(
                        "/engagements",
                        { ...data, branch_id: data.branch_id || null },
                        "New engagement created.",
                      )
                    }
                  >
                    <Field
                      name="branch_id"
                      label="Engagement location"
                      required={false}
                    >
                      {options}
                    </Field>
                    <Field
                      name="start_date"
                      label="New engagement start date"
                      type="date"
                    />
                    <Field
                      name="reason"
                      label="Engagement reason"
                      minLength={5}
                    />
                  </Form>
                </section>
              ) : (
                <p>
                  There is no current engagement available to change in your
                  scope.
                </p>
              )}
            </div>
          )}
          {mode === "correction" && record.access.can_correct && (
            <section className="driver-correction">
              <h3>Reviewed identity correction</h3>
              <p className="muted">
                Use a verified employer source. Corrections retain the previous
                values and reviewer in restricted history; they never merge
                identities.
              </p>
              <Form
                key={record.version}
                label="Record identity correction"
                feedback={confirmation || undefined}
                onSave={(data) =>
                  save(
                    "/corrections",
                    { ...data, version: record.version },
                    "Identity correction recorded.",
                  )
                }
              >
                <Field
                  name="reference"
                  label="Correct company reference"
                  defaultValue={record.reference}
                />
                <Field
                  name="first_name"
                  label="Correct first name"
                  defaultValue={record.first_name}
                />
                <Field
                  name="last_name"
                  label="Correct last name"
                  defaultValue={record.last_name}
                />
                <Field
                  name="verified_basis"
                  label="Verified source or basis"
                  minLength={10}
                />
                <Field name="reason" label="Correction reason" minLength={5} />
              </Form>
            </section>
          )}
          {mode === "history" && record.history && (
            <section>
              <h3>Recent record history</h3>
              <ol className="driver-history">
                {record.history.map((h) => (
                  <li key={h.id}>
                    <AuditAction action={h.action} />
                    <p>{h.reason}</p>
                    <small>
                      {h.actor_email} ·{" "}
                      <time dateTime={h.occurred_at}>
                        {new Date(h.occurred_at).toLocaleString(undefined, {
                          timeZone: "UTC",
                        })}{" "}
                        UTC
                      </time>
                    </small>
                    <details>
                      <summary>Change details</summary>
                      <p>
                        Actor reference: <code>{h.actor_id}</code>
                        <br />
                        Event reference: <code>{h.id}</code>
                      </p>
                      <pre>{JSON.stringify(h.details, null, 2)}</pre>
                    </details>
                  </li>
                ))}
              </ol>
              {record.history.length < (record.history_total || 0) && (
                <button
                  className="secondary"
                  disabled={historyBusy}
                  onClick={async () => {
                    setHistoryBusy(true);
                    try {
                      const next = await api<{
                        items: NonNullable<DriverDetail["history"]>;
                      }>(path + "/history?offset=" + record.history!.length);
                      setRecord({
                        ...record,
                        history: [...record.history!, ...next.items],
                      });
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setHistoryBusy(false);
                    }
                  }}
                >
                  {historyBusy ? "Loading history…" : "Load older history"}
                </button>
              )}
            </section>
          )}
          <section className="engagement-history">
            <h3>Employer engagement history</h3>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Employer engagements table"
            >
              <table className="management-table">
                <thead>
                  <tr>
                    <th scope="col">Location</th>
                    <th scope="col">Started</th>
                    <th scope="col">Ended</th>
                    <th scope="col">Operational state</th>
                  </tr>
                </thead>
                <tbody>
                  {record.engagements.map((e) => (
                    <tr key={e.id}>
                      <td>{e.branch_name || "Whole company"}</td>
                      <td>{e.start_date}</td>
                      <td>{e.end_date || "Current"}</td>
                      <td>
                        <State value={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
