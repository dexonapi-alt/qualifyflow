import { useEffect, useState } from "react";
import { api, ApiError, type DriverDetail } from "./api";
import { Icon } from "./UI";
import { State } from "./Forms";
import { DriverIdentityFocus } from "./DriverIdentityFocus";
import { IdentityMark } from "./VisualInformation";

import type { FileData } from "./qualificationTypes";
import {
  requirementCue,
  responsibilityLabel,
  priorityRequirements,
} from "./requirementExperience";
import { QualificationFile } from "./QualificationFile";
import { DetailPanel } from "./DetailPanel";
import { DriverPortalAccess } from "./DriverPortalAccess";
import { DriverActivity } from "./DriverActivity";

export function DriverProfile({
  record,
  companyName,
  configuration = {},
  path,
  onFile,
  onManage,
  onHistory,
  onRefresh,
}: {
  record: DriverDetail;
  companyName: string;
  configuration?: Record<string, unknown>;
  path: string;
  onFile: (requirement?: string) => void;
  onManage: () => void;
  onHistory: () => void;
  onRefresh: () => void;
}) {
  const current = record.engagements.find((e) => !e.end_date);
  const [selectedRequirement, setSelectedRequirement] = useState<string>();
  const [file, setFile] = useState<FileData | null>(null);
  const [syncNote, setSyncNote] = useState("");
  const [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setFile(null);
    setError("");
    setSyncNote("");
    if (record.access.can_write)
      api<FileData>(path + "/file")
        .then((data) => {
          if (active) setFile(data);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [path, record.access.can_write, refresh]);
  const scanning = !!file?.items.some((r) =>
    r.evidence.some((e) => ["quarantined", "scanning"].includes(e.status)),
  );
  useEffect(() => {
    if (!scanning || selectedRequirement || !record.access.can_write) return;
    let active = true,
      pendingRead = false;
    const timer = setInterval(() => {
      if (document.hidden || pendingRead) return;
      pendingRead = true;
      void api<FileData>(path + "/file")
        .then((data) => {
          if (active) {
            setFile(data);
            setSyncNote("");
          }
        })
        .catch((e) => {
          if (!active) return;
          if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
            setFile(null);
            setError(e.message);
          } else
            setSyncNote(
              "Could not refresh scan status. The last recorded state is shown; use Refresh to retry.",
            );
        })
        .finally(() => {
          pendingRead = false;
        });
    }, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [scanning, selectedRequirement, path, record.access.can_write, refresh]);
  const requirements =
    file?.items.filter((r) => r.engagement_id === current?.id) || [];
  const reviewed = requirements.filter((r) => r.status === "verified").length;
  const needed = requirements.filter((r) =>
    ["pending", "attention"].includes(
      requirementCue(r, !!file?.can_review).tone,
    ),
  ).length;
  const pending = requirements.length - reviewed - needed;
  const tasks = priorityRequirements(requirements);
  const next = tasks.find((r) => r.status !== "verified");
  const nextCue = next ? requirementCue(next, !!file?.can_review) : null;
  const selected = file?.items.find((r) => r.id === selectedRequirement);
  return (
    <div className="driver-profile-layout">
      <DriverIdentityFocus name={record.first_name + " " + record.last_name}>
        {(expand, expanded) => (
          <>
            <div className="driver-person-cover">
              <span>Driver profile</span>
              {!expanded && (
                <button
                  className="quiet profile-expand-button"
                  aria-label="Expand driver profile"
                  onClick={expand}
                >
                  <Icon name="users" size={18} />
                  <span>Expand</span>
                </button>
              )}
            </div>
            <div className="driver-person-body">
              <div className="driver-portrait">
                <IdentityMark
                  value={record.first_name + " " + record.last_name}
                />
              </div>
              <h2>
                {record.first_name} {record.last_name}
              </h2>
              <p className="driver-person-reference">{record.reference}</p>
              <p className="driver-person-company">{companyName}</p>
              {current && (
                <div className="driver-person-state">
                  <State value={current.status} />
                  <span>Employer engagement</span>
                </div>
              )}
              <dl className="driver-person-facts">
                <div>
                  <dt>
                    <Icon name="location" size={16} /> Location
                  </dt>
                  <dd>
                    {current
                      ? current.branch_name || "Whole company"
                      : "No current engagement in this scope"}
                  </dd>
                </div>
                {current && (
                  <div>
                    <dt>
                      <Icon name="clock" size={16} /> Started
                    </dt>
                    <dd>
                      <time dateTime={current.start_date}>
                        {new Intl.DateTimeFormat(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        }).format(new Date(current.start_date + "T00:00:00Z"))}
                      </time>
                    </dd>
                  </div>
                )}
              </dl>
              {record.access.can_write && (
                <button
                  className="profile-file-button"
                  onClick={() => onFile()}
                >
                  <Icon name="file" size={16} /> Open qualification file{" "}
                  <Icon name="arrow" size={15} />
                </button>
              )}
              {record.access.can_write && (
                <button className="quiet profile-manage" onClick={onManage}>
                  Manage engagement
                </button>
              )}
              <p className="driver-person-privacy">
                <Icon name="shield" size={14} /> Private company record
              </p>
            </div>
          </>
        )}
      </DriverIdentityFocus>
      <div className="driver-profile-work">
        <section
          className="driver-onboarding-panel"
          aria-labelledby="driver-onboarding-title"
        >
          <header>
            <div>
              <span className="profile-section-context">
                The next steps, in one place
              </span>
              <h3 id="driver-onboarding-title">
                {current ? "Onboarding & evidence" : "Engagement overview"}
              </h3>
            </div>
            <button
              className="quiet profile-refresh"
              aria-label="Refresh driver profile"
              onClick={() => {
                setRefresh((v) => v + 1);
                onRefresh();
              }}
            >
              <Icon name="clock" size={16} /> Refresh
            </button>
          </header>
          {syncNote && (
            <p className="profile-loading" role="status">
              {syncNote}
            </p>
          )}
          {!record.access.can_write ? (
            <div className="profile-empty">
              <Icon name="access" size={22} />
              <h4>Evidence details are restricted</h4>
              <p>
                Your current role can view this profile. Evidence and review
                actions require additional authorization.
              </p>
            </div>
          ) : error ? (
            <div className="profile-empty">
              <p role="alert" className="error">
                {error}
              </p>
              <button
                className="secondary"
                onClick={() => setRefresh((v) => v + 1)}
              >
                Retry evidence summary
              </button>
            </div>
          ) : !file ? (
            <p className="profile-loading" role="status">
              Loading this driver's requirements…
            </p>
          ) : !current ? (
            <div className="profile-empty">
              <Icon name="clock" size={24} />
              <h4>No current engagement</h4>
              <p>
                Past employer engagements remain in the history below. Evidence
                progress is shown for a current engagement only.
              </p>
            </div>
          ) : !requirements.length ? (
            <div className="profile-empty">
              <span className="profile-empty-mark">
                <Icon name="file" size={26} />
              </span>
              <h4>A clear starting point</h4>
              <p>
                No client requirements are assigned to this engagement yet.
                Start with the company's agreed requirements.
              </p>
              <button onClick={() => onFile()}>
                Assign an existing requirement <Icon name="arrow" size={15} />
              </button>
            </div>
          ) : (
            <>
              {next && nextCue && (
                <div className={"driver-next-action tone-" + nextCue.tone}>
                  <span className="next-action-symbol" aria-hidden="true">
                    <Icon
                      name={
                        nextCue.tone === "attention"
                          ? "info"
                          : nextCue.tone === "working"
                            ? "clock"
                            : "file"
                      }
                      size={19}
                    />
                  </span>
                  <div>
                    <small>Next useful step</small>
                    <strong>{next.title}</strong>
                    <p>{nextCue.detail}</p>
                    {nextCue.responsibility && (
                      <span className="requirement-owner-label">
                        {nextCue.responsibility === "intake"
                          ? "Intake"
                          : "Review"}
                        :{" "}
                        {responsibilityLabel(
                          configuration[nextCue.responsibility + "_owner"],
                        )}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setSelectedRequirement(next.id)}>
                    {nextCue.action}
                    <Icon name="arrow" size={14} />
                  </button>
                </div>
              )}
              <div className="driver-evidence-progress">
                <div>
                  <strong>
                    {reviewed}{" "}
                    <span>of {requirements.length} requirements reviewed</span>
                  </strong>
                  <span>
                    {requirements.length - reviewed
                      ? "Evidence work in progress"
                      : "Assigned evidence reviewed"}
                  </span>
                </div>
                <progress
                  max={requirements.length}
                  value={reviewed}
                  aria-label="Current requirements with verified evidence"
                />
                <p>
                  Verified evidence against assigned client requirements. This
                  is not a legal qualification score.
                </p>
              </div>
              <div className="profile-work-legend">
                <span>
                  <i className="profile-dot needed" />
                  {needed} need attention
                </span>
                <span>
                  <i className="profile-dot reviewing" />
                  {pending} processing or review
                </span>
                <span>
                  <i className="profile-dot reviewed" />
                  {reviewed} reviewed
                </span>
              </div>
              <ol className="driver-onboarding-tasks">
                {tasks.map((req) => {
                  const cue = requirementCue(req, !!file?.can_review);
                  return (
                    <li key={req.id}>
                      <details>
                        <summary>
                          <span
                            className={
                              "profile-task-symbol " +
                              (req.status === "verified"
                                ? "is-reviewed"
                                : ["missing", "expired", "rejected"].includes(
                                      req.status,
                                    )
                                  ? "needs-evidence"
                                  : "is-reviewing")
                            }
                            aria-hidden="true"
                          >
                            {req.status === "verified" ? (
                              <Icon name="check" size={16} />
                            ) : (
                              <Icon
                                name={
                                  req.status === "needs_review"
                                    ? "clock"
                                    : "file"
                                }
                                size={16}
                              />
                            )}
                          </span>
                          <span className="profile-task-title">
                            <strong>{req.title}</strong>
                            <small>{req.code}</small>
                          </span>
                          <span
                            className={
                              "profile-task-state work-tone-" + cue.tone
                            }
                          >
                            {cue.label}
                          </span>
                          <span
                            className="profile-task-chevron"
                            aria-hidden="true"
                          >
                            ⌄
                          </span>
                        </summary>
                        <div className="profile-task-details">
                          <div className="requirement-responsibility">
                            <Icon name="service" size={14} />
                            <span>
                              {cue.responsibility
                                ? `${cue.responsibility === "intake" ? "Intake" : "Review"} responsibility: ${responsibilityLabel(configuration[cue.responsibility + "_owner"])}`
                                : cue.tone === "complete"
                                  ? "Recorded review outcome"
                                  : "Security processing; no reviewer assigned by this status"}
                            </span>
                          </div>
                          <p>
                            {req.evidence.length
                              ? `${req.evidence.length} evidence version${req.evidence.length === 1 ? "" : "s"} recorded. Open the file to inspect the scan and review history.`
                              : "No evidence version has been uploaded for this requirement."}
                          </p>
                          <button
                            className="secondary"
                            onClick={() => setSelectedRequirement(req.id)}
                          >
                            View requirement <Icon name="arrow" size={14} />
                          </button>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>
        {record.access.can_write && (
          <DriverPortalAccess record={record} path={path} />
        )}
        {(record.access.can_history ||
          !!file?.items.some((r) => r.evidence.length)) && (
          <DriverActivity
            record={record}
            requirements={requirements}
            onRequirement={setSelectedRequirement}
            onHistory={onHistory}
          />
        )}
      </div>
      {selected && record.access.can_write && (
        <DetailPanel
          title={selected.title}
          context={`${record.first_name} ${record.last_name} \u00b7 ${record.reference}`}
          onClose={() => setSelectedRequirement(undefined)}
        >
          <div className="requirement-responsibility">
            <Icon name="service" size={16} />
            <span>
              Intake: {responsibilityLabel(configuration.intake_owner)}{" "}
              {"\u00b7"}
              Review: {responsibilityLabel(configuration.review_owner)}
            </span>
          </div>
          <QualificationFile
            path={path + "/file"}
            engagements={record.engagements}
            onlyRequirementId={selected.id}
            onChanged={setFile}
          />
          <button
            className="quiet panel-full-file"
            onClick={() => {
              setSelectedRequirement(undefined);
              onFile(selected.id);
            }}
          >
            Open full qualification file <Icon name="arrow" size={14} />
          </button>
        </DetailPanel>
      )}
    </div>
  );
}
