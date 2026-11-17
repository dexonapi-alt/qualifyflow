import { useEffect, useRef, useState } from "react";
import {
  api,
  type User,
  type Company,
  type Detail,
  type Invite,
  type Member,
  type Assignment,
  type DriverAccess,
} from "./api";
import { Form, Field, State } from "./Forms";
import { AuthFrame, Brand, Icon } from "./UI";
import { CompanyOverview } from "./CompanyOverview";
import { IdentityMark, AuditAction, LocationEmpty } from "./VisualInformation";
import { EmptyState, SpotIllustration } from "./EmptyState";
import { DriverWorkspace } from "./DriverWorkspace";
import { IntakeWorkspace } from "./IntakeWorkspace";
import { WorkQueues } from "./WorkQueues";
import { RequirementCatalog } from "./QualificationFile";
import { Correspondence } from "./Correspondence";
import { FileReviewQueue } from "./FileReviewQueue";
import { ManagedOverview } from "./ManagedOverview";
import { ProductHeader, ProductSidebar } from "./ProductChrome";

type WorkspaceNavigation = {
  id: string;
  name: string;
  tab: string;
  access: DriverAccess | null;
  mode?: string;
  status: string;
  activationPrerequisites?: string[];
};

function roleLabel(role: string) {
  return (
    (
      {
        client_admin: "Company administrator",
        client_contributor: "Contributor",
        client_viewer: "Viewer",
        specialist: "Specialist",
        reviewer: "Reviewer",
      } as Record<string, string>
    )[role] || role.replaceAll("_", " ")
  );
}

function WorkspaceBreadcrumb({
  ops,
  current,
  onBack,
}: {
  ops: boolean;
  current: string;
  onBack?: () => void;
}) {
  return (
    <nav className="workspace-breadcrumb" aria-label="Breadcrumb">
      <span>{ops ? "Operations console" : "Client portal"}</span>
      <span aria-hidden="true">/</span>
      {onBack && (
        <>
          <button className="back quiet" onClick={onBack}>
            {ops ? "Companies" : "Company access"}
          </button>
          <span aria-hidden="true">/</span>
        </>
      )}
      <span aria-current="page">{current}</span>
    </nav>
  );
}

