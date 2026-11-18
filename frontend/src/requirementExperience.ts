import type { Requirement } from "./qualificationTypes";

export type WorkCue = {
  tone: "pending" | "working" | "complete" | "attention";
  label: string;
  action: string;
  detail: string;
  responsibility: "intake" | "review" | null;
};

/** Guidance follows evidence state, never an inferred legal outcome or assignee. */
export function requirementCue(req: Requirement, canReview: boolean): WorkCue {
  if (req.status === "expired" || req.status === "rejected")
    return {
      tone: "attention",
      label:
        req.status === "expired" ? "Evidence expired" : "Replacement needed",
      action: "Update evidence",
      detail:
        "Add a current evidence version; earlier versions and decisions stay in the record.",
      responsibility: "intake",
    };
  if (req.status === "verified")
    return {
      tone: "complete",
      label: "Evidence reviewed",
      action: "View evidence",
      detail:
        "Current accepted evidence is recorded for this requirement. This is not a legal eligibility decision.",
      responsibility: null,
    };
  const latest = [...req.evidence].sort((a, b) => b.revision - a.revision)[0];
  if (!latest)
    return {
      tone: "pending",
      label: "Evidence needed",
      action: "Add evidence",
      detail:
        "Upload the document against this driver, engagement and requirement.",
      responsibility: "intake",
    };
  if (
    latest.scan_error ||
    ["scan_failed", "infected", "blocked"].includes(latest.status)
  )
    return {
      tone: "attention",
      label: "Scan needs attention",
      action: "Inspect scan",
      detail:
        "The security scan has not cleared this version. Check the scan details before proceeding.",
      responsibility: "intake",
    };
  if (["quarantined", "scanning"].includes(latest.status))
    return {
      tone: "working",
      label:
        latest.status === "scanning"
          ? "Security scan running"
          : "Queued for scanning",
      action: "View scan status",
      detail:
        "Evidence is received privately. Review remains unavailable until the security scan clears.",
      responsibility: null,
    };
  if (["needs_more_information", "reviewed_rejected"].includes(latest.status))
    return {
      tone: "pending",
      label: "More evidence needed",
      action: "View findings",
      detail: "Read the recorded findings and provide the requested evidence.",
      responsibility: "intake",
    };
  if (latest.status === "escalated")
    return {
      tone: "attention",
      label: "Escalated for review",
      action: "View findings",
      detail:
        "An escalation is recorded. Inspect the findings and any linked follow-up case.",
      responsibility: "review",
    };
  return {
    tone: "working",
    label: "Awaiting review",
    action: canReview ? "Review evidence" : "View evidence",
    detail: canReview
      ? "Compare the cleared evidence with this driver and requirement, then record your findings."
      : "An authorized reviewer must record the evidence outcome.",
    responsibility: "review",
  };
}

export function responsibilityLabel(owner: unknown) {
  return owner === "service"
    ? "Service team"
    : owner === "client"
      ? "Company team"
      : "Not configured";
}

export function priorityRequirements(items: Requirement[]) {
  const rank = (r: Requirement) => {
    const cue = requirementCue(r, false);
    return cue.tone === "attention"
      ? 0
      : cue.tone === "pending"
        ? 1
        : cue.tone === "working"
          ? 2
          : 3;
  };
  return [...items].sort((a, b) => rank(a) - rank(b));
}
