import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Form, Field, State } from "./Forms";
import { IdentityMark } from "./VisualInformation";

type CaseRow = {
  id: string;
  category: string;
  state: string;
  version: number;
  owner: string | null;
  created_at: string;
  task_status: string;
};
type CaseDetail = CaseRow & {
  source_item_id: string | null;
  source_linked: boolean;
  batch_id: string;
  source: { normalized: Record<string, string>; reason: string } | null;
  requirement: {
    id: string;
    driver_id: string;
    reference: string;
    engagement_id: string;
    title: string;
    code: string;
    status: string;
  } | null;
  allowed_states: string[];
  can_request_approval: boolean;
  events: {
    id: string;
    action: string;
    actor: string;
    occurred_at: string;
    details: { reason: string };
  }[];
};
type Approval = {
  id: string;
  case_id: string;
  case_version: number;
  proposal: string;
  status: string;
  expires_at: string;
  requested_by: string;
  can_decide: boolean;
  can_withdraw: boolean;
  decision: {
    outcome: string;
    reason: string;
    actor: string;
    decided_at: string;
  } | null;
};
const words = (text: string) =>
  (
    ({
      blocked_by_policy: "Evidence review needed",
      validation_failed: "Source correction needed",
      unmatched: "Driver reference not found",
      duplicate_detected: "Duplicate source report",
    }) as Record<string, string>
  )[text] || text.replaceAll("_", " ");