export default function App() {
  const [directory, setDirectory] = useState(false),
    [mobileMenu, setMobileMenu] = useState(false);
  const [newDriverIntent, setNewDriverIntent] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("new") === "driver",
  );
  const [focus, setFocus] = useState(() => ({
    driver: new URLSearchParams(location.hash.slice(1)).get("driver") || "",
    source: new URLSearchParams(location.hash.slice(1)).get("source") || "",
  }));
  const [workspaceNavigation, setWorkspaceNavigation] =
    useState<WorkspaceNavigation | null>(null);
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]),
    [selected, setSelected] = useState(
      () => new URLSearchParams(location.hash.slice(1)).get("company") || "",
    ),
    [section, setSection] = useState(
      () =>
        new URLSearchParams(location.hash.slice(1)).get("view") || "summary",
    ),
    [creating, setCreating] = useState(false),
    [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(""),
    [listing, setListing] = useState(false);
  const inviteToken = new URLSearchParams(location.hash.slice(1)).get("invite");
  const accountScope = useRef<string | null>(null);
  accountScope.current = user?.id || null;
  async function refresh() {
    const requestedAccount = accountScope.current;
    setListing(true);
    try {
      const r = await api<{ items: Company[] }>("/tenants");
      if (accountScope.current !== requestedAccount) return;
      setCompanies(r.items);
      setHasMore(r.items.length === 50);
    } finally {
      if (accountScope.current === requestedAccount) setListing(false);
    }
  }
  useEffect(() => {
    api<{ user: User }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (user) refresh().catch((e) => setError(e.message));
    else if (!loading) {
      setCompanies([]);
      setSelected("");
      setWorkspaceNavigation(null);
    }
  }, [user, loading]);
  useEffect(() => {
    if (
      user &&
      user.platform_role !== "service_admin" &&
      !directory &&
      !creating &&
      !selected &&
      companies.length === 1
    ) {
      history.replaceState(
        null,
        "",
        "#" +
          new URLSearchParams({
            company: companies[0].id,
            view: "home",
          }).toString(),
      );
      setSection("home");
      setSelected(companies[0].id);
    }
  }, [user, directory, creating, selected, companies]);
  useEffect(() => {
    const syncRoute = () => {
      const route = new URLSearchParams(location.hash.slice(1));
      setDirectory(!route.get("company"));
      setMobileMenu(false);
      setNewDriverIntent(route.get("new") === "driver");
      setSelected(route.get("company") || "");
      setFocus({
        driver: route.get("driver") || "",
        source: route.get("source") || "",
      });
      const view = route.get("view") || "summary";
      setSection(
        [
          "summary",
          "home",
          "drivers",
          "intake",
          "exceptions",
          "approvals",
          "requirements",
          "correspondence",
          "files",
          "branches",
          "people",
          "overview",
          "service",
          "history",
        ].includes(view)
          ? view
          : "summary",
      );
      setCreating(false);
    };
    window.addEventListener("popstate", syncRoute);
    window.addEventListener("hashchange", syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("hashchange", syncRoute);
    };
  }, []);
  function open(
    id: string,
    tab = user?.platform_role === "service_admin" ? "summary" : "home",
    driver = "",
    source = "",
    addDriver = false,
  ) {
    history.pushState(
      null,
      "",
      "#" +
        new URLSearchParams({
          company: id,
          view: tab,
          ...(driver ? { driver } : {}),
          ...(source ? { source } : {}),
          ...(addDriver ? { new: "driver" } : {}),
        }).toString(),
    );
    setFocus({ driver, source });
    setDirectory(false);
    setMobileMenu(false);
    setNewDriverIntent(addDriver);
    setSection(tab);
    setSelected(id);
    setCreating(false);
  }
  function showCompanies() {
    history.pushState(null, "", location.pathname + location.search);
    setSelected("");
    setSection("summary");
    setFocus({ driver: "", source: "" });
    setCreating(false);
    setDirectory(true);
    setMobileMenu(false);
    setNewDriverIntent(false);
  }
  async function logout() {
    try {
      await api("/auth/logout", {});
      setUser(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (loading)
    return (
      <main className="loading-screen">
        <Brand />
        <p role="status">Opening workspace...</p>
      </main>
    );
  if (inviteToken) return <AcceptInvite token={inviteToken} user={user} />;
  if (!user)
    return (
      <AuthFrame>
        <div className="auth-title">
          <h1>Sign in to your workspace</h1>
          <p>Welcome back to QualifyFlow.</p>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Form
          label="Sign in"
          onSave={async (d) => {
            const r = await api<{ user: User }>("/auth/login", d);
            setUser(r.user);
          }}
        >
          <Field
            name="email"
            label="Email address"
            type="email"
            autoComplete="username"
          />
          <Field name="password" label="Password" type="password" />
          <Field
            name="code"
            label="Authenticator code"
            required={false}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            help="Enter the six-digit code from your authenticator if MFA is enabled. Required for administrators."
          />
        </Form>
        <p className="auth-footnote">
          Access is by invitation. Contact your company administrator for an
          account.
        </p>
      </AuthFrame>
    );
  const ops = !!user.platform_role;
  const currentWorkspaceId =
    selected ||
    (!directory &&
    !creating &&
    user.platform_role !== "service_admin" &&
    companies.length === 1
      ? companies[0].id
      : "");
  const navigation =
    workspaceNavigation?.id === currentWorkspaceId ? workspaceNavigation : null;
  return (
    <div className={"product " + (ops ? "operations" : "portal")}>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <ProductSidebar
        user={user}
        context={navigation}
        companies={companies}
        onOpen={open}
        onClients={showCompanies}
        mobileOpen={mobileMenu}
        onClose={() => setMobileMenu(false)}
      />
      <div className="product-body">
        <ProductHeader
          user={user}
          context={navigation}
          companies={companies}
          onOpen={open}
          onClients={showCompanies}
          onLogout={logout}
          onAddDriver={
            navigation?.access?.can_write
              ? () => open(currentWorkspaceId, "drivers", "", "", true)
              : undefined
          }
          onMenu={() => setMobileMenu(true)}
        />
        <main id="main">
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {currentWorkspaceId ? (
            <CompanyWorkspace
              key={
                currentWorkspaceId +
                (selected ? section : "home") +
                focus.driver +
                focus.source +
                newDriverIntent
              }
              initialTab={selected ? section : "home"}
              initialDriverId={focus.driver}
              sourceItemId={focus.source}
              initialCreate={newDriverIntent}
              onAddDriver={() =>
                open(currentWorkspaceId, "drivers", "", "", true)
              }
              onOpenDriver={(driver, source) =>
                open(currentWorkspaceId, "drivers", driver, source)
              }
              onContext={setWorkspaceNavigation}
              onNavigate={(view) => open(currentWorkspaceId, view)}
              id={currentWorkspaceId}
              user={user}
              onBack={() => {
                showCompanies();
                refresh().catch((e) => setError(e.message));
              }}
            />
          ) : (
            <section id="content">
              <div className="heading">
                <div>
                  <h1>
                    {creating
                      ? "Create company"
                      : ops
                        ? "Companies"
                        : "Company access"}
                  </h1>
                  <p className="page-description">
                    {creating
                      ? "Start with company details. You can finish account setup later."
                      : ops
                        ? "Manage client accounts, access and onboarding."
                        : "Company settings and access."}
                  </p>
                  <WorkspaceBreadcrumb
                    ops={ops}
                    current={
                      creating
                        ? "Create company"
                        : ops
                          ? "Companies"
                          : "Company access"
                    }
                  />
                </div>
                {user.platform_role === "service_admin" && (
                  <button
                    className={creating ? "secondary" : "primary"}
                    onClick={() => setCreating(!creating)}
                  >
                    {creating ? (
                      "Back to companies"
                    ) : (
                      <>
                        <span aria-hidden="true">+</span> Create company
                      </>
                    )}
                  </button>
                )}
              </div>
              {creating ? (
                <CompanyCreate
                  onCreated={async (c) => {
                    setCreating(false);
                    await refresh();
                    open(c.id);
                  }}
                />
              ) : listing && companies.length === 0 ? (
                <p className="inline-loading" role="status">
                  Loading companies...
                </p>
              ) : (
                <CompanyDirectory
                  companies={companies}
                  ops={ops}
                  canCreate={user.platform_role === "service_admin"}
                  open={open}
                  create={() => setCreating(true)}
                />
              )}
              {hasMore && !creating && (
                <button
                  className="secondary load-more"
                  onClick={async () => {
                    const requestedAccount = accountScope.current;
                    try {
                      const r = await api<{ items: Company[] }>(
                        `/tenants?offset=${companies.length}&limit=50`,
                      );
                      if (accountScope.current !== requestedAccount) return;
                      setCompanies((previous) => [...previous, ...r.items]);
                      setHasMore(r.items.length === 50);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Load more companies
                </button>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function CompanyDirectory({
  companies,
  ops,
  canCreate,
  open,
  create,
}: {
  companies: Company[];
  ops: boolean;
  canCreate: boolean;
  open: (id: string) => void;
  create: () => void;
}) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("name");
  const shown = companies
    .filter(
      (c) =>
        (c.display_name + " " + c.customer_ref + " " + c.legal_name)
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (status === "all" || c.status === status),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.display_name.localeCompare(b.display_name)
        : a.status.localeCompare(b.status),
    );
  if (!companies.length)
    return (
      <div className="empty">
        <span className="empty-icon">
          <Icon name="companies" size={28} />
        </span>
        <h2>
          {ops ? "Your client workspace starts here" : "No company access yet"}
        </h2>
        <p>
          {canCreate
            ? "Create a company to configure its service, locations and team."
            : "An administrator needs to invite you or assign your account to a company."}
        </p>
        {canCreate && <button onClick={create}>Create first company</button>}
      </div>
    );
  return (
    <div className="directory">
      <div className="directory-toolbar">
        <label className="search-field">
          <Icon name="search" />
          <input
            aria-label="Search displayed companies"
            placeholder="Search companies or references"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter company status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {[...new Set(companies.map((c) => c.status))].map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort companies"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="name">Name A-Z</option>
          <option value="status">Status</option>
        </select>
      </div>
      <div className="directory-columns" aria-hidden="true">
        <span>Company</span>
        <span>Service mode</span>
        <span>Status</span>
        <span>Open</span>
      </div>
      <div className="company-list">
        {shown.map((c) => (
          <button className="company-row" key={c.id} onClick={() => open(c.id)}>
            <span className="company-cell">
              <span>
                <strong>{c.display_name}</strong>
                <small>{c.customer_ref}</small>
              </span>
            </span>
            <span className="service-mode">{c.mode.replaceAll("_", " ")}</span>
            <State value={c.status} />
            <Icon name="arrow" />
          </button>
        ))}
        {shown.length === 0 && (
          <div className="no-results">
            <SpotIllustration kind="search" />
            <h2>No matching companies</h2>
            <p>Try another name, reference or status.</p>
            <button
              className="quiet"
              onClick={() => {
                setQuery("");
                setStatus("all");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
      <div className="directory-footer">
        Showing {shown.length} of {companies.length} loaded companies
      </div>
    </div>
  );
}

function CompanyCreate({
  onCreated,
}: {
  onCreated: (company: Company) => Promise<void>;
}) {
  return (
    <div className="onboarding">
      <div className="form-section-title">
        <h2>Company information</h2>
        <p>
          Creates a draft account. No access is granted until an invitation is
          accepted.
        </p>
      </div>
      <Form
        label="Create draft company"
        onSave={async (d) => onCreated(await api<Company>("/tenants", d))}
      >
        <div className="form-grid">
          <Field name="legal_name" label="Legal company name" minLength={2} />
          <Field name="display_name" label="Display name" minLength={2} />
          <Field name="customer_ref" label="Customer reference (uppercase)" />
          <Field name="mode" label="Service mode" defaultValue="managed">
            <option value="managed">Managed service</option>
            <option value="self_service">Self-service</option>
            <option value="hybrid">Hybrid</option>
          </Field>
          <Field
            name="timezone"
            label="IANA timezone"
            defaultValue="America/Chicago"
          />
          <Field name="region" label="Region / jurisdiction metadata" />
          <Field
            name="primary_contact"
            label="Primary contact email"
            type="email"
          />
          <Field
            name="effective_date"
            label="Service effective date"
            type="date"
          />
        </div>
      </Form>
    </div>
  );
}

function AcceptInvite({ token, user }: { token: string; user: User | null }) {
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(
      null,
    ),
    [done, setDone] = useState(false),
    [setupError, setSetupError] = useState("");
  return (
    <main className="auth">
      <Brand />
      <p className="eyebrow">Workspace invitation</p>
      <h1>Accept your invitation</h1>
      {done ? (
        <>
          <p role="status">
            Invitation accepted. Your scoped membership is active.
          </p>
          <a href="/">Continue to sign in</a>
        </>
      ) : (
        <>
          <p className="intro">
            {user
              ? `Accept as ${user.email}.`
              : "Set a password. Administrator invitations also require an authenticator."}
          </p>
          {!user && (
            <button
              className="secondary"
              onClick={async () => {
                try {
                  setSetup(await api("/invitations/mfa-setup", { token }));
                } catch (e) {
                  setSetupError((e as Error).message);
                }
              }}
            >
              Set up administrator authenticator
            </button>
          )}
          {setupError && (
            <p role="alert" className="error">
              {setupError}
            </p>
          )}
          {setup && (
            <div className="setup">
              <p>
                Add this setup key to an authenticator app using time-based
                codes.
              </p>
              <code>{setup.secret}</code>
              <p>
                Keep this key for future sign-ins. Enter the six-digit code from
                the app below, not this setup key.
              </p>
            </div>
          )}
          <Form
            label="Accept invitation"
            onSave={async (d) => {
              await api("/invitations/accept", {
                token,
                ...(!user
                  ? {
                      password: d.password,
                      ...(setup
                        ? { totp_secret: setup.secret, code: d.code }
                        : {}),
                    }
                  : {}),
              });
              setSetup(null);
              setDone(true);
              history.replaceState(null, "", "/");
            }}
          >
            {!user && (
              <>
                <Field
                  name="password"
                  label="New password (at least 12 characters)"
                  type="password"
                  minLength={12}
                />
                {setup && (
                  <Field
                    name="code"
                    label="Authenticator verification code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    help="Six digits from your authenticator app, not the setup key."
                  />
                )}
              </>
            )}
          </Form>
        </>
      )}
      <p className="muted">
        Existing account holders must sign in as the invited email before
        accepting.
      </p>
    </main>
  );
}

function CompanyWorkspace({
  id,
  user,
  onBack,
  initialTab = "summary",
  embedded = false,
  onContext,
  initialDriverId,
  sourceItemId,
  onOpenDriver,
  onNavigate,
  initialCreate,
  onAddDriver,
}: {
  id: string;
  user: User;
  onBack: () => void;
  initialTab?: string;
  embedded?: boolean;
  onContext?: (context: WorkspaceNavigation) => void;
  initialDriverId?: string;
  sourceItemId?: string;
  onOpenDriver?: (driver: string, source: string) => void;
  onNavigate?: (view: string) => void;
  initialCreate?: boolean;
  onAddDriver?: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null),
    [tab, setTabState] = useState(initialTab),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const setTab = (view: string) => {
    if (onNavigate) onNavigate(view);
    else setTabState(view);
  };
  useEffect(() => {
    if (detail)
      onContext?.({
        id,
        name: detail.display_name,
        tab,
        access: detail.driver_access || null,
        mode: detail.mode,
        status: detail.status,
        activationPrerequisites:
          detail.scope.role === "service_admin"
            ? detail.missing_prerequisites
            : undefined,
      });
  }, [id, tab, detail, onContext]);
  const [sectionConfirmation, setSectionConfirmation] = useState(false);
  const [noticePath, setNoticePath] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]),
    [members, setMembers] = useState<Member[]>([]),
    [assignments, setAssignments] = useState<Assignment[]>([]),
    [staff, setStaff] = useState<{ id: string; email: string }[]>([]);
  const [events, setEvents] = useState<
    {
      id: string;
      action: string;
      occurred_at: string;
      correlation_id: string;
      actor_id: string | null;
      resource_id: string | null;
    }[]
  >([]);
  const [branchQuery, setBranchQuery] = useState("");
  const [sectionLoading, setSectionLoading] = useState(false);
  const base = "/tenants/" + id,
    admin = user.platform_role === "service_admin";
  async function load() {
    const d = await api<Detail>(base);
    setDetail(d);
  }
  const manage =
    admin || (detail?.scope.role === "client_admin" && !detail.scope.branch_id);
  useEffect(() => {
    let active = true;
    api<Detail>(base)
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [base]);
  useEffect(() => {
    let active = true;
    setError("");
    setInvites([]);
    setMembers([]);
    setEvents([]);
    setAssignments([]);
    async function run() {
      if (
        (tab === "people" && manage) ||
        (tab === "service" && admin) ||
        tab === "history"
      )
        setSectionLoading(true);
      if (tab === "people" && manage) {
        const [i, m] = await Promise.all([
          api<{ items: Invite[] }>(base + "/invitations"),
          api<{ items: Member[] }>(base + "/memberships"),
        ]);
        if (active) {
          setInvites(i.items);
          setMembers(m.items);
        }
      }
      if (tab === "service" && admin) {
        const [a, s] = await Promise.all([
          api<{ items: Assignment[] }>(base + "/operator-assignments"),
          api<{ items: { id: string; email: string }[] }>("/staff"),
        ]);
        if (active) {
          setAssignments(a.items);
          setStaff(s.items);
        }
      }
      if (tab === "history") {
        const r = await api<{ items: typeof events }>(base + "/audit-events");
        if (active) setEvents(r.items);
      }
    }
    run()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setSectionLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, base, manage, notice]);
  async function save(
    path: string,
    data: unknown,
    message: string,
    confirmInSection = false,
  ) {
    setSectionConfirmation(false);
    setNoticePath("");
    await api(base + path, data);
    await load();
    setNotice(message + " " + new Date().toLocaleTimeString());
    setSectionConfirmation(confirmInSection);
    setNoticePath(path);
    setFeedbackMessage(message);
    return message;
  }
  if (!detail)
    return (
      <section
        id={embedded ? undefined : "content"}
        className={"company-workspace" + (embedded ? " single-company" : "")}
      >
        {!embedded && (
          <>
            <h1>Company access</h1>
            <WorkspaceBreadcrumb
              ops={!!user.platform_role}
              current="Company"
              onBack={onBack}
            />
          </>
        )}
        <p role={error ? "alert" : "status"} className="inline-loading">
          {error || "Loading company..."}
        </p>
      </section>
    );
  const writable = ![
    "suspended",
    "closed",
    "offboarding",
    "archived_draft",
  ].includes(detail.status);
  const moduleTitle: Record<string, string> = {
    home: "Overview",
    drivers: "Drivers",
    intake: "Screening intake",
    exceptions: "Exceptions",
    approvals: "Approvals",
    requirements: "Requirements",
    correspondence: "Client correspondence",
    files: "File review",
  };
  const operational = tab in moduleTitle;
  const moduleAllowed =
    tab === "home"
      ? true
      : tab === "drivers"
        ? !!detail.driver_access
        : tab === "requirements"
          ? !!detail.driver_access?.can_correct
          : !!detail.driver_access?.can_write;
  const shownBranches = detail.branches.filter((branch) =>
    (branch.name + " " + branch.reference)
      .toLowerCase()
      .includes(branchQuery.toLowerCase()),
  );
  const canAudit =
    manage || (detail.scope.role === "reviewer" && !detail.scope.branch_id);
  const branchOptions = (
    <>
      <option value="">Whole company</option>
      {detail.branches.map((b) => (
        <option value={b.id} key={b.id}>
          {b.name}
        </option>
      ))}
    </>
  );
  return (
    <section
      id={embedded ? undefined : "content"}
      className={"company-workspace" + (embedded ? " single-company" : "")}
    >
      {!embedded && tab !== "home" && (
        <>
          <div className="heading">
            <div>
              <h1>
                {operational
                  ? moduleTitle[tab]
                  : user.platform_role
                    ? detail.display_name
                    : "Company access"}
              </h1>
            </div>
            {user.platform_role && <State value={detail.status} />}
          </div>
          <p className="context">
            {detail.legal_name} <span>·</span>{" "}
            {detail.mode.replaceAll("_", " ")} <span>·</span> {detail.timezone}
            {detail.scope.branch_id && <strong> · Branch scope</strong>}
          </p>
          <WorkspaceBreadcrumb
            ops={!!user.platform_role}
            current={operational ? moduleTitle[tab] : detail.display_name}
            onBack={onBack}
          />
        </>
      )}
      {!operational && (
        <nav className="tabs" aria-label="Company sections">
          {[
            "summary",
            "branches",
            ...(manage ? ["people"] : []),
            "overview",
            ...(admin ? ["service"] : []),
            ...(canAudit ? ["history"] : []),
          ].map((t) => (
            <button
              key={t}
              aria-current={tab === t ? "page" : undefined}
              className={tab === t ? "selected" : ""}
              onClick={() => {
                setTab(t);
                setNotice("");
              }}
            >
              {
                (
                  {
                    summary: "Overview",
                    drivers: "Drivers",
                    intake: "Screening intake",
                    exceptions: "Exceptions",
                    approvals: "Approvals",
                    overview: "Configuration",
                    branches: "Locations",
                    people: "People & access",
                    service: "Service assignment",
                    history: "Audit history",
                  } as Record<string, string>
                )[t]
              }
            </button>
          ))}
        </nav>
      )}
      {!user.platform_role && !operational && tab !== "summary" && (
        <div className="company-section-context">
          <div className="company-identity">
            <IdentityMark value={detail.display_name} organization />
            <div>
              <h2>{detail.display_name}</h2>
              <p>
                {detail.customer_ref} · {detail.mode.replaceAll("_", " ")}
              </p>
            </div>
            <State value={detail.status} />
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {operational && !moduleAllowed && (
        <p className="error" role="alert">
          This workspace is unavailable with your current company permissions.
          Choose an authorized destination from the sidebar.
        </p>
      )}
      {notice && sectionConfirmation && (
        <div role="status" className="action-confirmation section-confirmation">
          <Icon name="check" size={16} />
          <span>{feedbackMessage}</span>
        </div>
      )}
      {tab === "summary" && (
        <CompanyOverview
          detail={detail}
          admin={admin}
          manage={manage}
          role={roleLabel(detail.scope.role)}
          showStatus={!user.platform_role}
          onSection={setTab}
        />
      )}
      {tab === "home" && (
        <ManagedOverview
          companyId={id}
          companyName={detail.display_name}
          timezone={detail.timezone}
          onNavigate={setTab}
          onDriver={onOpenDriver}
          onAddDriver={onAddDriver}
          configuration={detail.configuration}
          activationPrerequisites={
            admin ? detail.missing_prerequisites : undefined
          }
        />
      )}
      {tab === "drivers" && detail.driver_access && (
        <DriverWorkspace
          key={id}
          companyId={id}
          companyName={detail.display_name}
          access={detail.driver_access}
          branches={detail.branches}
          initialDriverId={initialDriverId}
          initialCreate={initialCreate}
          onCreated={(driver) => onOpenDriver?.(driver, "")}
          sourceItemId={sourceItemId}
        />
      )}
      {tab === "intake" && detail.driver_access?.can_write && (
        <IntakeWorkspace
          key={id}
          companyId={id}
          access={detail.driver_access}
          branches={detail.branches}
          companyReference={detail.customer_ref}
          onOpenDriver={onOpenDriver}
        />
      )}
      {(tab === "exceptions" || tab === "approvals") &&
        detail.driver_access?.can_write && (
          <WorkQueues
            key={id + tab}
            companyId={id}
            mode={tab}
            onOpenDriver={onOpenDriver}
          />
        )}
      {tab === "requirements" && detail.driver_access?.can_correct && (
        <RequirementCatalog companyId={id} />
      )}
      {tab === "correspondence" && detail.driver_access?.can_write && (
        <Correspondence companyId={id} />
      )}
      {tab === "files" && detail.driver_access?.can_write && (
        <FileReviewQueue companyId={id} onOpenDriver={onOpenDriver} />
      )}
      {sectionLoading && (
        <p role="status" className="inline-loading">
          Loading section...
        </p>
      )}
      {tab === "overview" && (
        <div className={"split" + (admin ? "" : " split-readonly")}>
          <div>
            <h2>Company configuration</h2>
            <dl>
              <dt>Legal name</dt>
              <dd>{detail.legal_name}</dd>
              <dt>Customer reference</dt>
              <dd>{detail.customer_ref}</dd>
              <dt>Service mode</dt>
              <dd>{detail.mode.replaceAll("_", " ")}</dd>
              <dt>Primary contact</dt>
              <dd>{detail.primary_contact}</dd>
              <dt>Region</dt>
              <dd>{detail.region}</dd>
              <dt>Timezone</dt>
              <dd>{detail.timezone}</dd>
              <dt>Effective date</dt>
              <dd>{detail.effective_date}</dd>
              <dt>Policy reference</dt>
              <dd>
                {String(
                  detail.configuration.policy_reference || "Not configured",
                )}
              </dd>
              <dt>Intake owner</dt>
              <dd>
                {String(detail.configuration.intake_owner || "Not configured")}
              </dd>
              <dt>Review owner</dt>
              <dd>
                {String(detail.configuration.review_owner || "Not configured")}
              </dd>
              <dt>Record version</dt>
              <dd>{detail.version}</dd>
            </dl>
            {admin && (
              <>
                <h3>Activation requirements</h3>
                {detail.missing_prerequisites.length ? (
                  <ul className="checklist">
                    {detail.missing_prerequisites.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {detail.status === "active"
                      ? "Required account configuration was validated at activation."
                      : "Required account configuration is present. Review before activation."}
                  </p>
                )}
              </>
            )}
          </div>
          {admin && (
            <div className="work-form">
              {["draft", "configuring", "ready_for_review"].includes(
                detail.status,
              ) && (
                <Form
                  key={detail.version}
                  feedback={
                    notice && noticePath === "/configuration"
                      ? feedbackMessage
                      : undefined
                  }
                  label="Save responsibilities"
                  onSave={async (d) =>
                    save(
                      "/configuration",
                      {
                        ...d,
                        version: detail.version,
                        integration_required: d.integration_required === "yes",
                      },
                      "Responsibilities saved.",
                    )
                  }
                >
                  <Field
                    name="policy_reference"
                    label="Approved client policy reference"
                    defaultValue={String(
                      detail.configuration.policy_reference || "",
                    )}
                  />
                  <Field
                    name="intake_owner"
                    label="Intake responsibility"
                    defaultValue={String(
                      detail.configuration.intake_owner ||
                        (detail.mode === "self_service" ? "client" : "service"),
                    )}
                  >
                    <option value="client">Client staff</option>
                    <option value="service">Service team</option>
                  </Field>
                  <Field
                    name="review_owner"
                    label="Review responsibility"
                    defaultValue={String(
                      detail.configuration.review_owner ||
                        (detail.mode === "self_service" ? "client" : "service"),
                    )}
                  >
                    <option value="client">Client staff</option>
                    <option value="service">Service team</option>
                  </Field>
                  <Field
                    name="integration_required"
                    label="Provider integration prerequisite"
                    defaultValue={
                      detail.configuration.integration_required ? "yes" : "no"
                    }
                  >
                    <option value="no">Not required for this onboarding</option>
                    <option value="yes">
                      Required (blocks until verified)
                    </option>
                  </Field>
                  <Field
                    name="reason"
                    label="Configuration rationale"
                    minLength={5}
                  />
                </Form>
              )}
              {[
                "configuring",
                "ready_for_review",
                "active",
                "suspended",
              ].includes(detail.status) && (
                <Form
                  feedback={
                    notice &&
                    ["/review", "/activate", "/suspend"].includes(noticePath)
                      ? feedbackMessage
                      : undefined
                  }
                  label={
                    detail.status === "configuring"
                      ? "Review configuration"
                      : detail.status === "active"
                        ? "Suspend company"
                        : "Activate company"
                  }
                  onSave={async (d) =>
                    save(
                      "/" +
                        (detail.status === "configuring"
                          ? "review"
                          : detail.status === "active"
                            ? "suspend"
                            : "activate"),
                      { ...d, version: detail.version },
                      "Company state updated.",
                    )
                  }
                >
                  <Field
                    name="reason"
                    label="State change rationale"
                    minLength={5}
                  />
                  <p className="muted">
                    {detail.status === "active"
                      ? "Suspension blocks new invitations and administrative writes. History remains available."
                      : "The server rechecks all prerequisites and the current record version."}
                  </p>
                </Form>
              )}
            </div>
          )}
        </div>
      )}
      {tab === "branches" && (
        <div
          className={"split" + (manage && writable ? "" : " split-readonly")}
        >
          <div>
            <h2>Locations</h2>
            {detail.branches.length ? (
              <>
                <label className="search-field location-search">
                  <Icon name="search" />
                  <input
                    aria-label="Search locations"
                    placeholder="Search location names or references"
                    value={branchQuery}
                    onChange={(event) => setBranchQuery(event.target.value)}
                  />
                </label>
                {shownBranches.length ? (
                  <table className="locations-table">
                    <caption className="visually-hidden">
                      Locations in your authorized scope
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Location</th>
                        <th scope="col">Reference</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownBranches.map((branch) => (
                        <tr key={branch.id}>
                          <td>
                            <span className="location-name">
                              <Icon name="location" size={17} />
                              {branch.name}
                            </span>
                          </td>
                          <td>{branch.reference}</td>
                          <td>
                            <State value={branch.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="compact-empty">
                    <SpotIllustration kind="search" />
                    <p>No matching locations.</p>
                    <button
                      className="quiet"
                      onClick={() => setBranchQuery("")}
                    >
                      Clear search
                    </button>
                  </div>
                )}
                <p className="list-caption">
                  Showing {shownBranches.length} of {detail.branches.length}{" "}
                  locations in your scope
                </p>
              </>
            ) : (
              <LocationEmpty manage={manage} />
            )}
          </div>
          {manage && writable && (
            <Form
              label="Add branch"
              feedback={
                notice && noticePath === "/branches"
                  ? feedbackMessage
                  : undefined
              }
              onSave={async (d) => save("/branches", d, "Branch added.")}
            >
              <h3 className="form-title">New location</h3>
              <Field name="name" label="Branch name" />
              <Field name="reference" label="Branch reference (uppercase)" />
            </Form>
          )}
        </div>
      )}
      {tab === "people" && manage && !sectionLoading && (
        <>
          <div className="split">
            <div>
              <h2>Company members</h2>
              <p>
                Invitations grant access only after acceptance. Administrator
                accounts require MFA.
              </p>
              {members.length ? (
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Company members table"
                >
                  <table className="management-table members-table">
                    <caption className="visually-hidden">
                      Company members and authorized access
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Member</th>
                        <th scope="col">Role / scope</th>
                        <th scope="col">Status</th>
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr className="membership-row" key={m.id}>
                          <td>
                            <div className="person-cell">
                              <IdentityMark value={m.email} />
                              <strong>{m.email}</strong>
                            </div>
                          </td>
                          <td>
                            <small>
                              <span className="role-label">
                                {roleLabel(m.role)}
                              </span>
                              {" / "}
                              {m.branch_id ? "Branch" : "Whole company"}
                            </small>
                          </td>
                          <td>
                            <State value={m.status} />
                          </td>
                          <td>
                            {m.status === "active" &&
                              m.email !== user.email && (
                                <button
                                  className="quiet danger"
                                  onClick={async () => {
                                    if (
                                      confirm(
                                        "Revoke access for " + m.email + "?",
                                      )
                                    )
                                      try {
                                        await save(
                                          "/memberships/" + m.id + "/change",
                                          {
                                            version: m.version,
                                            reason:
                                              "Administrator revoked workspace access",
                                            action: "revoke",
                                          },
                                          "Membership revoked.",
                                          true,
                                        );
                                      } catch (e) {
                                        setError((e as Error).message);
                                      }
                                  }}
                                >
                                  Revoke
                                </button>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  kind="invitations"
                  title="No accepted memberships yet."
                >
                  Access appears here when an invited user accepts.
                </EmptyState>
              )}
            </div>
            {writable && (
              <Form
                label="Invite user"
                feedback={
                  notice && noticePath === "/invitations"
                    ? feedbackMessage
                    : undefined
                }
                onSave={async (d) =>
                  save(
                    "/invitations",
                    { ...d, branch_id: d.branch_id || null },
                    "Invitation queued for local delivery.",
                  )
                }
              >
                <h3 className="form-title">Invite a colleague</h3>
                <Field
                  name="email"
                  label="Invitee email address"
                  type="email"
                />
                <Field name="role" label="Role">
                  <option value="client_admin">Company administrator</option>
                  <option value="client_contributor">Contributor</option>
                  <option value="client_viewer">Viewer</option>
                </Field>
                <Field name="branch_id" label="Access scope" required={false}>
                  {branchOptions}
                </Field>
                <p className="muted">
                  Account administration requires whole-company access.
                  Invitations arrive in the local test inbox.
                </p>
              </Form>
            )}
          </div>
          <h3>Invitation history</h3>
          {invites.length ? (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Invitations table"
            >
              <table className="management-table invitations-table">
                <caption className="visually-hidden">
                  Company invitation history
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Recipient / role</th>
                    <th scope="col">Expires</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((i) => (
                    <tr className="invitation-row" key={i.id}>
                      <td>
                        <div className="person-cell">
                          <IdentityMark value={i.email} />
                          <div>
                            <strong>{i.email}</strong>
                            <small>{roleLabel(i.role)}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <time>{new Date(i.expires_at).toLocaleString()}</time>
                      </td>
                      <td>
                        <State value={i.status} />
                      </td>
                      <td>
                        {!["accepted", "revoked"].includes(i.status) &&
                          writable && (
                            <div className="row-actions">
                              {["resend", "revoke"].map((action) => (
                                <button
                                  key={action}
                                  className="quiet"
                                  onClick={async () => {
                                    try {
                                      await save(
                                        "/invitations/" + i.id + "/" + action,
                                        {
                                          version: i.version,
                                          reason:
                                            "Administrator requested invitation " +
                                            action,
                                        },
                                        "Invitation " + action + " recorded.",
                                        true,
                                      );
                                    } catch (e) {
                                      setError((e as Error).message);
                                    }
                                  }}
                                >
                                  {action === "resend" ? "Resend" : "Revoke"}
                                </button>
                              ))}
                            </div>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState kind="invitations" title="No invitations yet.">
              {writable
                ? "Invite a colleague using the form above. Their invitation and delivery state will appear here."
                : "Invitation history will appear here when available. New invitations are unavailable in the current account state."}
            </EmptyState>
          )}
        </>
      )}
      {tab === "service" && admin && !sectionLoading && (
        <div className="split">
          <div>
            <h2>Assigned specialists</h2>
            <p>
              Assignments grant service staff access only to this company and
              the selected scope.
            </p>
            {assignments.length === 0 && (
              <EmptyState kind="specialists" title="No specialists assigned">
                {writable
                  ? "Choose an eligible specialist and scope using the assignment form."
                  : "Assignments can be managed when the account allows changes."}
              </EmptyState>
            )}
            {assignments.map((a) => (
              <div className="ruled specialist-record" key={a.id}>
                <div className="person-cell">
                  <IdentityMark value={a.email} />
                  <strong>{a.email}</strong>
                </div>
                <State value={a.status} />
                {a.status === "active" && (
                  <button
                    className="quiet danger"
                    onClick={async () => {
                      if (
                        confirm(
                          "End this assignment and revoke company access?",
                        )
                      )
                        try {
                          await save(
                            "/operator-assignments/" + a.id + "/end",
                            {
                              version: a.version,
                              reason: "Administrator ended client assignment",
                            },
                            "Assignment ended.",
                            true,
                          );
                        } catch (e) {
                          setError((e as Error).message);
                        }
                    }}
                  >
                    End assignment
                  </button>
                )}
              </div>
            ))}
          </div>
          {writable && (
            <Form
              label="Assign specialist"
              feedback={
                notice && noticePath === "/operator-assignments"
                  ? feedbackMessage
                  : undefined
              }
              onSave={async (d) =>
                save(
                  "/operator-assignments",
                  { ...d, branch_id: d.branch_id || null },
                  "Specialist assigned.",
                )
              }
            >
              <h3 className="form-title">Service assignment</h3>
              <Field name="user_id" label="Eligible specialist">
                <option value="">Select a specialist</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.email}
                  </option>
                ))}
              </Field>
              <Field name="branch_id" label="Assignment scope" required={false}>
                {branchOptions}
              </Field>
              <Field name="reason" label="Assignment rationale" minLength={5} />
              {staff.length === 0 && (
                <p>
                  No eligible specialists are available. A service administrator
                  must provision staff access before assignment.
                </p>
              )}
            </Form>
          )}
        </div>
      )}
      {tab === "history" && canAudit && !sectionLoading && (
        <>
          <h2>Account activity</h2>
          {events.length ? (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Audit history table"
            >
              <table className="management-table audit-table">
                <caption className="visually-hidden">
                  Account audit history
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Event</th>
                    <th scope="col">Occurred</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Target</th>
                    <th scope="col">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <AuditAction action={event.action} />
                      </td>
                      <td>
                        <time
                          dateTime={event.occurred_at}
                          title={event.occurred_at}
                        >
                          {new Date(event.occurred_at).toLocaleString(
                            undefined,
                            { timeZone: "UTC" },
                          )}{" "}
                          UTC
                        </time>
                      </td>
                      <td>
                        {event.actor_id ? (
                          <details className="audit-id">
                            <summary>{event.actor_id.slice(0, 8)}</summary>
                            <code>{event.actor_id}</code>
                          </details>
                        ) : (
                          "Not recorded"
                        )}
                      </td>
                      <td>
                        {event.resource_id ? (
                          <details className="audit-id">
                            <summary>{event.resource_id.slice(0, 8)}</summary>
                            <code>{event.resource_id}</code>
                          </details>
                        ) : (
                          "Not recorded"
                        )}
                      </td>
                      <td>
                        <details className="audit-id">
                          <summary>{event.correlation_id.slice(0, 8)}</summary>
                          <code>{event.correlation_id}</code>
                          <small>Event ID</small>
                          <code>{event.id}</code>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No audit events available.</p>
          )}
        </>
      )}
    </section>
  );
}
