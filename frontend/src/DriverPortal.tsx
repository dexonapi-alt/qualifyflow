import { useEffect, useRef, useState } from "react";
import { api, type User } from "./api";
import { Brand, Icon } from "./UI";
import { IdentityMark } from "./VisualInformation";

type Submission = {
  id: string;
  filename: string;
  revision: number;
  status: string;
  uploaded_at: string;
  can_download: boolean;
};
type RequestItem = {
  id: string;
  title: string;
  instructions: string;
  status: string;
  submissions: Submission[];
};
type Onboarding = {
  engagement_id: string;
  company: string;
  contact: string;
  name: string;
  reference: string;
  items: RequestItem[];
};
type Access = {
  engagement_id: string;
  company: string;
  name: string;
  reference: string;
};

export function driverRequestState(item: RequestItem) {
  if (item.status === "verified")
    return { label: "Evidence accepted", tone: "complete" };
  if (["expired", "rejected"].includes(item.status))
    return { label: "Updated document needed", tone: "pending" };
  const latest = item.submissions[0];
  if (!latest)
    return {
      label:
        item.status === "needs_review"
          ? "With the review team"
          : "Ready to upload",
      tone: item.status === "needs_review" ? "working" : "pending",
    };
  if (latest.status === "scan_failed")
    return { label: "Security check needs attention", tone: "attention" };
  if (["quarantined", "scanning"].includes(latest.status))
    return { label: "Security check", tone: "working" };
  if (["needs_more_information", "reviewed_rejected"].includes(latest.status))
    return { label: "Changes requested", tone: "pending" };
  if (latest.status === "escalated")
    return { label: "With the review team", tone: "working" };
  return { label: "Waiting for review", tone: "working" };
}

