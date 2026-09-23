import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiRequest } from "../lib/api.js";
import {
  rememberWorkspace,
  switchWorkspace,
} from "../lib/workspace-context.js";
import type { Project, Session } from "../types.js";
import { Brand } from "./Brand.js";
import { NotificationLink } from "./NotificationLink.js";
import { AppLink, Button } from "./ui.js";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <Brand />
      </header>
      <main id="main-content" className="centered-page">
        <section className="page-panel">{children}</section>
      </main>
      <footer className="public-footer">
        <AppLink href="/agent-onboarding">Agentes y MCP</AppLink>
        <AppLink href="/chrome">Extensión Chrome</AppLink>
        <AppLink href="/support">Soporte</AppLink>
        <AppLink href="/privacy">Privacidad y datos</AppLink>
        <a href="mailto:serviciosegado@gmail.com">Contacto</a>
      </footer>
    </div>
  );
}

function MobileNavigation({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    navigation.current?.addEventListener("keydown", closeOnEscape);
    return () =>
      navigation.current?.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <Button
        ref={trigger}
        type="button"
        variant="secondary"
        className="mobile-menu-trigger"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close" : "Menu"}
      </Button>
      <div
        ref={navigation}
        className={`mobile-navigation${open ? " open" : ""}`}
      >
        {children}
      </div>
    </>
  );
}

function Navigation({
  projects,
  pathname,
  role,
  platformAdmin,
}: {
  projects: Project[];
  pathname: string;
  role: "owner" | "member";
  platformAdmin: boolean;
}) {
  const link = (href: string, label: string) => (
    <AppLink
      key={href}
      className="nav-link"
      href={href}
      aria-current={pathname === href ? "page" : undefined}
    >
      {label}
    </AppLink>
  );
  return (
    <nav aria-label="Workspace">
      <p className="nav-heading">Projects</p>
      {projects.map((project) => link(`/projects/${project.id}`, project.name))}
      {role === "owner" ? link("/projects/new", "Create project") : null}
      <div className="nav-divider" />
      {role === "owner" ? link("/agents", "Agents") : null}
      {role === "owner" ? link("/members", "Members") : null}
      {platformAdmin ? link("/owners", "Owner workspaces") : null}
      {role === "owner" ? link("/audit", "Access audit") : null}
      {link("/ownership", "Workspace ownership")}
      {role === "owner" ? link("/connect", "Connect ChatGPT") : null}
      {link("/extensions", "Extensiones Chrome")}
      {link("/privacy", "Privacy and data")}
      <a className="nav-link" href="/agent-onboarding#agent-start">
        Inicio rápido MCP
      </a>
      <a className="nav-link" href="/agent-onboarding#agent-machine">
        Documentación MCP
      </a>
    </nav>
  );
}

export function AuthenticatedShell({
  session,
  projects,
  pathname,
  onSignedOut,
  children,
}: {
  session: Session & { workspace: NonNullable<Session["workspace"]> };
  projects: Project[];
  pathname: string;
  onSignedOut: () => void;
  children: ReactNode;
}) {
  const [desktopNavigationOpen, setDesktopNavigationOpen] = useState(true);
  const [authenticatedHeaderHeight, setAuthenticatedHeaderHeight] =
    useState(64);
  const authenticatedHeader = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = authenticatedHeader.current;
    if (!header) return;
    const updateHeight = () => {
      const measured = Math.ceil(header.getBoundingClientRect().height);
      if (measured > 0) setAuthenticatedHeaderHeight(measured);
    };
    updateHeight();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateHeight);
    observer?.observe(header);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  async function signOut() {
    await apiRequest<Record<string, never>>("/api/auth/sign-out", {
      method: "POST",
      body: JSON.stringify({}),
    });
    rememberWorkspace(null);
    onSignedOut();
  }

  const navigation = (
    <Navigation
      projects={projects}
      pathname={pathname}
      role={session.workspace.role}
      platformAdmin={session.platformAdmin === true}
    />
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header
        ref={authenticatedHeader}
        className="app-header authenticated-header"
      >
        <Brand />
        <span className="workspace-name">{session.workspace.name}</span>
        {(session.workspaces?.length ?? 0) > 1 && (
          <label className="workspace-switcher">
            <span className="sr-only">Workspace</span>
            <select
              aria-label="Workspace"
              value={session.workspace.id}
              onChange={(event) => {
                const id = event.target.value;
                if (
                  id !== session.workspace.id &&
                  window.confirm(
                    "Switch workspace? Unsaved drafts on this page will be discarded. Other tabs and Chrome installations keep their current workspace.",
                  )
                )
                  switchWorkspace(id);
              }}
            >
              {session.workspaces?.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {entry.role}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="metadata">
          {session.workspace.role === "owner" ? "Owner" : "Member"}
        </span>
        <NotificationLink
          workspaceId={session.workspace.id}
          key={`${session.workspace.id}:${session.user.id}`}
        />
        <Button
          type="button"
          variant="secondary"
          className="desktop-menu-trigger"
          aria-label={
            desktopNavigationOpen
              ? "Hide desktop navigation"
              : "Show desktop navigation"
          }
          aria-expanded={desktopNavigationOpen}
          aria-controls="workspace-sidebar"
          onClick={() => setDesktopNavigationOpen((current) => !current)}
        >
          Menu
        </Button>
        <MobileNavigation
          key={`${session.user.id}:${session.workspace.id}:${pathname}`}
        >
          {navigation}
        </MobileNavigation>
        <details className="owner-menu">
          <summary>{session.user.name}</summary>
          <div className="owner-menu-panel">
            <span className="metadata">
              Role: {session.workspace.role === "owner" ? "Owner" : "Member"}
            </span>
            <AppLink href="/account">Account</AppLink>
            {session.workspace.role === "owner" ? (
              <AppLink href="/workspace">Workspace settings</AppLink>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
          </div>
        </details>
      </header>
      <div
        className={`authenticated-layout${desktopNavigationOpen ? "" : " sidebar-collapsed"}`}
        style={
          {
            "--authenticated-header-height": `${authenticatedHeaderHeight}px`,
          } as CSSProperties
        }
      >
        <aside
          id="workspace-sidebar"
          className={`sidebar${desktopNavigationOpen ? "" : " sidebar-hidden"}`}
        >
          {navigation}
        </aside>
        <main id="main-content" className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
