import { useEffect, useState } from "react";
import { api, type Engagement } from "./api";
import { Form, Field, State } from "./Forms";

type Definition = {
  id: string;
  code: string;
  title: string;
  revision: number;
  category: string;
  requires_expiry: boolean;
  basis: string;
};
type Evidence = {
  id: string;
  revision: number;
  version: number;
  filename: string;
  status: string;
  byte_size: number;
  uploaded_at: string;
  sha256: string;
  scanner: string | null;
  scan_error: string | null;
  can_download: boolean;
  review: {
    outcome: string;
    reason: string;
    reviewer: string;
    reviewed_at: string;
    expires_on: string | null;
  } | null;
};
type Requirement = {
  id: string;
  title: string;
  code: string;
  category: string;
  policy_revision: number;
  engagement_id: string;
  engagement_current: boolean;
  requires_expiry: boolean;
  status: string;
  evidence: Evidence[];
};
type FileData = {
  items: Requirement[];
  definitions: Definition[];
  can_review: boolean;
};
type Source = {
  id: string;
  report_reference: string;
  category: string;
  driver_reference: string;
};
const words = (value: string) => value.replaceAll("_", " ");

export function RequirementCatalog({ companyId }: { companyId: string }) {
  const path = "/tenants/" + companyId + "/requirements";
  const [catalog, setCatalog] = useState<{
    items: Definition[];
    can_configure: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api<typeof catalog>(path)
      .then((value) => {
        if (active) setCatalog(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return (
    <section className="qualification-workspace">
      <h3>Client requirement catalog</h3>
      <p className="muted">
        Configure the evidence your client's process requires. These are
        operational definitions; regulatory applicability has not been verified.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!catalog && !error && <p role="status">Loading requirements…</p>}
      {catalog &&
        (catalog.items.length ? (
          <div
            className="table-scroll"
            role="region"
            aria-label="Client requirement definitions"
            tabIndex={0}
          >
            <table className="management-table">
              <thead>
                <tr>
                  <th scope="col">Requirement</th>
                  <th scope="col">Category</th>
                  <th scope="col">Revision</th>
                  <th scope="col">Expiry date</th>
                </tr>
              </thead>
              <tbody>
                {catalog.items.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.title}</strong>
                      <small>{d.code}</small>
                    </td>
                    <td>{words(d.category)}</td>
                    <td>{d.revision}</td>
                    <td>
                      {d.requires_expiry
                        ? "Reviewer must enter a date"
                        : "Optional; never inferred"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="intake-empty">
            <h4>No requirements configured</h4>
            <p>
              Add a requirement based on the client's documented process, then
              assign it to a driver's engagement.
            </p>
          </div>
        ))}
      {catalog?.can_configure && (
        <details className="requirement-configure">
          <summary>Create a requirement or new revision</summary>
          <p className="muted">
            Reusing a code creates a new policy revision. Existing driver
            requirements keep their original definition and review history.
          </p>
          <Form
            label="Save requirement revision"
            onSave={async (d) => {
              await api(path, {
                ...d,
                requires_expiry: d.requires_expiry === "yes",
              });
              setRevision((v) => v + 1);
              return "Requirement revision saved.";
            }}
          >
            <Field
              name="code"
              label="Stable requirement code"
              pattern="[A-Z0-9][A-Z0-9_-]{1,63}"
              maxLength={64}
              help="Uppercase letters, digits, hyphens or underscores."
            />
            <Field
              name="title"
              label="Requirement name"
              minLength={3}
              maxLength={160}
            />
            <label>
              Evidence category
              <select name="category" required>
                {[
                  "motor_vehicle_record",
                  "medical_certificate",
                  "license",
                  "employment_verification",
                  "background_screening",
                  "other",
                ].map((value) => (
                  <option key={value} value={value}>
                    {words(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Does this client process require an expiry date?
              <select name="requires_expiry">
                <option value="no">No mandatory expiry date</option>
                <option value="yes">
                  Reviewer must record the explicit expiry date
                </option>
              </select>
            </label>
            <Field
              multiline
              name="basis"
              label="Client process and applicability basis"
              minLength={10}
              maxLength={2000}
            />
          </Form>
        </details>
      )}
    </section>
  );
}

export function QualificationFile({
  path,
  engagements,
  sourceItemId,
}: {
  path: string;
  engagements: Engagement[];
  sourceItemId?: string;
}) {
  const [file, setFile] = useState<FileData | null>(null),
    [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<{
    requirementId: string;
    file: File;
    commandId: string;
  } | null>(null);
  async function load() {
    const [value, context] = await Promise.all([
      api<FileData>(path),
      sourceItemId
        ? api<Source>(path + "/source-context/" + sourceItemId)
        : Promise.resolve(null),
    ]);
    setFile(value);
    setSource(context);
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      api<FileData>(path),
      sourceItemId
        ? api<Source>(path + "/source-context/" + sourceItemId)
        : Promise.resolve(null),
    ])
      .then(([value, context]) => {
        if (active) {
          setFile(value);
          setSource(context);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, sourceItemId]);
  const waiting = file?.items.some((r) =>
    r.evidence.some((e) => ["quarantined", "scanning"].includes(e.status)),
  );
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      if (!document.hidden)
        void api<FileData>(path)
          .then(setFile)
          .catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [waiting, path]);
  async function action(work: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await load();
      setNotice(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="qualification-workspace" aria-busy={busy}>
      <div className="intake-heading">
        <div>
          <h3>Qualification file</h3>
          <p className="muted">
            Assign requirements → upload private evidence → verify the record →
            record a review.
          </p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void action(load, "File refreshed.")}
        >
          Refresh file
        </button>
      </div>
      <p className="file-safety">
        Synthetic documents only. Requirement and evidence statuses describe
        administrative records, not legal driving eligibility.
      </p>
      {source && (
        <div className="file-source-context">
          <strong>Working from intake report {source.report_reference}</strong>
          <p>
            Driver reference {source.driver_reference} ·{" "}
            {words(source.category)}. Select the matching requirement below.
            Acceptance records the source-to-file attachment.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="action-confirmation">
          {notice}
        </p>
      )}
      {!file && !error && <p role="status">Loading driver file…</p>}
      {file && (
        <>
          <details
            className="requirement-configure"
            open={file.items.length === 0}
          >
            <summary>Assign a client requirement</summary>
            {file.definitions.length ? (
              <Form
                label="Assign requirement"
                onSave={async (d) => {
                  await api(path + "/requirements", d);
                  await load();
                  return "Requirement assigned to this engagement.";
                }}
              >
                <label>
                  Client requirement
                  <select name="definition_id" required>
                    {file.definitions
                      .filter((d) => !source || d.category === source.category)
                      .map((d) => (
                        <option value={d.id} key={d.id}>
                          {d.title} · revision {d.revision}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Employer engagement
                  <select name="engagement_id" required>
                    {engagements.map((e) => (
                      <option value={e.id} key={e.id}>
                        {e.branch_name || "Whole company"} · {e.start_date} ·{" "}
                        {e.end_date ? "ended " + e.end_date : "current"}
                      </option>
                    ))}
                  </select>
                </label>
              </Form>
            ) : (
              <p className="muted">
                A company administrator or assigned reviewer must configure the
                client's requirements first. No regulatory checklist is assumed.
              </p>
            )}
          </details>
          {file.items.length === 0 && (
            <div className="intake-empty">
              <h4>No requirements assigned</h4>
              <p>
                Choose the client requirement and the correct employer
                engagement above to start this file.
              </p>
            </div>
          )}
          <div className="requirement-list">
            {file.items.map((req) => (
              <section className="requirement-record" key={req.id}>
                <div className="intake-heading">
                  <div>
                    <h4>{req.title}</h4>
                    <p className="muted">
                      {req.code} · policy revision {req.policy_revision} ·{" "}
                      {req.engagement_current
                        ? "Current engagement"
                        : "Historical engagement"}
                    </p>
                  </div>
                  <State value={req.status} />
                </div>
                {!source || source.category === req.category ? (
                  <div className="evidence-upload">
                    <label htmlFor={"file-" + req.id}>
                      Add evidence version{" "}
                      <span className="muted">
                        PDF, PNG or JPEG · up to 2 MiB
                      </span>
                    </label>
                    <input
                      id={"file-" + req.id}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      disabled={busy}
                      onChange={(e) => {
                        setError("");
                        const selected = e.target.files?.[0];
                        if (selected && selected.size > 2 * 1024 * 1024) {
                          setError("Choose a file up to 2 MiB.");
                          setChoice(null);
                        } else
                          setChoice(
                            selected
                              ? {
                                  requirementId: req.id,
                                  file: selected,
                                  commandId: crypto.randomUUID(),
                                }
                              : null,
                          );
                      }}
                    />
                    {choice?.requirementId === req.id && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            const bytes = new Uint8Array(
                              await choice.file.arrayBuffer(),
                            );
                            let binary = "";
                            for (let i = 0; i < bytes.length; i += 32768)
                              binary += String.fromCharCode(
                                ...bytes.subarray(i, i + 32768),
                              );
                            await api(
                              path + "/requirements/" + req.id + "/evidence",
                              {
                                command_id: choice.commandId,
                                filename: choice.file.name,
                                content_base64: btoa(binary),
                                source_item_id: source?.id || null,
                              },
                            );
                            setChoice(null);
                          }, "Evidence received privately and queued for scanning. It has not been accepted.")
                        }
                      >
                        {busy ? "Uploading…" : "Upload for scanning"}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="muted">
                    This requirement category differs from the selected intake
                    source. Use the matching requirement to attach this source.
                  </p>
                )}
                {req.evidence.length === 0 ? (
                  <p className="muted">
                    No evidence submitted. This requirement remains missing.
                  </p>
                ) : (
                  <ol className="evidence-versions">
                    {req.evidence.map((ev) => (
                      <li key={ev.id}>
                        <div className="intake-heading">
                          <div>
                            <strong>{ev.filename}</strong>
                            <p className="muted">
                              Version {ev.revision} ·{" "}
                              {Math.ceil(ev.byte_size / 1024)} KB · uploaded{" "}
                              {new Date(ev.uploaded_at).toLocaleString()}
                            </p>
                          </div>
                          <State value={ev.status} />
                        </div>
                        {ev.can_download && (
                          <a
                            className="file-download"
                            href={
                              "/api/v1" +
                              path +
                              "/requirements/" +
                              req.id +
                              "/evidence/" +
                              ev.id +
                              "/download"
                            }
                          >
                            Download authorized copy
                          </a>
                        )}
                        {ev.scan_error && (
                          <div className="file-scan-warning">
                            <p>
                              Scan did not clear this file:{" "}
                              {ev.scan_error.replaceAll("_", " ").toLowerCase()}
                              . Review and download stay unavailable.
                            </p>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                void action(async () => {
                                  await api(
                                    path +
                                      "/requirements/" +
                                      req.id +
                                      "/evidence/" +
                                      ev.id +
                                      "/retry-scan",
                                    {},
                                  );
                                }, "Scan retry queued.")
                              }
                            >
                              Retry scan
                            </button>
                          </div>
                        )}
                        {ev.status === "quarantined" && (
                          <p className="muted" role="status">
                            Waiting for a security scan.
                          </p>
                        )}
                        {ev.status === "scanning" && (
                          <p className="muted" role="status">
                            Antivirus scan is running. Evidence cannot be
                            reviewed yet.
                          </p>
                        )}
                        {ev.review && (
                          <div className="evidence-decision">
                            <strong>{words(ev.review.outcome)}</strong>
                            <p>{ev.review.reason}</p>
                            <small>
                              {ev.review.reviewer} ·{" "}
                              {new Date(ev.review.reviewed_at).toLocaleString()}
                              {ev.review.expires_on &&
                                " · expires " + ev.review.expires_on}
                            </small>
                          </div>
                        )}
                        {file.can_review && ev.status === "needs_review" && (
                          <details className="evidence-review">
                            <summary>
                              Review evidence version {ev.revision}
                            </summary>
                            <p className="muted">
                              Open the authorized copy and compare it with the
                              selected driver, engagement and requirement before
                              deciding.
                            </p>
                            <Form
                              key={ev.id + ev.version}
                              label="Record evidence review"
                              onSave={async (d) => {
                                await api(
                                  path +
                                    "/requirements/" +
                                    req.id +
                                    "/evidence/" +
                                    ev.id +
                                    "/review",
                                  {
                                    version: ev.version,
                                    outcome: d.outcome,
                                    reason: d.reason,
                                    identity_verified:
                                      d.identity_verified === "on",
                                    category_verified:
                                      d.category_verified === "on",
                                    completeness_verified:
                                      d.completeness_verified === "on",
                                    expires_on: d.expires_on || null,
                                  },
                                );
                                await load();
                                return "Evidence review recorded with its reviewer, source and policy revision.";
                              }}
                            >
                              <label>
                                Review outcome
                                <select name="outcome">
                                  <option value="needs_more_information">
                                    Request more information
                                  </option>
                                  <option value="verified_evidence">
                                    Accept verified evidence
                                  </option>
                                  <option value="rejected_evidence">
                                    Reject evidence
                                  </option>
                                  <option value="escalated">
                                    Escalate for review
                                  </option>
                                </select>
                              </label>
                              <label className="review-check">
                                <input
                                  type="checkbox"
                                  name="identity_verified"
                                />
                                Driver identity and employer engagement agree
                              </label>
                              <label className="review-check">
                                <input
                                  type="checkbox"
                                  name="category_verified"
                                />
                                Evidence matches this requirement category
                              </label>
                              <label className="review-check">
                                <input
                                  type="checkbox"
                                  name="completeness_verified"
                                />
                                Evidence is readable and complete
                              </label>
                              <Field
                                type="date"
                                name="expires_on"
                                label={
                                  req.requires_expiry
                                    ? "Explicit expiry date (required for acceptance)"
                                    : "Explicit expiry date, if present"
                                }
                                required={false}
                              />
                              <Field
                                multiline
                                name="reason"
                                label="Review findings and verified basis"
                                minLength={10}
                                maxLength={2000}
                              />
                            </Form>
                          </details>
                        )}
                        <details className="evidence-integrity">
                          <summary>Integrity and scan information</summary>
                          <p>
                            SHA-256: <code>{ev.sha256}</code>
                            <br />
                            Scanner: {ev.scanner || "Not completed"}
                          </p>
                        </details>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
