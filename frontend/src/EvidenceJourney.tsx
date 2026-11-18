import type { Evidence } from "./qualificationTypes";
import { Icon } from "./UI";

/** Milestones require recorded timestamps; the connector is not a compliance score. */
export function EvidenceJourney({ evidence }: { evidence: Evidence }) {
  const stages = [
    {
      label: "Received privately",
      at: evidence.uploaded_at,
      detail: "Upload recorded",
    },
    {
      label: evidence.scan_error ? "Scan needs attention" : "Security scan",
      warning: !!evidence.scan_error,
      at: evidence.scanned_at,
      detail: evidence.scan_error
        ? "Review remains blocked"
        : evidence.scanned_at
          ? "Scan recorded"
          : "Awaiting scan result",
    },
    {
      label: "Review outcome",
      at: evidence.review?.reviewed_at,
      detail: evidence.review
        ? evidence.review.outcome.replaceAll("_", " ")
        : "No outcome recorded",
    },
  ];
  return (
    <ol className="evidence-journey" aria-label="Evidence processing history">
      {stages.map((stage) => (
        <li
          key={stage.label}
          className={
            stage.warning
              ? "is-blocked"
              : stage.at
                ? "is-recorded"
                : "is-waiting"
          }
        >
          <span className="evidence-stage-symbol" aria-hidden="true">
            <Icon
              name={stage.warning ? "info" : stage.at ? "check" : "clock"}
              size={13}
            />
          </span>
          <div>
            <strong>{stage.label}</strong>
            <small>{stage.detail}</small>
            {stage.at && (
              <time dateTime={stage.at}>
                {new Date(stage.at).toLocaleString()}
              </time>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
