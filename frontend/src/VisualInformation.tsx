import { Icon } from "./UI";
import { SpotIllustration } from "./EmptyState";

/** Identity cues derive from supplied records; never imply an uploaded photo. */
export function IdentityMark({
  value,
  organization = false,
}: {
  value: string;
  organization?: boolean;
}) {
  const initials = value
    .split("@")[0]
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const tone =
    [...value.toLowerCase()].reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0,
    ) % 3;
  return (
    <span
      className={
        "identity-mark identity-tone-" +
        tone +
        (organization ? " organization-mark" : "")
      }
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/** A state symbol, deliberately not a percentage or inferred checklist. */
export function ReadinessSignal({ status }: { status: string }) {
  const active = status === "active";
  const pending = ["draft", "configuring", "ready_for_review"].includes(status);
  const paused = status === "suspended";
  return (
    <div
      className={
        "readiness-signal " +
        (active
          ? "is-active"
          : pending
            ? "is-pending"
            : paused
              ? "is-paused"
              : "is-neutral")
      }
    >
      <span className="readiness-symbol">
        <Icon
          name={
            active ? "check" : pending ? "clock" : paused ? "pause" : "info"
          }
          size={23}
        />
      </span>
      <div>
        <small>Account readiness</small>
        <h3>
          {active
            ? "Account activated"
            : pending
              ? "Pending service activation"
              : status === "suspended"
                ? "Access suspended"
                : status.replaceAll("_", " ")}
        </h3>
        <p>
          {active
            ? "Account administration is available within your permissions."
            : pending
              ? "A service administrator completes configuration and activation."
              : "Account state limits the actions available in this workspace."}
        </p>
      </div>
    </div>
  );
}

const auditLabels: Record<string, string> = {
  "evidence.received": "Evidence received privately",
  verified_evidence: "Evidence review accepted",
  rejected_evidence: "Evidence review rejected",
  needs_more_information: "More information requested",
  escalated: "Review escalated",
  "driver.created": "Driver registered",
  "driver.engagement_created": "Employer engagement created",
  "driver.engagement_changed": "Engagement state changed",
  "driver.engagement_transferred": "Driver location transferred",
  "driver.identity_corrected": "Identity correction recorded",
  "tenant.created": "Company created",
  "tenant.configured": "Responsibilities configured",
  "tenant.configuration_updated": "Configuration updated",
  "tenant.activated": "Company activated",
  "tenant.activate": "Company activated",
  "tenant.review": "Configuration reviewed",
  "tenant.suspend": "Company suspended",
  "operator.assigned": "Specialist assigned",
  "operator.assignment_ended": "Specialist assignment ended",
  "tenant.suspended": "Company suspended",
  "tenant.reviewed": "Configuration reviewed",
  "branch.created": "Location added",
  "user.invited": "User invited",
  "invitation.accepted": "Invitation accepted",
  "invitation.resend": "Invitation resent",
  "invitation.revoke": "Invitation revoked",
  "membership.revoked": "Membership revoked",
};

export function auditActionLabel(action: string) {
  return auditLabels[action] || action.replaceAll(/[._]/g, " ");
}

export function AuditAction({ action }: { action: string }) {
  const people = /^(user|invitation|membership|driver)\./.test(action);
  return (
    <div className="audit-action">
      <span className="audit-action-icon">
        <Icon
          name={
            people
              ? "users"
              : action.startsWith("branch.")
                ? "branch"
                : "companies"
          }
          size={16}
        />
      </span>
      <div>
        <strong>
          {auditActionLabel(action)}
        </strong>
        <code>{action}</code>
      </div>
    </div>
  );
}

export function LocationEmpty({ manage }: { manage: boolean }) {
  return (
    <div className="location-empty compact-empty">
      <SpotIllustration kind="locations" />
      <div>
        <h3>No locations in your scope.</h3>
        <p>
          {manage
            ? "Add a company location using the branch form."
            : "Contact your company administrator if you need location access."}
        </p>
      </div>
    </div>
  );
}
