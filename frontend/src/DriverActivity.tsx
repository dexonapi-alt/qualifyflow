import { useState } from "react";
import type { DriverDetail } from "./api";
import type { Requirement } from "./qualificationTypes";
import { DetailPanel } from "./DetailPanel";
import {
  AuditAction,
  IdentityMark,
  auditActionLabel,
} from "./VisualInformation";
import { Icon } from "./UI";

export function DriverActivity({
  record,
  requirements,
  onRequirement,
  onHistory,
}: {
  record: DriverDetail;
  requirements: Requirement[];
  onRequirement: (id: string) => void;
  onHistory: () => void;
}) {
  const [selected, setSelected] = useState<string>();
  const events = [
    ...(record.access.can_history ? record.history || [] : []).map((e) => ({
      id: "record-" + e.id,
      action: e.action,
      actor: e.actor_email,
      at: e.occurred_at,
      detail: e.reason,
      target: record.reference,
      requirement: undefined as string | undefined,
      facts: JSON.stringify(e.details, null, 2),
    })),
    ...requirements.flatMap((r) =>
      r.evidence.flatMap((e) => [
        {
          id: "upload-" + e.id,
          action: "evidence.received",
          actor: null,
          at: e.uploaded_at,
          detail: "Received privately. Receipt does not mean acceptance.",
          target: e.filename,
          requirement: r.id,
          facts: `${r.code} · Evidence version ${e.revision}`,
        },
        ...(e.review
          ? [
              {
                id: "review-" + e.id,
                action: e.review.outcome,
                actor: e.review.reviewer,
                at: e.review.reviewed_at,
                detail: e.review.reason,
                target: e.filename,
                requirement: r.id,
                facts: `${r.code} · Evidence version ${e.revision}`,
              },
            ]
          : []),
      ]),
    ),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const event = events.find((e) => e.id === selected);
  return (
    <section className="driver-profile-activity driver-work-activity">
      <header>
        <div>
          <h3>Activity & handoffs</h3>
          <p>Recorded changes, uploads and review outcomes</p>
        </div>
        {record.access.can_history && (
          <button className="quiet" onClick={onHistory}>
            View history <Icon name="arrow" size={14} />
          </button>
        )}
      </header>
      {events.length ? (
        <ol>
          {events.slice(0, 4).map((e) => (
            <li key={e.id}>
              {e.actor ? (
                <IdentityMark value={e.actor} />
              ) : (
                <span className="activity-document" aria-hidden="true">
                  <Icon name="file" size={16} />
                </span>
              )}
              <button
                className="quiet activity-event"
                onClick={() => setSelected(e.id)}
              >
                <strong className="activity-title">
                  {auditActionLabel(e.action)}
                </strong>
                <span>{e.actor || e.target}</span>
                <time dateTime={e.at}>{new Date(e.at).toLocaleString()}</time>
              </button>
              <Icon name="arrow" size={14} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="profile-activity-empty">
          No activity is available in this view. Recorded changes appear here as
          work happens.
        </p>
      )}
      {event && (
        <DetailPanel
          title="Recorded activity"
          context={`${record.first_name} ${record.last_name} · ${record.reference}`}
          onClose={() => setSelected(undefined)}
        >
          <AuditAction action={event.action} />
          {event.actor && (
            <div className="activity-person">
              <IdentityMark value={event.actor} />
              <strong>{event.actor}</strong>
            </div>
          )}
          <dl className="activity-facts">
            <div>
              <dt>Recorded at</dt>
              <dd>
                <time dateTime={event.at}>
                  {new Date(event.at).toLocaleString()}
                </time>
              </dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>{event.target}</dd>
            </div>
          </dl>
          <h3>Recorded context</h3>
          <p className="activity-reason">{event.detail}</p>
          <details>
            <summary>Record details</summary>
            <pre className="activity-raw">{event.facts}</pre>
          </details>
          {event.requirement && (
            <button
              className="activity-open"
              onClick={() => {
                setSelected(undefined);
                onRequirement(event.requirement!);
              }}
            >
              Open requirement <Icon name="arrow" size={14} />
            </button>
          )}
        </DetailPanel>
      )}
    </section>
  );
}
