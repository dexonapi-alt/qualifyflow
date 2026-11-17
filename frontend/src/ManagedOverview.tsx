import { useEffect, useState } from "react";
import { api, type Driver, type DriverAccess } from "./api";
import { IdentityMark } from "./VisualInformation";
import { Icon } from "./UI";
import { State } from "./Forms";
import { driverNextStep } from "./driverNextStep";

type FileProgress = {
  assigned: number;
  reviewed: number;
  missing: number;
  expired: number;
  awaiting_review: number;
};
export type WorkspaceOverview = {
  persona: "client" | "operations" | "administration";
  mode: string;
  company_status: string;
  access: DriverAccess | null;
  driver_total: number | null;
  drivers: (Driver & { file: FileProgress | null })[];
  summary: {
    open_cases?: number;
    team_handling?: number;
    recorded_reviews?: number;
    needs_you?: number;
  };
  needs_you: {
    id: string;
    title: string;
    context: string;
    kind: string;
    created_at: string;
    view: string;
  }[];
  team: { id: string; email: string; role: string }[];
  work: {
    id: string;
    category: string;
    owner: string | null;
    state: string;
    created_at: string;
    mine: boolean;
  }[];
  activity: {
    id: string;
    actor: string;
    driver_id: string;
    driver_reference: string;
    requirement: string;
    outcome: string;
    occurred_at: string;
  }[];
};
const taskLabel = (value: string) =>
  (
    ({
      blocked_by_policy: "Evidence review",
      unmatched: "Driver verification",
      validation_failed: "Source correction",
      duplicate_detected: "Duplicate investigation",
    }) as Record<string, string>
  )[value.replaceAll(" ", "_")] || value.replaceAll("_", " ");

