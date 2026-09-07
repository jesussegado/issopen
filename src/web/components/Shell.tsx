import { type ReactNode, useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/api.js";
import type { Project, Session } from "../types.js";
import { Brand } from "./Brand.js";
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
}: {
  projects: Project[];
  pathname: string;
}) {
  const link = (href: string, label: string) => (
    <AppLink
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
      {link("/projects/new", "Create project")}
      <div className="nav-divider" />
      {link("/agents", "Agents")}
      {link("/connect", "Connect ChatGPT")}
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
  async function signOut() {
    await apiRequest<Record<string, never>>("/api/auth/sign-out", {
      method: "POST",
    });
    onSignedOut();
  }

  const navigation = <Navigation projects={projects} pathname={pathname} />;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header authenticated-header">
        <Brand />
        <span className="workspace-name">{session.workspace.name}</span>
        <MobileNavigation>{navigation}</MobileNavigation>
        <details className="owner-menu">
          <summary>{session.user.name}</summary>
          <div className="owner-menu-panel">
            <AppLink href="/workspace">Workspace settings</AppLink>
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
      <div className="authenticated-layout">
        <aside className="sidebar">{navigation}</aside>
        <main id="main-content" className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
