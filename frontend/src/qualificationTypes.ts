export type Evidence = {
  id: string;
  revision: number;
  version: number;
  filename: string;
  submitted_via?: "driver" | "staff";
  uploaded_by?: string;
  status: string;
  byte_size: number;
  uploaded_at: string;
  scanned_at?: string | null;
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
export type Requirement = {
  id: string;
  title: string;
  code: string;
  category: string;
  policy_revision: number;
  engagement_id: string;
  engagement_current: boolean;
  requires_expiry: boolean;
  status: string;
  follow_up_id: string | null;
  driver_visible?: boolean;
  driver_request_version?: number;
  driver_instructions?: string;
  evidence: Evidence[];
};
export type Definition = {
  id: string;
  code: string;
  title: string;
  revision: number;
  category: string;
  requires_expiry: boolean;
  basis: string;
};
export type FileData = {
  items: Requirement[];
  definitions: Definition[];
  can_review: boolean;
};