export function ManagedOverview({
  companyId,
  companyName,
  timezone,
  onNavigate,
  onDriver,
  onAddDriver,
  configuration,
  activationPrerequisites,
}: {
  companyId: string;
  companyName: string;
  timezone: string;
  onNavigate: (view: string) => void;
  onDriver?: (driver: string, source: string) => void;
  onAddDriver?: () => void;
  configuration: Record<string, unknown>;
  activationPrerequisites?: string[];
}) {
  const [data, setData] = useState<WorkspaceOverview | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    api<WorkspaceOverview>("/tenants/" + companyId + "/workspace")
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [companyId, revision]);
  if (error)
    return (
      <div className="overview-error" role="alert">
        <Icon name="info" />
        <div>
          <h2>We couldn't open this overview</h2>
          <p>{error}</p>
          <button
            className="secondary"
            onClick={() => setRevision((v) => v + 1)}
          >
            Try again
          </button>
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="overview-loading" role="status">
        <span className="loading-line" />
        <p>Bringing your workspace together…</p>
      </div>
    );
  if (!data.access)
    return (
      <section className="metadata-overview">
        <p className="overview-date">Company administration</p>
        <h1>{companyName}</h1>
        <State value={data.company_status} />
        <p>
          Your current authority covers company setup. Driver and service-work
          details require an explicit membership or staff assignment.
        </p>
        {activationPrerequisites && activationPrerequisites.length > 0 && (
          <ul className="activation-blockers">
            {activationPrerequisites.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <button onClick={() => onNavigate("summary")}>
          Open company settings
          <Icon name="arrow" size={15} />
        </button>
      </section>
    );
  const operational = data.persona === "operations";
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date());
  return (
    <div className="managed-overview">
      <div className="overview-introduction">
        <div>
          <p className="overview-date">{date}</p>
          <h1>
            {operational
              ? "Your work, in focus."
              : "Your company, at a glance."}
          </h1>
          <p className="overview-description">
            {operational
              ? "The records, reviews and follow-ups moving this client forward."
              : "A clear view of your drivers, your service team and what needs you."}
          </p>
        </div>
        {["draft", "configuring", "ready_for_review"].includes(
          data.company_status,
        ) ? (
          <button
            className="secondary setup-priority"
            onClick={() => onNavigate("summary")}
          >
            <Icon name="clock" size={16} />
            View account setup
          </button>
        ) : (
          data.access?.can_write &&
          onAddDriver &&
          data.driver_total !== 0 && (
            <button
              className="secondary overview-mobile-add"
              onClick={onAddDriver}
            >
              <Icon name="users" size={16} />
              Add driver
            </button>
          )
        )}
      </div>
      {data.driver_total !== null && (
        <div
          className="overview-summary"
          aria-label="Recorded workspace totals"
        >
          <div>
            <Icon name="users" size={16} />
            <strong>{data.driver_total}</strong>
            <span>Drivers</span>
          </div>
          {data.summary.needs_you !== undefined && (
            <div>
              <span className="summary-dot pending" />
              <strong>{data.summary.needs_you}</strong>
              <span>
                {operational ? "Assigned actions" : "Requests & decisions"}
              </span>
            </div>
          )}
          {data.summary.team_handling !== undefined && (
            <div>
              <span className="summary-dot working" />
              <strong>{data.summary.team_handling}</strong>
              <span>With the service team</span>
            </div>
          )}
          {data.summary.recorded_reviews !== undefined && (
            <div>
              <Icon name="check" size={16} />
              <strong>{data.summary.recorded_reviews}</strong>
              <span>Evidence reviews recorded</span>
            </div>
          )}
        </div>
      )}
      <div
        className={
          "overview-primary-layout" +
          ((data.summary.needs_you || 0) > 0 ? " has-attention" : "")
        }
      >
        <section className="workspace-panel driver-overview-panel">
          <header>
            <div className="panel-title">
              <Icon name="users" size={17} />
              <h2>{operational ? "Driver workspace" : "Your drivers"}</h2>
            </div>
            <button
              className="panel-link quiet"
              onClick={() => onNavigate("drivers")}
            >
              View all
              <Icon name="arrow" size={14} />
            </button>
          </header>
          {data.drivers.length ? (
            <div className="overview-table-wrap">
              <table className="overview-driver-table">
                <thead>
                  <tr>
                    <th scope="col">Driver</th>
                    <th scope="col">File review</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.drivers.slice(0, 3).map((driver) => {
                    const next = driverNextStep({
                      ended: !!driver.engagement.end_date,
                      file: driver.file,
                      operational,
                      role: data.access!.role,
                      intakeOwner: configuration.intake_owner,
                      reviewOwner: configuration.review_owner,
                    });
                    return (
                      <tr key={driver.id}>
                        <td>
                          <div className="record-person">
                            <IdentityMark
                              value={driver.first_name + " " + driver.last_name}
                            />
                            <div>
                              <strong>
                                {driver.first_name} {driver.last_name}
                              </strong>
                              <small>{driver.reference}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {driver.file?.assigned ? (
                            <div className="file-progress">
                              <span>
                                {driver.file.reviewed}
                                <span className="progress-separator"> / </span>
                                {driver.file.assigned}
                                <small>requirements reviewed</small>
                              </span>
                              <span
                                className="file-progress-track"
                                role="img"
                                aria-label={`${driver.file.reviewed} of ${driver.file.assigned} assigned requirements have current accepted evidence`}
                              >
                                <i
                                  style={{
                                    width: `${(driver.file.reviewed / driver.file.assigned) * 100}%`,
                                  }}
                                />
                              </span>
                            </div>
                          ) : (
                            <span className="unconfigured-file">
                              {driver.file
                                ? "No requirements assigned"
                                : "Record-only access"}
                            </span>
                          )}
                        </td>
                        <td>
                          <State value={next.state} />
                        </td>
                        <td>
                          <button
                            className="record-open next-step-action"
                            aria-label={`${next.action} for driver ${driver.reference}`}
                            onClick={() => onDriver?.(driver.id, "")}
                          >
                            <span>{next.action}</span>
                            <Icon name="arrow" size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overview-starter">
              <div className="starter-record-mark">
                <Icon name="file" size={25} />
              </div>
              <h3>Make room for your first driver.</h3>
              <p>
                {data.access?.can_write
                  ? "Add a driver with their company reference. Their engagement and document requirements stay together in one file."
                  : "Drivers will appear here when an authorized team member adds them."}
              </p>
              {data.access?.can_write && onAddDriver && (
                <button onClick={onAddDriver}>
                  Add your first driver
                  <Icon name="arrow" size={15} />
                </button>
              )}
            </div>
          )}
        </section>
      </div>
      <div className="overview-supporting-layout">
        <section className="workspace-panel attention-panel">
          <header>
            <div className="panel-title">
              <span className="attention-symbol">
                <Icon name="clock" size={16} />
              </span>
              <h2>
                {operational ? "Your next actions" : "Needs your attention"}
              </h2>
            </div>
            <span className="attention-count">
              {data.summary.needs_you ?? "—"}
            </span>
            {data.access?.can_write && (
              <details className="attention-destinations">
                <summary>View all</summary>
                <div>
                  {operational ? (
                    <button
                      className="quiet"
                      onClick={() => onNavigate("exceptions")}
                    >
                      Assigned cases
                    </button>
                  ) : (
                    <>
                      <button
                        className="quiet"
                        onClick={() => onNavigate("correspondence")}
                      >
                        Requests
                      </button>
                      <button
                        className="quiet"
                        onClick={() => onNavigate("approvals")}
                      >
                        Decisions
                      </button>
                    </>
                  )}
                </div>
              </details>
            )}
          </header>
          {data.needs_you.length ? (
            <ul className="attention-list">
              {data.needs_you.slice(0, 2).map((item) => (
                <li key={item.id}>
                  <div>
                    <span className="attention-kind">
                      {item.kind === "case"
                        ? "Your assignment"
                        : item.kind === "decision"
                          ? "Decision"
                          : item.kind === "message_approval"
                            ? "Request approval"
                            : "Client response"}
                    </span>
                    <h3>{taskLabel(item.title)}</h3>
                    <p>{item.context}</p>
                    <button
                      className="quiet"
                      onClick={() => onNavigate(item.view)}
                    >
                      Open{" "}
                      {item.kind === "case"
                        ? "case"
                        : item.kind === "decision"
                          ? "decision"
                          : "request"}
                      <Icon name="arrow" size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="attention-clear">
              <span className="clear-symbol">
                <Icon name="check" size={20} />
              </span>
              <h3>
                {data.summary.needs_you === undefined
                  ? "Your access, kept clear."
                  : operational
                    ? "No assigned actions waiting."
                    : "No requests waiting on you."}
              </h3>
              <p>
                {data.summary.needs_you === undefined
                  ? "Your role can view the driver records available to this account."
                  : operational
                    ? "Open the client work queue to review unassigned items and their next steps."
                    : "When your service team needs information or a decision, it will appear here."}
              </p>
              {data.access?.can_write && (
                <button
                  className="quiet"
                  onClick={() =>
                    onNavigate(operational ? "exceptions" : "correspondence")
                  }
                >
                  {operational ? "View work queue" : "View requests"}
                  <Icon name="arrow" size={14} />
                </button>
              )}
            </div>
          )}
        </section>
        <section className="workspace-panel service-work-panel">
          <header>
            <div className="panel-title">
              <Icon name="service" size={17} />
              <h2>{operational ? "Client work queue" : "Service activity"}</h2>
            </div>
            {data.access?.can_write && (
              <button
                className="quiet"
                onClick={() => onNavigate("exceptions")}
              >
                View all
                <Icon name="arrow" size={14} />
              </button>
            )}
          </header>
          {data.work.length ? (
            <ul className="service-work-list">
              {data.work.slice(0, 3).map((item) => (
                <li key={item.id} data-work-state={item.state}>
                  <div className="work-item-name">
                    <span className="work-item-dot" />
                    <div>
                      <strong>{taskLabel(item.category)}</strong>
                      <small>
                        {item.owner
                          ? item.mine
                            ? "Assigned to you"
                            : item.owner
                          : "Unassigned queue"}
                      </small>
                    </div>
                  </div>
                  {item.owner && <IdentityMark value={item.owner} />}
                  <State value={item.state} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="quiet-empty">
              <Icon name="service" size={22} />
              <p>
                {data.summary.open_cases === undefined
                  ? "Operational details follow your account permissions."
                  : "No open source-review cases in this view. New work appears as records are received and processed."}
              </p>
            </div>
          )}
        </section>
      </div>
      <details className="overview-context-details">
        <summary>
          <Icon name="users" size={16} />
          Team & recent progress
          <span>View details</span>
        </summary>
        <div className="overview-context-layout">
          <section className="workspace-panel service-team-panel">
            <header>
              <div className="panel-title">
                <Icon name="users" size={17} />
                <h2>Your service team</h2>
              </div>
              <span className="service-mode-label">
                {data.mode === "managed"
                  ? "Managed service"
                  : data.mode === "hybrid"
                    ? "Hybrid service"
                    : "Self-service"}
              </span>
            </header>
            {data.team.length ? (
              <ul>
                {data.team.map((person) => (
                  <li key={person.id}>
                    <IdentityMark value={person.email} />
                    <div>
                      <strong>{person.email}</strong>
                      <small>{person.role.replaceAll("_", " ")}</small>
                    </div>
                    <span className="team-assignment-label">Assigned</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="quiet-empty">
                <div className="empty-team-symbol">
                  <Icon name="users" size={23} />
                </div>
                <p>
                  {data.mode === "self_service"
                    ? "Your company manages this workspace. Service staff appear here when explicitly assigned."
                    : "No service specialist is assigned yet. Your service administrator manages team assignments."}
                </p>
              </div>
            )}
          </section>
          {data.activity.length > 0 && (
            <section className="workspace-panel recent-progress-panel">
              <header>
                <div className="panel-title">
                  <Icon name="clock" size={17} />
                  <h2>Recent progress</h2>
                </div>
                <span className="recent-progress-context">
                  Recorded evidence reviews
                </span>
              </header>
              <ol>
                {data.activity.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <IdentityMark value={item.actor} />
                    <div>
                      <p>
                        <strong>{item.actor}</strong> recorded{" "}
                        {item.outcome === "verified_evidence"
                          ? "accepted evidence"
                          : item.outcome.replaceAll("_", " ")}
                      </p>
                      <small>
                        {item.requirement} · {item.driver_reference}
                      </small>
                    </div>
                    <time dateTime={item.occurred_at}>
                      {new Date(item.occurred_at).toLocaleDateString()}
                    </time>
                    <button
                      className="quiet"
                      onClick={() => onDriver?.(item.driver_id, "")}
                    >
                      View file
                      <Icon name="arrow" size={14} />
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </details>
    </div>
  );
}