export function WorkQueues({
  companyId,
  mode,
  onOpenDriver,
  initialCaseId,
}: {
  companyId: string;
  mode: "exceptions" | "approvals";
  onOpenDriver?: (driver: string, source: string) => void;
  initialCaseId?: string;
}) {
  const base = "/tenants/" + companyId;
  const requestCommand = useRef(crypto.randomUUID());
  const [page, setPage] = useState<{
    items: (CaseRow | Approval)[];
    total: number;
  } | null>(null);
  const [offset, setOffset] = useState(0),
    [state, setState] = useState("");
  const [selected, setSelected] = useState<CaseDetail | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (mode !== "exceptions" || !initialCaseId) return;
    let current = true;
    api<CaseDetail>(base + "/exceptions/" + initialCaseId)
      .then((value) => {
        if (current) setSelected(value);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [base, mode, initialCaseId]);
  useEffect(() => {
    let active = true;
    setPage(null);
    setError("");
    api<{ items: (CaseRow | Approval)[]; total: number }>(
      base +
        "/" +
        mode +
        "?offset=" +
        offset +
        (mode === "exceptions" && state ? "&state=" + state : ""),
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
  }, [base, mode, offset, state, revision]);
  async function open(id: string) {
    setError("");
    setNotice("");
    try {
      setSelected(await api<CaseDetail>(base + "/exceptions/" + id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function saved(path: string, body: unknown, message: string) {
    await api(base + path, body);
    if (selected)
      setSelected(await api<CaseDetail>(base + "/exceptions/" + selected.id));
    setRevision((v) => v + 1);
    setNotice(message);
  }
  return (
    <section className="work-queue">
      <div className="intake-heading">
        <div>
          <h2>{mode === "approvals" ? "Decision requests" : "Case queue"}</h2>
          <p className="muted">
            {mode === "approvals"
              ? "Employer decisions for exact case versions."
              : "Review source issues, ownership and the next permitted action."}
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            if (selected) void open(selected.id);
            else setRevision((v) => v + 1);
          }}
        >
          Refresh
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="action-confirmation">
          {notice}
        </p>
      )}
      {selected ? (
        <>
          <button
            className="secondary"
            onClick={() => {
              setSelected(null);
              setNotice("");
            }}
          >
            Back to queue
          </button>
          <div className="case-identity">
            <h3>{words(selected.category)}</h3>
            <State value={selected.state} />
            <span className="muted">
              Version {selected.version} · {selected.owner || "Unassigned"}
            </span>
          </div>
          <div className="case-context">
            <section>
              <h3>
                {selected.requirement
                  ? "Driver requirement"
                  : "Incoming source"}
              </h3>
              {selected.requirement && (
                <>
                  <dl>
                    <dt>Driver reference</dt>
                    <dd>{selected.requirement.reference}</dd>
                    <dt>Requirement</dt>
                    <dd>{selected.requirement.title}</dd>
                    <dt>Current evidence state</dt>
                    <dd>
                      <State value={selected.requirement.status} />
                    </dd>
                  </dl>
                  <button
                    className="secondary"
                    onClick={() =>
                      onOpenDriver?.(selected.requirement!.driver_id, "")
                    }
                  >
                    Open driver file
                  </button>
                </>
              )}
              {selected.source && (
                <>
                  <dl>
                    <dt>Report reference</dt>
                    <dd>{selected.source.normalized.external_report_ref}</dd>
                    <dt>Driver reference</dt>
                    <dd>{selected.source.normalized.external_driver_ref}</dd>
                    <dt>Report category</dt>
                    <dd>{words(selected.source.normalized.report_type)}</dd>
                  </dl>
                  {onOpenDriver &&
                    !["validation_failed", "duplicate_detected"].includes(
                      selected.category,
                    ) && (
                      <button
                        className="secondary"
                        onClick={() => {
                          setError("");
                          void api<{
                            driver_id: string;
                            source_item_id: string;
                          }>(
                            base +
                              "/intake-batches/" +
                              selected.batch_id +
                              "/items/" +
                              selected.source_item_id +
                              "/driver-candidate",
                          )
                            .then((match) =>
                              onOpenDriver(
                                match.driver_id,
                                match.source_item_id,
                              ),
                            )
                            .catch((e) => setError(e.message));
                        }}
                      >
                        Open driver file for evidence review
                      </button>
                    )}
                </>
              )}
            </section>
            <section>
              <h3>
                {selected.source_linked
                  ? "Review follow-up"
                  : "What needs attention"}
              </h3>
              {selected.source_linked && (
                <p>
                  Evidence review is recorded for this source. Check the
                  driver's file and decide the appropriate administrative
                  follow-up; the case has not been closed automatically.
                </p>
              )}
              <p>
                {selected.source?.reason ||
                  "Follow up on this configured requirement. Evidence must be reviewed before administrative resolution; client communication follows the approved recipient process."}
              </p>
              <p className="muted">
                Administrative resolution does not attach evidence or change
                driver qualification. Missing evidence controls cannot be
                overridden here.
              </p>
            </section>
          </div>
          <div className="case-context">
            <section>
              <h3>Next action</h3>
              {selected.allowed_states.length > 0 ? (
                <Form
                  key={"state" + selected.version}
                  label="Update case"
                  onSave={async (d) =>
                    saved(
                      "/exceptions/" + selected.id + "/state",
                      { ...d, version: selected.version },
                      "Case updated.",
                    )
                  }
                >
                  <label>
                    Case state
                    <select name="state" required>
                      {selected.allowed_states.map((s) => (
                        <option key={s} value={s}>
                          {s === "assigned" ? "Assign to me" : words(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    multiline
                    name="reason"
                    label="Rationale and verified resolution context"
                    minLength={10}
                    maxLength={2000}
                  />
                </Form>
              ) : (
                <p className="muted">
                  No direct state change is available to your current role.
                  Review the case history or pending approval.
                </p>
              )}
            </section>
            <section>
              <h3>Review note</h3>
              <Form
                key={"note" + selected.version}
                label="Add note"
                onSave={async (d) =>
                  saved(
                    "/exceptions/" + selected.id + "/notes",
                    { ...d, version: selected.version },
                    "Review note recorded.",
                  )
                }
              >
                <Field
                  multiline
                  name="reason"
                  label="Note"
                  minLength={5}
                  maxLength={2000}
                />
              </Form>
            </section>
          </div>
          {selected.can_request_approval && (
            <section className="case-approval">
              <h3>Request employer approval</h3>
              <p className="muted">
                Propose administrative resolution of this exact case version.
                This is not an eligibility decision or permission to send an
                external message.
              </p>
              <Form
                key={"approval" + selected.version}
                label="Request approval"
                onSave={async (d) =>
                  saved(
                    "/exceptions/" + selected.id + "/approvals",
                    {
                      version: selected.version,
                      proposal: d.proposal,
                      expires_at: new Date(d.expires_at).toISOString(),
                    },
                    "Employer approval requested.",
                  )
                }
              >
                <Field
                  multiline
                  name="proposal"
                  label="Proposed resolution and verified basis"
                  minLength={20}
                  maxLength={2000}
                />
                <Field
                  name="expires_at"
                  label="Approval expiry (your local time)"
                  type="datetime-local"
                />
              </Form>
            </section>
          )}
          <section className="case-timeline">
            <h3>Case history</h3>
            <ol>
              {selected.events.map((event) => (
                <li key={event.id}>
                  <strong>
                    {words(
                      event.action
                        .replace("exception.", "")
                        .replace("approval.", "Approval "),
                    )}
                  </strong>
                  <p>{event.details.reason}</p>
                  <small>
                    {event.actor} ·{" "}
                    {new Date(event.occurred_at).toLocaleString()}
                  </small>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : (
        <>
          {mode === "exceptions" && (
            <label className="queue-filter">
              State
              <select
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All states</option>
                {[
                  "open",
                  "assigned",
                  "in_review",
                  "awaiting_client",
                  "awaiting_internal_approval",
                  "resolved",
                  "closed",
                  "reopened",
                  "canceled",
                ].map((s) => (
                  <option key={s} value={s}>
                    {words(s)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!page ? (
            <p role="status">Loading queue…</p>
          ) : page.total === 0 ? (
            <div className="intake-empty">
              <h3>
                {mode === "approvals"
                  ? "No approval requests"
                  : "No exceptions in this view"}
              </h3>
              <p>
                {mode === "approvals"
                  ? "Requests appear when an authorized case owner proposes an administrative resolution."
                  : "Metadata processing creates real source-review issues here. A queued receipt stays pending until a worker processes it."}
              </p>
            </div>
          ) : mode === "exceptions" ? (
            <div
              className="table-scroll"
              role="region"
              aria-label="Exception queue"
              tabIndex={0}
            >
              <table className="management-table">
                <thead>
                  <tr>
                    <th scope="col">Issue</th>
                    <th scope="col">Owner</th>
                    <th scope="col">State</th>
                    <th scope="col">Opened</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(page.items as CaseRow[]).map((row) => (
                    <tr key={row.id}>
                      <td>{words(row.category)}</td>
                      <td>
                        {row.owner ? (
                          <span className="queue-owner">
                            <IdentityMark value={row.owner} />
                            {row.owner}
                          </span>
                        ) : (
                          "Unassigned queue"
                        )}
                      </td>
                      <td>
                        <State value={row.state} />
                      </td>
                      <td>{new Date(row.created_at).toLocaleString()}</td>
                      <td>
                        <button
                          className="secondary"
                          onClick={() => void open(row.id)}
                        >
                          Review case
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="approval-list">
              {(page.items as Approval[]).map((row) => (
                <section className="approval-item" key={row.id}>
                  <div className="intake-heading">
                    <h3>Administrative resolution</h3>
                    <State value={row.status} />
                  </div>
                  <p>{row.proposal}</p>
                  <p className="muted">
                    Requested by {row.requested_by} · case version{" "}
                    {row.case_version}
                    <br />
                    Expires {new Date(row.expires_at).toLocaleString()}
                  </p>
                  <button
                    className="secondary"
                    onClick={() => void open(row.case_id)}
                  >
                    Review source case
                  </button>
                  {row.can_decide && (
                    <Form
                      label="Record employer decision"
                      onSave={async (d) =>
                        saved(
                          "/approvals/" + row.id + "/decide",
                          d,
                          "Employer decision recorded.",
                        )
                      }
                    >
                      <label>
                        Decision
                        <select name="outcome" required>
                          <option value="needs_information">
                            Needs information
                          </option>
                          <option value="approved">
                            Approve administrative resolution
                          </option>
                          <option value="rejected">Reject</option>
                        </select>
                      </label>
                      <Field
                        multiline
                        name="reason"
                        label="Decision rationale"
                        minLength={10}
                        maxLength={2000}
                      />
                    </Form>
                  )}
                  {row.decision && (
                    <div className="decision-record">
                      <strong>{words(row.decision.outcome)}</strong>
                      <p>{row.decision.reason}</p>
                      <small>
                        {row.decision.actor} ·{" "}
                        {new Date(row.decision.decided_at).toLocaleString()}
                      </small>
                    </div>
                  )}
                  {row.can_withdraw && (
                    <Form
                      label="Withdraw request"
                      onSave={async (d) =>
                        saved(
                          "/approvals/" + row.id + "/withdraw",
                          d,
                          "Approval request withdrawn; case returned for review.",
                        )
                      }
                    >
                      <Field
                        multiline
                        name="reason"
                        label="Withdrawal reason"
                        minLength={10}
                        maxLength={2000}
                      />
                    </Form>
                  )}
                </section>
              ))}
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
        </>
      )}
      {selected && selected.state === "in_review" && (
        <section className="case-approval">
          <h3>Ask the client</h3>
          <p className="muted">
            Draft an in-app information request using the approved client
            process. A current employer administrator must approve the exact
            text and recipient before publishing. Configure the process under
            Client correspondence if none exists.
          </p>
          <Form
            key={"information" + selected.id + selected.version}
            label="Draft client request"
            onSave={async (d) => {
              await saved(
                "/exceptions/" + selected.id + "/information-requests",
                {
                  ...d,
                  version: selected.version,
                  command_id: requestCommand.current,
                },
                "Client request drafted for approval under Client correspondence.",
              );
              requestCommand.current = crypto.randomUUID();
            }}
          >
            <Field
              multiline
              name="body"
              label="Information or correction required from the client"
              minLength={20}
              maxLength={4000}
            />
          </Form>
        </section>
      )}
    </section>
  );
}
