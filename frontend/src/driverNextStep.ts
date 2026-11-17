type FileProgress = {
  assigned: number;
  reviewed: number;
  missing: number;
  expired: number;
  awaiting_review: number;
};
export function driverNextStep({
  ended,
  file,
  operational,
  role,
  intakeOwner,
  reviewOwner,
}: {
  ended: boolean;
  file: FileProgress | null;
  operational: boolean;
  role: string;
  intakeOwner?: unknown;
  reviewOwner?: unknown;
}) {
  if (ended)
    return {
      state: "engagement_ended",
      detail: "This engagement has ended.",
      action: "View record",
    };
  if (!file)
    return {
      state: "record_access",
      detail: "Your role can view this driver record.",
      action: "View record",
    };
  const intake = operational || intakeOwner === "client";
  if (!file.assigned)
    return {
      state: "requirements_needed",
      detail: operational
        ? "Assign the agreed requirements to start this file."
        : intakeOwner === "service"
          ? "Your service team needs to assign requirements."
          : intakeOwner === "client"
            ? "Assign your company’s agreed requirements."
            : "Confirm requirements with your company administrator.",
      action: intake ? "Set up file" : "View file",
    };
  if (file.expired)
    return {
      state: "needs_attention",
      detail: intake
        ? "Add current evidence for expired requirements."
        : intakeOwner === "service"
          ? "Your service team needs current evidence."
          : "Open the file to check expired evidence.",
      action: intake ? "Update evidence" : "View file",
    };
  if (file.awaiting_review)
    return {
      state: "in_review",
      detail:
        operational || (reviewOwner === "client" && role === "client_admin")
          ? "Open the file to check scan and review steps."
          : reviewOwner === "service"
            ? "Evidence is awaiting scan or service review."
            : "Evidence is awaiting scan or an authorized review.",
      action:
        operational || (reviewOwner === "client" && role === "client_admin")
          ? "Review file"
          : "View file",
    };
  if (file.missing)
    return {
      state: "awaiting_documents",
      detail: intake
        ? "Upload evidence for the missing requirements."
        : intakeOwner === "service"
          ? "Your service team needs the missing evidence."
          : "Open the file to check what evidence is missing.",
      action: intake ? "Add evidence" : "View file",
    };
  if (file.reviewed === file.assigned)
    return {
      state: "review_complete",
      detail: "Assigned requirements have current accepted evidence.",
      action: "View file",
    };
  return {
    state: "in_review",
    detail: "Open the file to check the next review step.",
    action: "View file",
  };
}