function DocumentRequest({
  item,
  base,
  onSaved,
}: {
  item: RequestItem;
  base: string;
  onSaved: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null),
    command = useRef(crypto.randomUUID());
  const state = driverRequestState(item);
  async function submit() {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 32768)
        binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      await api(base + "/requirements/" + item.id + "/submissions", {
        command_id: command.current,
        filename: file.name,
        content_base64: btoa(binary),
      });
      await onSaved();
      setFile(null);
      if (input.current) input.current.value = "";
      command.current = crypto.randomUUID();
      setNotice(
        "Document received privately. Your team can review it after the security check.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={"personal-request tone-" + state.tone}
      aria-labelledby={"personal-request-" + item.id}
    >
      <header>
        <span className="personal-request-icon" aria-hidden="true">
          <Icon name={state.tone === "complete" ? "check" : "file"} size={20} />
        </span>
        <div>
          <h3 id={"personal-request-" + item.id}>{item.title}</h3>
          <span className={"personal-status " + state.tone}>{state.label}</span>
        </div>
      </header>
      <p className="personal-instructions">{item.instructions}</p>
      {state.tone === "attention" && (
        <p className="personal-help">
          Your team needs to check the scan before this document can be
          reviewed. Contact your company if you need help.
        </p>
      )}
      {state.label === "Changes requested" && (
        <p className="personal-help">
          Your team needs more information or a replacement. Check the
          instructions above, or contact your company before uploading again.
        </p>
      )}
      <details
        className="personal-upload"
        open={item.submissions.length === 0 && item.status !== "verified"}
      >
        <summary>
          {item.submissions.length || item.status === "verified"
            ? "Upload another version"
            : "Upload your document"}
        </summary>
        <label htmlFor={"personal-file-" + item.id}>
          Choose a document <small>PDF, PNG or JPEG · up to 2 MiB</small>
        </label>
        <input
          ref={input}
          id={"personal-file-" + item.id}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          disabled={busy}
          onChange={(e) => {
            const next = e.target.files?.[0] || null;
            setError("");
            setNotice("");
            if (next && next.size > 2 * 1024 * 1024) {
              setError("Choose a document up to 2 MiB.");
              setFile(null);
              return;
            }
            setFile(next);
            command.current = crypto.randomUUID();
          }}
        />
        {file && (
          <button onClick={() => void submit()} disabled={busy}>
            {busy ? "Sending document…" : "Submit document"}
            <Icon name="arrow" size={15} />
          </button>
        )}
      </details>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="personal-confirmation" role="status">
          <Icon name="check" size={16} />
          {notice}
        </p>
      )}
      {!!item.submissions.length && (
        <details className="personal-submissions">
          <summary>Your submissions ({item.submissions.length})</summary>
          <ul>
            {item.submissions.map((s) => (
              <li key={s.id}>
                <Icon name="file" size={16} />
                <div>
                  <strong>{s.filename}</strong>
                  <small>
                    Version {s.revision} ·{" "}
                    <time dateTime={s.uploaded_at}>
                      {new Date(s.uploaded_at).toLocaleString()}
                    </time>
                  </small>
                  <span>{s.status.replaceAll("_", " ")}</span>
                </div>
                {s.can_download && (
                  <a
                    href={
                      "/api/v1" +
                      base +
                      "/requirements/" +
                      item.id +
                      "/submissions/" +
                      s.id +
                      "/download"
                    }
                  >
                    Download<span className="sr-only"> {s.filename}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function DriverPortal({
  user,
  onLogout,
  onWorkspace,
}: {
  user: User;
  onLogout: () => void;
  onWorkspace?: () => void;
}) {
  const [access, setAccess] = useState<Access[] | null>(null),
    [selected, setSelected] = useState(""),
    [data, setData] = useState<Onboarding | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [pollError, setPollError] = useState("");
  const account = useRef(user.id);
  account.current = user.id;
  useEffect(() => {
    let active = true;
    setAccess(null);
    setData(null);
    setError("");
    api<{ items: Access[] }>("/driver-portal")
      .then((r) => {
        if (active) {
          setAccess(r.items);
          setSelected((s) =>
            r.items.some((a) => a.engagement_id === s)
              ? s
              : r.items[0]?.engagement_id || "",
          );
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [user.id, refresh]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    setPollError("");
    if (selected)
      api<Onboarding>("/driver-portal/" + selected)
        .then((r) => {
          if (active) setData(r);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [selected, refresh]);
  const loadVersion = useRef(0);
  async function reload() {
    const actor = account.current,
      eid = selected,
      version = ++loadVersion.current;
    const r = await api<Onboarding>("/driver-portal/" + eid);
    if (account.current === actor && version === loadVersion.current) {
      setData(r);
      setPollError("");
    }
  }
  const scanning = !!data?.items.some((i) =>
    i.submissions.some((s) => ["quarantined", "scanning"].includes(s.status)),
  );
  useEffect(() => {
    if (!scanning) return;
    let active = true,
      busy = false;
    const timer = setInterval(() => {
      if (document.hidden || busy) return;
      busy = true;
      void reload()
        .catch((e) => {
          if (active) {
            if ([401, 403, 404, 409].includes(e.status)) {
              setData(null);
              setError(e.message);
            } else
              setPollError(
                "Your last recorded status is shown. Refresh to check for updates.",
              );
          }
        })
        .finally(() => {
          busy = false;
        });
    }, 4000);
    return () => {
      active = false;
      clearInterval(timer);
      loadVersion.current++;
    };
  }, [selected, scanning]);
  useEffect(
    () => () => {
      loadVersion.current++;
    },
    [selected, user.id],
  );
  const accepted =
    data?.items.filter((i) => i.status === "verified").length || 0;
  return (
    <div className="personal-app">
      <a className="skip" href="#personal-main">
        Skip to onboarding
      </a>
      <header className="personal-header">
        <Brand wordmark />
        <div className="personal-account">
          <IdentityMark value={user.email} />
          <span>{user.email}</span>
          {onWorkspace && (
            <button className="quiet" onClick={onWorkspace}>
              Company workspace
            </button>
          )}
          <button className="secondary" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>
      <main id="personal-main" className="personal-main">
        <div className="personal-heading">
          <span className="personal-eyebrow">Your driver workspace</span>
          <h1>My onboarding</h1>
          <p>
            Your documents, your next steps. Your company and service team
            handle the review.
          </p>
        </div>
        {access && access.length > 1 && (
          <label className="personal-company-select">
            Onboarding with
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {access.map((a) => (
                <option key={a.engagement_id} value={a.engagement_id}>
                  {a.company} · {a.reference}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && (
          <div className="personal-empty">
            <p role="alert" className="error">
              {error}
            </p>
            <button onClick={() => setRefresh((n) => n + 1)}>Try again</button>
          </div>
        )}
        {!error && (!access || (selected && !data)) && (
          <p role="status">Loading your onboarding…</p>
        )}
        {!error && access?.length === 0 && (
          <section className="personal-empty">
            <Icon name="access" size={28} />
            <h2>No active onboarding access</h2>
            <p>
              Your company can invite you to a current driver engagement. If
              access recently ended or changed, contact your company.
            </p>
            <button
              className="secondary"
              onClick={() => setRefresh((n) => n + 1)}
            >
              Check access again
            </button>
          </section>
        )}
        {data && !error && (
          <>
            <section className="personal-welcome">
              <IdentityMark value={data.name} />
              <div>
                <h2>{data.name}</h2>
                <p>
                  {data.company} <span>· {data.reference}</span>
                </p>
              </div>
              <button
                className="quiet"
                onClick={() => setRefresh((n) => n + 1)}
              >
                <Icon name="clock" size={15} />
                Refresh
              </button>
            </section>
            {data.items.length ? (
              <section
                className="personal-progress"
                aria-label="Requested document progress"
              >
                <div>
                  <strong>
                    {accepted} of {data.items.length}
                  </strong>
                  <span>requested requirements have accepted evidence</span>
                </div>
                <progress
                  value={accepted}
                  max={data.items.length}
                  aria-label="Requested requirements with accepted evidence"
                />
                <p>
                  {accepted === data.items.length
                    ? "Your shared requirements have accepted evidence. Your company handles any remaining onboarding decisions."
                    : "Submitting a document sends it for processing; it does not mark it accepted."}
                </p>
              </section>
            ) : (
              <section className="personal-empty">
                <Icon name="file" size={28} />
                <h2>You're connected</h2>
                <p>
                  Your team hasn't shared any document requests yet. Check back
                  when they ask you to submit something.
                </p>
              </section>
            )}
            {pollError && (
              <p role="status" className="personal-help">
                {pollError}
              </p>
            )}
            <div className="personal-document-list">
              {data.items.map((item) => (
                <DocumentRequest
                  key={selected + item.id}
                  item={item}
                  base={"/driver-portal/" + selected}
                  onSaved={reload}
                />
              ))}
            </div>
            <footer className="personal-support">
              <Icon name="message" size={18} />
              <div>
                <strong>Need help with a request?</strong>
                <p>
                  Contact your company: <span>{data.contact}</span>
                </p>
              </div>
            </footer>
          </>
        )}
      </main>
      <footer className="personal-environment">
        Local workspace · Synthetic training records only
      </footer>
    </div>
  );
}
