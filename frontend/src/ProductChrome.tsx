import { useEffect, useRef, useState } from "react";
import {
  api,
  type Company,
  type Driver,
  type DriverAccess,
  type User,
} from "./api";
import { Brand, Icon } from "./UI";
import { IdentityMark } from "./VisualInformation";

export type NavigationContext = {
  id: string;
  name: string;
  tab: string;
  mode?: string;
  status: string;
  activationPrerequisites?: string[];
  access: DriverAccess | null;
};
const label = (value: string) =>
  (
    ({
      client_admin: "Company administrator",
      client_contributor: "Contributor",
      client_viewer: "Viewer",
      service_admin: "Service administrator",
      specialist: "Compliance specialist",
      reviewer: "Reviewer",
    }) as Record<string, string>
  )[value] || value.replaceAll("_", " ");

export function ProductSidebar({
  user,
  context,
  companies,
  onOpen,
  onClients,
  mobileOpen,
  onClose,
}: {
  user: User;
  context: NavigationContext | null;
  companies: Company[];
  onOpen: (company: string, view?: string) => void;
  onClients: () => void;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const [mobile, setMobile] = useState(
    () => matchMedia("(max-width: 760px)").matches,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const media = matchMedia("(max-width: 760px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobile || !dialog.current) return;
    if (mobileOpen && !dialog.current.open) dialog.current.showModal();
    else if (!mobileOpen && dialog.current.open) dialog.current.close();
  }, [mobile, mobileOpen]);
  const operations =
    context?.access?.role === "specialist" ||
    context?.access?.role === "reviewer";
  const writable = !!context?.access?.can_write;
  const item = (
    view: string,
    title: string,
    icon:
      | "users"
      | "file"
      | "message"
      | "service"
      | "info"
      | "check"
      | "companies"
      | "branch",
  ) => (
    <button
      key={view}
      className={"nav " + (context?.tab === view ? "active" : "")}
      aria-current={context?.tab === view ? "page" : undefined}
      onClick={() => {
        if (context) onOpen(context.id, view);
        onClose();
      }}
    >
      <Icon name={icon} />
      <span>{title}</span>
    </button>
  );
  const body = (
    <>
      <div className="managed-brand">
        <Brand wordmark />
        {mobile && (
          <button
            className="chrome-icon-button mobile-nav-close"
            aria-label="Close navigation"
            onClick={onClose}
          >
            ×
          </button>
        )}
      </div>
      <nav aria-label="Main navigation">
        {context ? (
          <>
            {item("home", operations ? "My work" : "Overview", "companies")}
            {context.access && item("drivers", "Drivers", "users")}
            {writable && (
              <>
                {operations || context.mode !== "managed" ? (
                  <>
                    {item("intake", "Screening inbox", "service")}
                    {item("files", "Review queue", "file")}
                    {item("exceptions", "Cases", "info")}
                  </>
                ) : (
                  item("files", "Driver files", "file")
                )}
                {item(
                  "correspondence",
                  operations ? "Client requests" : "Requests",
                  "message",
                )}
                {item("approvals", "Decisions", "check")}
              </>
            )}
            {writable && !operations && context.mode === "managed" && (
              <details className="workspace-tools">
                <summary>Workspace tools</summary>
                {item("intake", "Screening inbox", "service")}
                {item("exceptions", "Service cases", "info")}
              </details>
            )}
          </>
        ) : (
          <button
            className="nav active"
            aria-current="page"
            onClick={onClients}
          >
            <Icon name="companies" />
            <span>{user.platform_role ? "Clients" : "Companies"}</span>
          </button>
        )}
        {user.platform_role && context && (
          <button
            className="nav client-directory-link"
            onClick={() => {
              onClients();
              onClose();
            }}
          >
            <Icon name="branch" />
            <span>All clients</span>
          </button>
        )}
      </nav>
      <div className="managed-sidebar-footer">
        {context && (
          <nav aria-label="Workspace administration">
            {item("summary", "Company settings", "companies")}
            {context.access?.can_correct &&
              item("requirements", "Requirements", "file")}
          </nav>
        )}
        {context && (
          <div className="sidebar-service-context">
            <span className="service-context-dot" />
            <span>
              {context.mode === "managed"
                ? "Managed service"
                : context.mode === "hybrid"
                  ? "Hybrid service"
                  : context.mode === "self_service"
                    ? "Self-service"
                    : "Client workspace"}
            </span>
          </div>
        )}
        <span className="managed-environment">Local · Synthetic data</span>
      </div>
    </>
  );
  return mobile ? (
    <dialog
      ref={dialog}
      id="workspace-navigation"
      className="managed-sidebar mobile-navigation"
      aria-label="Workspace navigation"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {body}
    </dialog>
  ) : (
    <aside id="workspace-navigation" className="sidebar managed-sidebar">
      {body}
    </aside>
  );
}

export function ProductHeader({
  user,
  context,
  companies,
  onOpen,
  onClients,
  onLogout,
  onAddDriver,
  onMenu,
}: {
  user: User;
  context: NavigationContext | null;
  companies: Company[];
  onOpen: (
    company: string,
    view?: string,
    driver?: string,
    source?: string,
  ) => void;
  onClients: () => void;
  onLogout: () => void;
  onAddDriver?: () => void;
  onMenu: () => void;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Driver[] | null>(null),
    [searchError, setSearchError] = useState(""),
    [searching, setSearching] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k" &&
        context?.access
      ) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [context?.id, !!context?.access]);
  useEffect(() => {
    setQuery("");
    setResults(null);
    setSearchError("");
  }, [context?.id]);
  useEffect(() => {
    let active = true;
    setResults(null);
    setSearchError("");
    if (!query.trim() || !context?.access) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void api<{ items: Driver[] }>(
        "/tenants/" + context.id + "/drivers/search",
        { q: query.trim(), limit: 8 },
      )
        .then((value) => {
          if (active) setResults(value.items);
        })
        .catch((error) => {
          if (active) setSearchError(error.message);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, context?.id, !!context?.access]);
  const profileRole =
    context?.access?.role || user.platform_role || "Company member";
  return (
    <header className="product-header">
      <div className="header-context">
        <button
          id="navigation-toggle"
          className="chrome-icon-button navigation-toggle"
          aria-label="Open navigation"
          aria-controls="workspace-navigation"
          onClick={onMenu}
        >
          <span aria-hidden="true">☰</span>
        </button>
        {context ? (
          <label className="client-switcher">
            <span className="sr-only">Current company</span>
            <IdentityMark value={context.name} organization />
            <select
              aria-label="Current company"
              value={context.id}
              onChange={(event) => onOpen(event.target.value, "home")}
            >
              {!companies.some((company) => company.id === context.id) && (
                <option value={context.id}>{context.name}</option>
              )}
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.display_name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <button className="quiet header-directory" onClick={onClients}>
            {user.platform_role ? "Client directory" : "Your companies"}
          </button>
        )}
      </div>
      {context?.access && (
        <div className="workspace-search">
          <form role="search" onSubmit={(event) => event.preventDefault()}>
            <Icon name="search" size={16} />
            <input
              ref={input}
              type="search"
              aria-label="Find a driver"
              placeholder="Find a driver…"
              value={query}
              aria-controls={
                query.trim() ? "workspace-search-results" : undefined
              }
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setQuery("");
                  setResults(null);
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  document
                    .querySelector<HTMLButtonElement>(
                      "#workspace-search-results button",
                    )
                    ?.focus();
                }
              }}
            />
            <kbd>Ctrl K</kbd>
          </form>
          {query.trim() && (
            <div
              id="workspace-search-results"
              className="workspace-search-results"
            >
              <span className="search-scope">Drivers in {context.name}</span>
              {searching && <p role="status">Searching…</p>}
              {searchError && <p role="alert">{searchError}</p>}
              {results?.length === 0 && <p>No matching drivers.</p>}
              {results?.map((driver) => (
                <button
                  key={driver.id}
                  onClick={() => {
                    onOpen(context.id, "drivers", driver.id, "");
                    setQuery("");
                  }}
                >
                  <IdentityMark
                    value={driver.first_name + " " + driver.last_name}
                  />
                  <span>
                    <strong>
                      {driver.first_name} {driver.last_name}
                    </strong>
                    <small>{driver.reference}</small>
                  </span>
                  <Icon name="arrow" size={14} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="header-actions">
        {context && context.status !== "active" && (
          <details
            key={context.id + context.status}
            className="account-status"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}
          >
            <summary aria-label={`Account status: ${label(context.status)}`}>
              <Icon name="clock" size={16} />
              <span>{label(context.status)}</span>
            </summary>
            <div className="account-status-popover">
              <div className="account-status-heading">
                <strong>Account setup</strong>
                <button
                  className="chrome-icon-button"
                  aria-label="Close account status"
                  onClick={(event) => {
                    const disclosure = event.currentTarget.closest("details");
                    if (disclosure) {
                      disclosure.open = false;
                      disclosure.querySelector("summary")?.focus();
                    }
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              <span
                className="account-status-label"
                data-state={context.status}
              >
                {label(context.status)}
              </span>
              <p>
                {context.status === "draft"
                  ? user.platform_role === "service_admin"
                    ? "Review this company's configuration and activation requirements in company settings."
                    : "Your service administrator handles configuration and activation. No activation action is required from you here."
                  : "View company settings for the recorded account state and available actions."}
              </p>
              {context.activationPrerequisites &&
                context.activationPrerequisites.length > 0 && (
                  <ul className="activation-blockers">
                    {context.activationPrerequisites.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              <button
                className="secondary"
                onClick={(event) => {
                  const disclosure = event.currentTarget.closest("details");
                  if (disclosure) disclosure.open = false;
                  onOpen(context.id, "summary");
                }}
              >
                View account
                <Icon name="arrow" size={14} />
              </button>
            </div>
          </details>
        )}
        {context?.access?.can_write && (
          <>
            <button
              className="chrome-icon-button header-requests"
              aria-label="Open requests"
              onClick={() => onOpen(context.id, "correspondence")}
            >
              <Icon name="message" size={18} />
            </button>
            {onAddDriver && (
              <button className="header-primary" onClick={onAddDriver}>
                <span aria-hidden="true">+</span>Add driver
              </button>
            )}
          </>
        )}
        <details
          className="account-menu header-account"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary>
            <span className="sr-only">Account</span>
            <IdentityMark value={user.email} />
            <span className="header-user-caption">
              <strong>{user.email.split("@")[0]}</strong>
              <small>{label(profileRole)}</small>
            </span>
            <span className="account-caret" aria-hidden="true">
              ⌄
            </span>
          </summary>
          <div className="account-popover">
            <span>Signed in as</span>
            <strong>{user.email}</strong>
            <small>{label(profileRole)}</small>
            <button className="account-logout secondary" onClick={onLogout}>
              <Icon name="logout" size={16} />
              Sign out
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}
