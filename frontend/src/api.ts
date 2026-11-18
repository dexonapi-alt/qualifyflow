export class ApiError extends Error {
  constructor(
    message: string,
    public fields: Record<string, string> = {},
    public reference = "",
    public status = 400,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, data?: unknown): Promise<T> {
  const csrf =
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("qf_csrf="))
      ?.slice(8) || "";
  const response = await fetch("/api/v1" + path, {
    method: data === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = await response.json();
  if (!response.ok)
    throw new ApiError(
      body.error?.message || "Request failed. Try again.",
      body.error?.fields,
      body.error?.correlation_id,
      response.status,
    );
  return body;
}
export type User = {
  id: string;
  email: string;
  platform_role: string | null;
  driver_portal?: boolean;
  company_access?: boolean;
};
export type Company = {
  id: string;
  display_name: string;
  legal_name: string;
  customer_ref: string;
  mode: string;
  timezone: string;
  region: string;
  primary_contact: string;
  effective_date: string;
  status: string;
  version: number;
  configuration: Record<string, unknown>;
};
export type Branch = {
  id: string;
  name: string;
  reference: string;
  status: string;
  version: number;
};
export type Detail = Company & {
  driver_access?: DriverAccess | null;
  branches: Branch[];
  scope: { role: string; branch_id: string | null };
  missing_prerequisites: string[];
};
export type DriverAccess = {
  role: string;
  branch_id: string | null;
  can_write: boolean;
  can_correct: boolean;
  can_transfer: boolean;
  can_rehire: boolean;
  can_history: boolean;
};
export type Engagement = {
  id: string;
  branch_id: string | null;
  branch_name: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  version: number;
  allowed_transitions: string[];
};
export type Driver = {
  id: string;
  reference: string;
  first_name: string;
  last_name: string;
  version: number;
  created_at: string;
  engagement: Engagement;
};
export type DriverDetail = Omit<Driver, "engagement"> & {
  history_total: number | null;
  engagements: Engagement[];
  access: DriverAccess;
  history:
    | {
        id: string;
        action: string;
        reason: string;
        details: Record<string, unknown>;
        actor_id: string;
        actor_email: string;
        occurred_at: string;
      }[]
    | null;
};
export type Invite = {
  id: string;
  email: string;
  role: string;
  branch_id: string | null;
  status: string;
  version: number;
  expires_at: string;
};
export type Member = {
  id: string;
  email: string;
  role: string;
  status: string;
  branch_id: string | null;
  version: number;
};
export type Assignment = {
  id: string;
  email: string;
  status: string;
  version: number;
};
