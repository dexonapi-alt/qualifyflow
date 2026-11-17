import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Form, Field, State } from "./Forms";

type Policy = {
  policy: {
    id: string;
    revision: number;
    recipient: string;
    instructions: string;
  } | null;
  can_configure: boolean;
  recipients: { id: string; email: string }[];
};
type Message = {
  id: string;
  case_id: string;
  version: number;
  body: string;
  status: string;
  author: string;
  recipient: string;
  created_at: string;
  opened_at: string | null;
  responded_at: string | null;
  error_code: string | null;
  can_approve: boolean;
  needs_fresh_request: boolean;
  can_reply: boolean;
  events: {
    id: string;
    action: string;
    body: string;
    actor: string;
    occurred_at: string;
  }[];
};
const words = (value: string) => value.replaceAll("_", " ");

export function Correspondence({ companyId }: { companyId: string }) {
  const base = "/tenants/" + companyId + "/correspondence";
  const [policy, setPolicy] = useState<Policy | null>(null),
    [page, setPage] = useState<{ total: number; items: Message[] } | null>(
      null,
    );
  const [section, setSection] = useState("requests"),
    [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0),
    [error, setError] = useState("");
  const commands = useRef(new Map<string, string>());
  useEffect(() => {
    let active = true;
    setError("");
    Promise.all([
      api<Policy>(base + "/policy"),
      api<{ total: number; items: Message[] }>(base + "?offset=" + offset),
    ])
      .then(([process, messages]) => {
        if (active) {
          setPolicy(process);
          setPage(messages);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [base, offset, revision]);
  async function save(path: string, data: unknown, confirmation: string) {
    await api(path, data);
    setRevision((v) => v + 1);
    return confirmation;
  }
  return (
    <section className="correspondence-workspace">
      <div className="intake-heading">
        <div>
          <h2>Requests & responses</h2>
          <p className="muted">
            Approved in-app requests, recipient responses and a preserved
            communication history.
          </p>
        </div>
        <button className="secondary" onClick={() => setRevision((v) => v + 1)}>
          Refresh requests
        </button>
      </div>
      <nav className="driver-sections" aria-label="Correspondence sections">
        <button
          className="quiet"
          aria-current={section === "requests" ? "page" : undefined}
          onClick={() => setSection("requests")}
        >
          Requests & responses
        </button>
        <button
          className="quiet"
          aria-current={section === "process" ? "page" : undefined}
          onClick={() => setSection("process")}
        >
          Client process
        </button>
      </nav>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {section === "process" ? (
        <>
          {policy?.policy ? (
            <section className="client-process">
              <h3>
                Approved client process · revision {policy.policy.revision}
              </h3>
              <dl>
                <dt>Channel</dt>
                <dd>Authenticated in-app request</dd>
                <dt>Recipient</dt>
                <dd>{policy.policy.recipient}</dd>
                <dt>Content approval</dt>
                <dd>
                  Employer administrator approves the exact request before
                  publishing
                </dd>
              </dl>
              <p className="message-body">{policy.policy.instructions}</p>
            </section>
          ) : (
            <div className="intake-empty">
              <h3>No client process approved</h3>
              <p>
                A current employer administrator must approve a recipient and
                instructions before specialists can request information. There
                is no fallback recipient.
              </p>
            </div>
          )}
          {policy?.can_configure && (
            <>
              <details className="requirement-configure">
                <summary>Approve a client process revision</summary>
                <Form
                  key={policy.policy?.id || "new"}
                  label="Approve client process"
                  onSave={async (d) =>
                    save(
                      base + "/policy",
                      { ...d, expected_policy_id: policy.policy?.id || null },
                      "Client process revision approved. Existing queued requests keep their original recipient and require revalidation.",
                    )
                  }
                >
                  <label>
                    Approved employer recipient
                    <select name="recipient_id" required>
                      {policy.recipients.map((recipient) => (
                        <option key={recipient.id} value={recipient.id}>
                          {recipient.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    multiline
                    name="instructions"
                    label="Client-approved instructions included with each request"
                    minLength={20}
                    maxLength={2000}
                    help="Describe what the client should provide, how to respond, and any agreed escalation process. No invented deadline or real driver PII."
                  />
                </Form>
              </details>
              {policy.policy && (
                <details className="requirement-configure">
                  <summary>Pause this client process</summary>
                  <Form
                    label="Revoke current process"
                    onSave={async (d) =>
                      save(
                        base + "/policy/" + policy.policy!.id + "/revoke",
                        { ...d, version: policy.policy!.revision },
                        "Client process revoked. Unpublished requests will be blocked at publishing.",
                      )
                    }
                  >
                    <Field
                      multiline
                      name="reason"
                      label="Reason for revocation"
                      minLength={10}
                      maxLength={2000}
                    />
                  </Form>
                </details>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {!page && !error && <p role="status">Loading correspondence…</p>}
          {page?.total === 0 && (
            <div className="intake-empty">
              <h3>No client requests yet</h3>
              <p>
                Open an in-review exception and choose Ask the client. The
                request will follow the approved client process and appear here
                for approval and responses.
              </p>
            </div>
          )}
          <div className="message-list">
            {page?.items.map((message) => {
              if (!commands.current.has(message.id))
                commands.current.set(message.id, crypto.randomUUID());
              return (
                <article className="message-record" key={message.id}>
                  <div className="intake-heading">
                    <h3>Client information request</h3>
                    <State
                      value={
                        message.status === "sent"
                          ? "available_in_portal"
                          : message.status === "delivered"
                            ? "opened_in_portal"
                            : message.status
                      }
                    />
                  </div>
                  <p className="muted">
                    From {message.author} · to {message.recipient}
                    <br />
                    Created {new Date(
                      message.created_at,
                    ).toLocaleString()} ·{" "}
                    {message.opened_at
                      ? "Opened in portal " +
                        new Date(message.opened_at).toLocaleString()
                      : "No recipient opening recorded"}
                    {message.responded_at && " · Response recorded"}
                  </p>
                  <p className="message-body">{message.body}</p>
                  {message.error_code && (
                    <p className="file-scan-warning">
                      {words(message.error_code).toLowerCase()}. No fallback
                      recipient or external send was used.
                    </p>
                  )}
                  {message.needs_fresh_request && (
                    <p className="file-scan-warning">
                      The case or approved client process changed. Withdraw this
                      unpublished request and draft a fresh request from the
                      current case.
                    </p>
                  )}
                  {message.can_approve && (
                    <Form
                      key={message.id + message.version}
                      label="Approve client request"
                      onSave={async (d) =>
                        save(
                          base + "/" + message.id + "/approve",
                          { ...d, version: message.version },
                          "Request approved and queued for the client's portal.",
                        )
                      }
                    >
                      <Field
                        multiline
                        name="reason"
                        label="Content and recipient approval rationale"
                        minLength={10}
                        maxLength={2000}
                      />
                    </Form>
                  )}
                  {["pending_approval", "queued"].includes(message.status) && (
                    <details className="requirement-configure">
                      <summary>Withdraw unpublished request</summary>
                      <Form
                        label="Withdraw request"
                        onSave={async (d) =>
                          save(
                            base + "/" + message.id + "/withdraw",
                            { ...d, version: message.version },
                            "Unpublished request withdrawn.",
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
                    </details>
                  )}
                  {message.can_reply && (
                    <>
                      {!message.opened_at && (
                        <button
                          className="secondary"
                          onClick={() => {
                            void save(
                              base + "/" + message.id + "/open",
                              {},
                              "",
                            ).catch((e) => setError(e.message));
                          }}
                        >
                          Mark as read
                        </button>
                      )}
                      <Form
                        label="Send in-app response"
                        onSave={async (d) => {
                          const result = await save(
                            base + "/" + message.id + "/reply",
                            {
                              ...d,
                              command_id: commands.current.get(message.id),
                            },
                            "Response recorded. An awaiting-client case returns to review; no evidence was accepted automatically.",
                          );
                          commands.current.set(message.id, crypto.randomUUID());
                          return result;
                        }}
                      >
                        <Field
                          multiline
                          name="body"
                          label="Response to the specialist"
                          minLength={10}
                          maxLength={4000}
                          help="Reply with the required clarification. Upload evidence through the driver's qualification file, not in message text."
                        />
                      </Form>
                    </>
                  )}
                  <details className="message-history">
                    <summary>Communication history</summary>
                    <ol>
                      {message.events.map((event) => (
                        <li key={event.id}>
                          <strong>
                            {words(event.action.replace("message.", ""))}
                          </strong>
                          <p className="message-body">{event.body}</p>
                          <small>
                            {event.actor} ·{" "}
                            {new Date(event.occurred_at).toLocaleString()}
                          </small>
                        </li>
                      ))}
                    </ol>
                  </details>
                </article>
              );
            })}
          </div>
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
    </section>
  );
}
