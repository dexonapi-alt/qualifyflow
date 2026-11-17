import type { Detail } from "./api";
import { State } from "./Forms";
import { Icon } from "./UI";
import {
  IdentityMark,
  ReadinessSignal,
  LocationEmpty,
} from "./VisualInformation";

export function CompanyOverview({
  detail,
  admin,
  manage,
  role,
  showStatus,
  onSection,
}: {
  detail: Detail;
  admin: boolean;
  manage: boolean;
  role: string;
  showStatus: boolean;
  onSection: (section: string) => void;
}) {
  const pending = ["draft", "configuring", "ready_for_review"].includes(
    detail.status,
  );
  const writable = ![
    "suspended",
    "closed",
    "offboarding",
    "archived_draft",
  ].includes(detail.status);
  return (
    <section
      className="account-overview overview-workspace"
      aria-label="Account overview"
    >
      <section
        className="overview-module company-profile"
        aria-labelledby="company-profile-title"
      >
        <header className="profile-header">
          <div className="profile-identity">
            <IdentityMark value={detail.display_name} organization />
            <div>
              <h2 id="company-profile-title">
                {showStatus ? detail.display_name : "Company profile"}
              </h2>
              <p>{detail.customer_ref}</p>
            </div>
            {showStatus && <State value={detail.status} />}
          </div>
          <button
            className="quiet profile-config"
            onClick={() => onSection("overview")}
          >
            View configuration <Icon name="arrow" size={14} />
          </button>
        </header>
        <div className="profile-body">
          <section
            className="profile-group"
            aria-labelledby="organization-title"
          >
            <h3 id="organization-title">
              <Icon name="companies" size={16} />
              Organization
            </h3>
            <dl className="profile-facts">
              <div className="wide-fact">
                <dt>Legal name</dt>
                <dd>{detail.legal_name}</dd>
              </div>
              <div>
                <dt>Region</dt>
                <dd>{detail.region}</dd>
              </div>
            </dl>
          </section>
          <section className="profile-group" aria-labelledby="contact-title">
            <h3 id="contact-title">Primary contact</h3>
            <div className="profile-contact">
              <IdentityMark value={detail.primary_contact} />
              <span>{detail.primary_contact}</span>
            </div>
          </section>
          <section className="profile-group" aria-labelledby="service-title">
            <h3 id="service-title">
              <Icon name="service" size={16} />
              Service details
            </h3>
            <dl className="profile-facts service-facts">
              <div>
                <dt>Service mode</dt>
                <dd className="service-mode-value">
                  {detail.mode.replaceAll("_", " ")}
                </dd>
              </div>
              <div>
                <dt>Effective date</dt>
                <dd>
                  <time dateTime={detail.effective_date}>
                    {detail.effective_date}
                  </time>
                </dd>
              </div>
              <div className="wide-fact">
                <dt>Timezone</dt>
                <dd>{detail.timezone}</dd>
              </div>
            </dl>
          </section>
        </div>
      </section>
      <section
        className="overview-module readiness-module"
        aria-labelledby="readiness-title"
      >
        <h2 id="readiness-title">
          {pending ? "What happens next" : "Account readiness"}
        </h2>
        <ReadinessSignal status={detail.status} />
        {admin && pending && detail.missing_prerequisites.length > 0 && (
          <div className="overview-blockers">
            <h3>Pending requirements</h3>
            <ul className="checklist">
              {detail.missing_prerequisites.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="access-strip">
          <Icon name="access" size={18} />
          <div>
            <span className="role-label">{role}</span>
            <p>
              {detail.scope.branch_id ? "Assigned branch" : "Whole company"}{" "}
              access
            </p>
          </div>
        </div>
        <div className="readiness-actions">
          {admin ? (
            <button onClick={() => onSection("overview")}>
              Manage setup <Icon name="arrow" size={15} />
            </button>
          ) : manage && writable ? (
            <button onClick={() => onSection("people")}>
              <Icon name="users" size={16} />
              Manage users
            </button>
          ) : (
            <button className="secondary" onClick={() => onSection("overview")}>
              View configuration <Icon name="arrow" size={15} />
            </button>
          )}
          {manage && !admin && !writable && (
            <button className="secondary" onClick={() => onSection("people")}>
              View people & access
            </button>
          )}
          {pending && !admin && manage && writable && (
            <p>
              You can manage users and locations while service activation is
              pending.
            </p>
          )}
        </div>
      </section>
      <section
        className="overview-module locations-module"
        aria-labelledby="overview-locations-title"
      >
        <header className="module-heading">
          <h2 id="overview-locations-title">
            <Icon name="location" size={18} />
            Locations
          </h2>
          <span className="location-scope-count">
            {detail.branches.length}{" "}
            {detail.branches.length === 1 ? "location" : "locations"} in your
            scope
          </span>
        </header>
        {detail.branches.length ? (
          <ul className="location-preview">
            {detail.branches.slice(0, 2).map((branch) => (
              <li key={branch.id}>
                <Icon name="location" size={16} />
                <div>
                  <strong>{branch.name}</strong>
                  <small>{branch.reference}</small>
                </div>
                <State value={branch.status} />
              </li>
            ))}
          </ul>
        ) : (
          <LocationEmpty manage={manage && writable} />
        )}
        <button
          className="location-summary secondary"
          onClick={() => onSection("branches")}
        >
          {manage && writable ? "Manage locations" : "View locations"}
          <Icon name="arrow" size={15} />
        </button>
      </section>
    </section>
  );
}
