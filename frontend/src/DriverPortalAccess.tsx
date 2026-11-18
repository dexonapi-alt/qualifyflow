import { useEffect, useState } from "react";
import { api, type DriverDetail } from "./api";
import { Form, Field, State } from "./Forms";
import { Icon } from "./UI";

type Grant = {
  id: string;
  email: string;
  status: string;
  invitation_status: string;
  expires_at: string;
  version: number;
  engagement_id: string;
};
export function DriverPortalAccess({
  record,
  path,
}: {
  record: DriverDetail;
  path: string;
}) {
  const [items, setItems] = useState<Grant[] | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const current = record.engagements.find((e) => !e.end_date);
  const canManage =
    record.access.role === "client_admin" &&
    !record.access.branch_id &&
    record.access.can_write;
  async function load() {
    const r = await api<{ items: Grant[] }>(path + "/portal-access");
    setItems(r.items);
  }
  useEffect(() => {
    let active = true;
    api<{ items: Grant[] }>(path + "/portal-access")
      .then((r) => {
        if (active) setItems(r.items);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path]);
  const relevant = items?.filter((g) => g.engagement_id === current?.id) || [];
  const live = relevant.find(
    (g) =>
      g.status === "active" ||
      (g.status === "invited" && new Date(g.expires_at) > new Date()),
  );
  return (
    <section className="driver-portal-access">
      <header>
        <Icon name="access" size={18} />
        <h3>Driver self-service</h3>
        {live && (
          <State value={live.status === "active" ? "active" : "pending"} />
        )}
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
          <button
            className="quiet"
            onClick={() => {
              setError("");
              void load().catch((e) => setError(e.message));
            }}
          >
            Retry driver access
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="action-confirmation">
          {notice}
        </p>
      )}
      {!items && !error && <p role="status">Loading driver access…</p>}
      {items && (
        <>
          {live ? (
            <>
              <p>
                <strong>{live.email}</strong>
              </p>
              <p>
                {live.status === "active"
                  ? "The driver can use My onboarding for explicitly shared document requests."
                  : `Invitation ${live.invitation_status.replaceAll("_", " ")}. Expires ${new Date(live.expires_at).toLocaleString()}.`}
              </p>
              {canManage && (
                <details>
                  <summary>Revoke personal access</summary>
                  <Form
                    label="Revoke driver access"
                    onSave={async (d) => {
                      setNotice("");
                      await api(
                        path + "/portal-access/" + live.id + "/revoke",
                        { version: live.version, reason: d.reason },
                      );
                      await load();
                      setNotice(
                        "Driver access revoked. Company records are retained.",
                      );
                    }}
                  >
                    <Field
                      name="reason"
                      label="Reason for revocation"
                      minLength={5}
                    />
                  </Form>
                </details>
              )}
            </>
          ) : (
            <>
              <p>
                {current
                  ? "Invite the driver to submit their own documents. Their workspace does not expose company records or internal reviews."
                  : "Personal access requires a current engagement."}
              </p>
              {canManage && current && (
                <details>
                  <summary>Invite this driver</summary>
                  <Form
                    label="Send driver invitation"
                    onSave={async (d) => {
                      setNotice("");
                      await api(path + "/portal-access", {
                        email: d.email,
                        engagement_id: current.id,
                      });
                      await load();
                      setNotice(
                        "Driver invitation queued for local delivery. No company membership was granted.",
                      );
                    }}
                  >
                    <Field
                      name="email"
                      label="Driver email address"
                      type="email"
                      help="Confirm this belongs to the driver. Access is bound to this engagement, never matched by name."
                    />
                  </Form>
                </details>
              )}
              {!canManage && current && (
                <p className="muted">
                  A company-wide administrator can invite the driver.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
