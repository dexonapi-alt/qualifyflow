import { useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { Form, Field, State } from "./Forms";
import { Icon } from "./UI";

type Connection = {
  id: string;
  account_ref: string;
  state: string;
  version: number;
  credential_version: number;
  tested_at: string | null;
  cursor: number;
  sync_interval_minutes: number;
  sync_enabled: boolean;
  next_sync_at: string | null;
  sync_error: string | null;
};
type Run = {
  id: string;
  operation: string;
  state: string;
  error_code: string | null;
  received_count: number;
  duplicate_count: number;
  correlation_id: string;
  created_at: string;
};
type Listing = {
  items: Connection[];
  total: number;
  can_manage: boolean;
  environment: string;
};
type PullJob = {
  id: string;
  status: string;
  attempts: number;
  error_code: string | null;
  available_at: string;
  created_at: string;
};
export function Connections({ companyId }: { companyId: string }) {
  const base = "/tenants/" + companyId + "/provider-connections";
  const [data, setData] = useState<Listing | null>(null),
    [selected, setSelected] = useState(""),
    [runs, setRuns] = useState<{ items: Run[]; total: number } | null>(null);
  const [error, setError] = useState(""),
    [secret, setSecret] = useState(""),
    [offset, setOffset] = useState(0),
    [runOffset, setRunOffset] = useState(0),
    [revision, setRevision] = useState(0);
  const [jobs, setJobs] = useState<{ items: PullJob[]; total: number } | null>(
    null,
  );
  const [jobOffset, setJobOffset] = useState(0);
  const [schedulePreview, setSchedulePreview] = useState("");
  const [operationError, setOperationError] = useState("");
  const [operationNotice, setOperationNotice] = useState("");
  useEffect(() => {
    let active = true;
    setJobs(null);
    if (selected)
      api<{ items: PullJob[]; total: number }>(
        base + "/" + selected + "/jobs?offset=" + jobOffset,
      )
        .then((value) => {
          if (active) setJobs(value);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [base, selected, jobOffset, revision]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api<Listing>(base + "?offset=" + offset)
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [base, offset, revision]);
  useEffect(() => {
    let active = true;
    setRuns(null);
    if (selected)
      api<{ items: Run[]; total: number }>(
        base + "/" + selected + "/runs?offset=" + runOffset,
      )
        .then((v) => {
          if (active) setRuns(v);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [base, selected, runOffset, revision]);
  const row = data?.items.find((item) => item.id === selected);
  async function command(path: string, body: unknown, success: string) {
    setOperationError("");
    setOperationNotice("");
    let result: { signing_key?: string; run?: Run };
    try {
      result = await api(path, body);
    } catch (error) {
      setOperationError(
        error instanceof Error ? error.message : "Connection action failed.",
      );
      if (error instanceof ApiError && error.status === 409)
        setRevision((v) => v + 1);
      throw error;
    }
    if (result.signing_key) setSecret(result.signing_key);
    setRevision((v) => v + 1);
    if (result.run?.state === "failed") {
      const message =
        "Provider operation failed: " +
        result.run.error_code +
        ". Inspect the recorded run and correct the connection before retrying.";
      setOperationError(message);
      throw new Error(message);
    }
    const message =
      result.run && result.run.operation === "pull"
        ? `${result.run.received_count} new receipts, ${result.run.duplicate_count} duplicate events. Evidence still requires review.`
        : success;
    setOperationNotice(message);
    return message;
  }
  return (
    <section className="connections-workspace">
      <div className="intake-heading">
        <div>
          <h2>Provider connections</h2>
          <p className="muted">
            Local synthetic sandbox · authenticated transport and traceable
            receipts
          </p>
        </div>
        <button className="secondary" onClick={() => setRevision((v) => v + 1)}>
          Refresh connections
        </button>
      </div>
      <p className="connection-boundary">
        This connects to the separate local provider simulator. A verified
        sandbox is not a commercial provider or production integration.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {operationError && (
        <p role="alert" className="error">
          {operationError}
        </p>
      )}
      {operationNotice && (
        <p role="status" className="action-confirmation">
          {operationNotice}
        </p>
      )}
      {secret && (
        <section
          className="one-time-key"
          aria-label="One-time webhook signing key"
        >
          <h3>Store the webhook signing key securely</h3>
          <p>
            This key is shown only for this operation. It is separate from the
            provider credential and is not stored in browser storage.
          </p>
          <label>
            Webhook signing key
            <input type="password" readOnly value={secret} autoComplete="off" />
          </label>
          <button className="secondary" onClick={() => setSecret("")}>
            Hide key
          </button>
        </section>
      )}
      {!data && !error && <p role="status">Loading provider connections…</p>}
      {data && data.items.length === 0 && (
        <div className="intake-empty">
          <h3>No provider connection configured</h3>
          <p>
            {data.can_manage
              ? "Configure the local simulator account, then run an actual connection test."
              : "A company administrator must authorize provider access before it can be tested."}
          </p>
        </div>
      )}
      {data && data.items.length > 0 && (
        <div
          className="table-scroll"
          role="region"
          aria-label="Provider connections"
          tabIndex={0}
        >
          <table className="management-table">
            <thead>
              <tr>
                <th scope="col">Provider / account</th>
                <th scope="col">State</th>
                <th scope="col">Last actual test</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>Local synthetic provider</strong>
                    <small>{item.account_ref}</small>
                  </td>
                  <td>
                    <State value={item.state} />
                  </td>
                  <td>
                    {item.tested_at ? (
                      <time dateTime={item.tested_at}>
                        {new Date(item.tested_at).toLocaleString()}
                      </time>
                    ) : (
                      "Not tested"
                    )}
                  </td>
                  <td>
                    <button
                      className="quiet"
                      onClick={() => {
                        setSecret("");
                        setSelected(item.id);
                        setRunOffset(0);
                        setJobOffset(0);
                      }}
                    >
                      {data.can_manage
                        ? "Manage connection"
                        : "View diagnostics"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > 25 && (
        <div className="intake-pagination">
          <button
            className="secondary"
            disabled={!offset}
            onClick={() => {
              setOffset((v) => v - 25);
              setSelected("");
            }}
          >
            Previous connections
          </button>
          <span>
            {offset + 1}–{Math.min(offset + 25, data.total)} of {data.total}
          </span>
          <button
            className="secondary"
            disabled={offset + 25 >= data.total}
            onClick={() => {
              setOffset((v) => v + 25);
              setSelected("");
            }}
          >
            Next connections
          </button>
        </div>
      )}
      {data?.can_manage && (
        <details className="connection-create">
          <summary>Configure local provider access</summary>
          <p>
            Prepare <code>.local/provider-simulator.json</code> using the
            documented setup command, then start the loopback provider service.
            Saving does not verify connectivity.
          </p>
          <Form
            label="Save provider connection"
            onSave={(d) =>
              command(
                base,
                d,
                "Connection saved as configured. Run Test connection next.",
              )
            }
          >
            <Field
              name="account_ref"
              label="Provider account reference"
              pattern="[A-Za-z0-9_-]+"
              minLength={3}
              maxLength={100}
            />
            <Field
              name="credential"
              label="Provider access credential"
              type="password"
              minLength={8}
              maxLength={512}
              autoComplete="off"
            />
            <Field
              multiline
              name="reason"
              label="Provider access authorization rationale"
              minLength={10}
              maxLength={500}
            />
          </Form>
        </details>
      )}
      {row && (
        <section
          className="connection-detail"
          aria-label="Selected connection"
          data-version={row.version}
        >
          <div className="intake-heading">
            <div>
              <h3>{row.account_ref}</h3>
              <p className="muted">
                Credential version {row.credential_version} · mapping
                qf-sandbox-v1
              </p>
            </div>
            <State value={row.state} />
          </div>
          {data?.can_manage && row.state !== "revoked" && (
            <div className="connection-actions">
              <Form
                key={"test" + row.version}
                label="Test connection"
                onSave={(d) =>
                  command(
                    base + "/" + row.id + "/test",
                    { ...d, version: row.version },
                    "Authenticated local sandbox test passed.",
                  )
                }
              >
                <Field
                  name="reason"
                  label="Connection test rationale"
                  minLength={5}
                  maxLength={500}
                />
              </Form>
              {row.state === "sandbox_verified" && (
                <Form
                  key={"pull" + row.version}
                  label="Queue provider pull"
                  onSave={(d) =>
                    command(
                      base + "/" + row.id + "/pull-jobs",
                      {
                        ...d,
                        version: row.version,
                        command_id: crypto.randomUUID(),
                      },
                      "Provider pull queued. Refresh connections to inspect the recorded outcome.",
                    )
                  }
                >
                  <Field
                    name="reason"
                    label="Pull rationale"
                    minLength={5}
                    maxLength={500}
                  />
                </Form>
              )}
              <Form
                key={"pause" + row.version}
                label={
                  row.state === "paused"
                    ? "Resume sandbox connection"
                    : "Pause connection"
                }
                onSave={(d) =>
                  command(
                    base +
                      "/" +
                      row.id +
                      (row.state === "paused" ? "/resume" : "/pause"),
                    { ...d, version: row.version },
                    "Connection state updated.",
                  )
                }
              >
                <Field
                  name="reason"
                  label="Connection state rationale"
                  minLength={5}
                  maxLength={500}
                />
              </Form>
            </div>
          )}
          {data?.can_manage && row.state === "sandbox_verified" && (
            <details className="connection-create">
              <summary>Create a synthetic provider record</summary>
              <p>
                This creates a record at the separate provider simulator. Pull
                provider records afterward to receive it into Screening inbox.
              </p>
              <Form
                key={"simulate" + row.version}
                label="Create synthetic provider record"
                onSave={(d) =>
                  command(
                    base + "/" + row.id + "/simulator/records",
                    { ...d, version: row.version },
                    "Synthetic record created at the provider. Pull it to receive its metadata.",
                  )
                }
              >
                <Field
                  name="driver_reference"
                  label="Exact company driver reference"
                  maxLength={100}
                />
                <Field
                  name="report_reference"
                  label="Synthetic report reference"
                  maxLength={100}
                />
                <label>
                  Report category
                  <select name="report_type">
                    <option value="background_screening">
                      Background screening
                    </option>
                    <option value="motor_vehicle_record">
                      Motor vehicle record
                    </option>
                    <option value="employment_verification">
                      Employment verification
                    </option>
                  </select>
                </label>
                <Field
                  name="reported_at"
                  label="Provider reported date"
                  type="date"
                />
                <Field
                  name="reason"
                  label="Simulation rationale"
                  minLength={5}
                  maxLength={500}
                />
              </Form>
            </details>
          )}
          {data?.can_manage && row.state !== "revoked" && (
            <details className="connection-create">
              <summary>
                Scheduled metadata pulls ·{" "}
                {row.sync_enabled ? "Enabled" : "Paused"}
              </summary>
              <p>
                {row.next_sync_at && row.sync_enabled
                  ? "Next pull: " + new Date(row.next_sync_at).toLocaleString()
                  : "Future pulls are paused."}{" "}
                {row.sync_error && "Approval required: " + row.sync_error}
              </p>
              <Form
                key={"schedule" + row.version}
                label="Review or save pull schedule"
                onSave={async (d) => {
                  const result = await api<{
                    dry_run?: boolean;
                    next_action?: string;
                    interval_minutes?: number;
                  }>(base + "/" + row.id + "/sync-schedule", {
                    ...d,
                    version: row.version,
                    enabled: d.enabled === "true",
                    interval_minutes: Number(d.interval_minutes),
                    dry_run: d.dry_run === "true",
                  });
                  if (result.dry_run) {
                    setSchedulePreview(
                      `Preview: ${result.next_action?.replaceAll("_", " ")} every ${result.interval_minutes} minutes. No schedule or intake data changed.`,
                    );
                    return "Dry run complete.";
                  }
                  setSchedulePreview("");
                  setRevision((v) => v + 1);
                  return "Pull schedule saved. Each run rechecks current authority; evidence still requires review.";
                }}
              >
                <Field
                  label="Future provider pulls"
                  name="enabled"
                  defaultValue={String(row.sync_enabled)}
                >
                  <option value="false">Paused</option>
                  <option value="true">Enabled with employer approval</option>
                </Field>
                <Field
                  label="Pull interval"
                  name="interval_minutes"
                  defaultValue={String(row.sync_interval_minutes)}
                >
                  <option value="15">Every 15 minutes</option>
                  <option value="60">Every hour</option>
                  <option value="1440">Every 24 hours</option>
                </Field>
                <Field
                  label="Schedule operation"
                  name="dry_run"
                  defaultValue="true"
                >
                  <option value="true">Preview only — no changes</option>
                  <option value="false">Save approved schedule</option>
                </Field>
                <Field
                  name="reason"
                  label="Schedule approval rationale"
                  minLength={10}
                  maxLength={500}
                />
              </Form>
              {schedulePreview && <p role="status">{schedulePreview}</p>}
            </details>
          )}
          {data?.can_manage && row.state !== "revoked" && (
            <details className="connection-create">
              <summary>Credentials, webhook and revocation</summary>
              <p>
                Signed webhook path:{" "}
                <code>/api/v1/provider-webhooks/{row.id}</code>. Send
                X-QF-Timestamp and HMAC-SHA256 X-QF-Signature over timestamp +
                period + raw JSON body. Timestamp tolerance: five minutes.
                Mapping: qf-sandbox-v1.
              </p>
              <Form
                key={"rotate" + row.version}
                label="Rotate provider credential"
                onSave={(d) =>
                  command(
                    base + "/" + row.id + "/credentials/rotate",
                    { ...d, version: row.version },
                    "Credential rotated. A fresh authenticated test is required.",
                  )
                }
              >
                <Field
                  name="credential"
                  label="New provider credential"
                  type="password"
                  minLength={8}
                  maxLength={512}
                  autoComplete="off"
                />
                <Field
                  name="reason"
                  label="Credential rotation rationale"
                  minLength={5}
                  maxLength={500}
                />
              </Form>
              <Form
                key={"key" + row.version}
                label="Rotate webhook signing key"
                onSave={(d) =>
                  command(
                    base + "/" + row.id + "/rotate-signing-key",
                    { ...d, version: row.version },
                    "Signing key rotated. The old key no longer authenticates requests.",
                  )
                }
              >
                <Field
                  name="reason"
                  label="Signing key rotation rationale"
                  minLength={5}
                  maxLength={500}
                />
              </Form>
              <Form
                key={"revoke" + row.version}
                label="Revoke connection"
                onSave={(d) =>
                  command(
                    base + "/" + row.id + "/revoke",
                    { ...d, version: row.version },
                    "Connection revoked. Existing source history is preserved.",
                  )
                }
              >
                <Field
                  multiline
                  name="reason"
                  label="Permanent revocation rationale"
                  minLength={10}
                  maxLength={500}
                />
              </Form>
            </details>
          )}
          <h3>Provider pull jobs</h3>
          {jobs && jobs.items.length === 0 && (
            <p>No provider pull has been queued.</p>
          )}
          {jobs && jobs.items.length > 0 && (
            <div
              className="table-scroll"
              role="region"
              aria-label="Provider pull jobs"
              tabIndex={0}
            >
              <table className="management-table">
                <thead>
                  <tr>
                    <th scope="col">Queued</th>
                    <th scope="col">State</th>
                    <th scope="col">Attempts</th>
                    <th scope="col">Diagnostics / next attempt</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.items.map((job) => (
                    <tr key={job.id} data-provider-job={job.id}>
                      <td>{new Date(job.created_at).toLocaleString()}</td>
                      <td>
                        <State value={job.status} />
                      </td>
                      <td>{job.attempts} / 5</td>
                      <td>
                        {job.error_code || "—"}
                        {job.status === "retry_scheduled" && (
                          <small>
                            {new Date(job.available_at).toLocaleString()}
                          </small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {jobs && jobs.total > 25 && (
            <div className="intake-pagination">
              <button
                className="secondary"
                disabled={!jobOffset}
                onClick={() => setJobOffset((v) => v - 25)}
              >
                Previous jobs
              </button>
              <button
                className="secondary"
                disabled={jobOffset + 25 >= jobs.total}
                onClick={() => setJobOffset((v) => v + 25)}
              >
                Next jobs
              </button>
            </div>
          )}
          <h3>Recorded runs</h3>
          {!runs && <p role="status">Loading connection diagnostics…</p>}
          {runs && runs.items.length === 0 && (
            <p>No connection operation has been recorded.</p>
          )}
          {runs && runs.items.length > 0 && (
            <div
              className="table-scroll"
              role="region"
              aria-label="Connection run history"
              tabIndex={0}
            >
              <table className="management-table">
                <thead>
                  <tr>
                    <th scope="col">Operation / time</th>
                    <th scope="col">Outcome</th>
                    <th scope="col">New / duplicate receipts</th>
                    <th scope="col">Diagnostic reference</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.items.map((run) => (
                    <tr key={run.id}>
                      <td>
                        <strong>{run.operation}</strong>
                        <small>
                          {new Date(run.created_at).toLocaleString()}
                        </small>
                      </td>
                      <td>
                        <State value={run.state} />
                        {run.error_code && <small>{run.error_code}</small>}
                      </td>
                      <td>
                        {run.operation === "pull"
                          ? run.received_count + " / " + run.duplicate_count
                          : "—"}
                      </td>
                      <td>
                        <code>{run.correlation_id}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {runs && runs.total > 25 && (
            <div className="intake-pagination">
              <button
                className="secondary"
                disabled={!runOffset}
                onClick={() => setRunOffset((v) => v - 25)}
              >
                Previous runs
              </button>
              <button
                className="secondary"
                disabled={runOffset + 25 >= runs.total}
                onClick={() => setRunOffset((v) => v + 25)}
              >
                Next runs
              </button>
            </div>
          )}
          <p className="muted">
            <Icon name="info" size={14} /> Transport diagnostics describe
            reception only. Open Screening inbox to inspect records and review
            evidence in the correct driver file.
          </p>
        </section>
      )}
    </section>
  );
}
