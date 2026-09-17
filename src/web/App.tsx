import { useCallback, useEffect, useState } from "react";
import { AuthenticatedShell, PublicShell } from "./components/Shell.js";
import { Skeleton, StatusBanner } from "./components/ui.js";
import { apiRequest } from "./lib/api.js";
import { navigate, useLocation } from "./lib/navigation.js";
import {
  rememberWorkspace,
  selectedWorkspace,
  switchWorkspace,
  workspaceHeaders,
} from "./lib/workspace-context.js";
import { AccessAuditRoute } from "./routes/AccessAuditRoute.js";
import { AccountRoute } from "./routes/AccountRoute.js";
import { AgentOnboardingRoute } from "./routes/AgentOnboardingRoute.js";
import { AgentsRoute } from "./routes/AgentsRoute.js";
import { BoardRoute } from "./routes/BoardRoute.js";
import { CollaboratorsRoute } from "./routes/CollaboratorsRoute.js";
import { ConnectRoute, ConsentRoute } from "./routes/ConnectRoute.js";
import {
  EpicDetailRoute,
  EpicFormRoute,
  EpicsRoute,
} from "./routes/EpicRoutes.js";
import {
  ChromeExtensionRoute,
  SupportRoute,
} from "./routes/ExtensionPublicRoutes.js";
import { ExtensionsRoute } from "./routes/ExtensionsRoute.js";
import {
  InvitationCompleteRoute,
  InvitationLinkRoute,
  InvitationRedeemRoute,
} from "./routes/InvitationRoutes.js";
import { IssueDetailRoute } from "./routes/IssueDetailRoute.js";
import { MembersRoute } from "./routes/MembersRoute.js";
import { NotificationsRoute } from "./routes/NotificationsRoute.js";
import { OwnerInvitationsRoute } from "./routes/OwnerInvitationsRoute.js";
import { OwnershipRoute } from "./routes/OwnershipRoute.js";
import { PrivacyRoute } from "./routes/PrivacyRoute.js";
import {
  SignInRoute,
  StatusRoute,
  WorkspaceCreateRoute,
} from "./routes/PublicRoutes.js";
import {
  HomeRoute,
  IssueFormRoute,
  ProjectFormRoute,
  UnavailableRoute,
  WorkspaceSettingsRoute,
} from "./routes/TrackerForms.js";
import type { Project, Session } from "./types.js";

type Screen =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "authenticated"; session: Session }
  | { kind: "error" };

export function App() {
  const location = useLocation();
  const pathname = location.split("?")[0] ?? "/";
  const workspaceContext = selectedWorkspace();
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });

  const readSession = useCallback(async () => {
    const requestedWorkspace = selectedWorkspace();
    let response = await fetch("/api/v1/session", {
      credentials: "same-origin",
      headers: workspaceHeaders(),
    });
    if (requestedWorkspace !== selectedWorkspace()) return null;
    if (response.status === 401) {
      setScreen({ kind: "anonymous" });
      return null;
    }
    if ([400, 404].includes(response.status) && selectedWorkspace() !== null) {
      // An invalid/withdrawn context must present a choice, never silently switch.
      response = await fetch("/api/v1/session", { credentials: "same-origin" });
      if (requestedWorkspace !== selectedWorkspace()) return null;
      if (response.ok) {
        const session = (await response.json()) as Session;
        setScreen({
          kind: "authenticated",
          session: { ...session, workspace: null },
        });
        return null;
      }
    }
    if (!response.ok) {
      setScreen({ kind: "error" });
      return null;
    }
    const session = (await response.json()) as Session;
    if (session.workspace) rememberWorkspace(session.workspace.id);
    setScreen({
      kind: "authenticated",
      session,
    });
    return session;
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: browser history can change workspace without changing pathname.
  useEffect(() => {
    if (
      ![
        "/status",
        "/privacy",
        "/chrome",
        "/support",
        "/agent-onboarding",
      ].includes(pathname)
    )
      void readSession();
  }, [pathname, readSession, workspaceContext]);

  if (pathname === "/status") return <StatusRoute />;
  if (pathname === "/privacy") return <PrivacyRoute />;
  if (pathname === "/chrome") return <ChromeExtensionRoute />;
  if (pathname === "/support") return <SupportRoute />;
  if (pathname === "/agent-onboarding")
    return (
      <PublicShell>
        <AgentOnboardingRoute />
      </PublicShell>
    );
  if (screen.kind === "loading")
    return (
      <PublicShell>
        <Skeleton label="Checking your private session…" />
      </PublicShell>
    );
  if (screen.kind === "error")
    return (
      <PublicShell>
        <h1>Issopen is starting</h1>
        <StatusBanner error>
          We couldn't load Issopen. Check your connection and try again.
        </StatusBanner>
      </PublicShell>
    );
  const inviteMatch = pathname.match(/^\/invite\/([^/]+)$/);
  const ownerInviteMatch = pathname.match(/^\/owner-invite\/([^/]+)$/);
  if (ownerInviteMatch?.[1]) {
    return (
      <PublicShell>
        <InvitationRedeemRoute
          kind="owner"
          token={ownerInviteMatch[1]}
          authenticated={screen.kind === "authenticated"}
          onRedeemed={async (invitationId) => {
            await readSession();
            navigate(`/owner-invitations/${invitationId}/link`, true);
          }}
        />
      </PublicShell>
    );
  }
  if (inviteMatch?.[1]) {
    return (
      <PublicShell>
        <InvitationRedeemRoute
          token={inviteMatch[1]}
          authenticated={screen.kind === "authenticated"}
          onRedeemed={async (invitationId) => {
            await readSession();
            navigate(`/invitations/${invitationId}/link`, true);
          }}
        />
      </PublicShell>
    );
  }
  if (screen.kind === "anonymous") {
    if (pathname !== "/sign-in")
      navigate(`/sign-in?returnTo=${encodeURIComponent(location)}`, true);
    return (
      <SignInRoute
        onSignedIn={(session) => setScreen({ kind: "authenticated", session })}
      />
    );
  }
  const invitationLinkMatch = pathname.match(/^\/invitations\/([^/]+)\/link$/);
  const invitationCompleteMatch = pathname.match(
    /^\/invitations\/([^/]+)\/complete$/,
  );
  const ownerInvitationLinkMatch = pathname.match(
    /^\/owner-invitations\/([^/]+)\/link$/,
  );
  const ownerInvitationCompleteMatch = pathname.match(
    /^\/owner-invitations\/([^/]+)\/complete$/,
  );
  if (ownerInvitationLinkMatch?.[1]) {
    return (
      <PublicShell>
        <InvitationLinkRoute
          kind="owner"
          invitationId={ownerInvitationLinkMatch[1]}
          email={screen.session.user.email}
        />
      </PublicShell>
    );
  }
  if (ownerInvitationCompleteMatch?.[1]) {
    return (
      <PublicShell>
        <InvitationCompleteRoute
          kind="owner"
          invitationId={ownerInvitationCompleteMatch[1]}
          onAccepted={async (workspaceId) => {
            switchWorkspace(workspaceId);
          }}
        />
      </PublicShell>
    );
  }
  if (invitationLinkMatch?.[1]) {
    return (
      <PublicShell>
        <InvitationLinkRoute
          invitationId={invitationLinkMatch[1]}
          email={screen.session.user.email}
        />
      </PublicShell>
    );
  }
  if (invitationCompleteMatch?.[1]) {
    return (
      <PublicShell>
        <InvitationCompleteRoute
          invitationId={invitationCompleteMatch[1]}
          onAccepted={async (workspaceId) => {
            switchWorkspace(workspaceId);
          }}
        />
      </PublicShell>
    );
  }
  if (!screen.session.workspace) {
    if (screen.session.workspaces?.length)
      return (
        <PublicShell>
          <h1>Choose a workspace</h1>
          <p>
            Select where to work. No project data is shared between workspaces.
          </p>
          <ul>
            {screen.session.workspaces.map((entry) => (
              <li key={entry.id}>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => switchWorkspace(entry.id, location)}
                >
                  {entry.name} · {entry.role}
                </button>
              </li>
            ))}
          </ul>
        </PublicShell>
      );
    if (pathname !== "/workspace/new") navigate("/workspace/new", true);
    return (
      <WorkspaceCreateRoute
        onCreated={(session) => setScreen({ kind: "authenticated", session })}
      />
    );
  }
  if (
    workspaceContext !== null &&
    screen.session.workspace.id !== workspaceContext
  ) {
    return (
      <PublicShell>
        <Skeleton label="Checking workspace access…" />
      </PublicShell>
    );
  }
  return (
    <AuthenticatedApp
      key={`${screen.session.user.id}:${screen.session.workspace.id}`}
      session={
        screen.session as Session & {
          workspace: NonNullable<Session["workspace"]>;
        }
      }
      pathname={pathname}
      onSession={setScreen}
    />
  );
}

function AuthenticatedApp({
  session,
  pathname,
  onSession,
}: {
  session: Session & { workspace: NonNullable<Session["workspace"]> };
  pathname: string;
  onSession: (screen: Screen) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refreshProjects = useCallback(async () => {
    try {
      const response = await apiRequest<{ projects: Project[] }>(
        "/api/v1/projects",
      );
      setProjects(response.projects);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  let route: React.ReactNode;
  const projectMatch = pathname.match(/^\/projects\/([^/]+)$/);
  const collaboratorsMatch = pathname.match(
    /^\/projects\/([^/]+)\/collaborators$/,
  );
  const projectSettingsMatch = pathname.match(
    /^\/projects\/([^/]+)\/settings$/,
  );
  const issueCreateMatch = pathname.match(/^\/projects\/([^/]+)\/issues\/new$/);
  const epicsMatch = pathname.match(/^\/projects\/([^/]+)\/epics$/);
  const epicEditMatch = pathname.match(/^\/epics\/([^/]+)\/edit$/);
  const epicDetailMatch = pathname.match(/^\/epics\/([^/]+)$/);
  const issueEditMatch = pathname.match(/^\/issues\/([^/]+)\/edit$/);
  const issueDetailMatch = pathname.match(/^\/issues\/([^/]+)$/);
  if (loading) route = <Skeleton />;
  else if (error)
    route = (
      <StatusBanner error>
        We couldn't load your projects. Check your connection and try again.
      </StatusBanner>
    );
  else if (pathname === "/")
    route = (
      <HomeRoute
        projects={projects}
        canCreateProject={session.workspace.role === "owner"}
      />
    );
  else if (pathname === "/workspace" && session.workspace.role === "owner")
    route = (
      <WorkspaceSettingsRoute
        session={session}
        onSaved={(updated) =>
          onSession({ kind: "authenticated", session: updated })
        }
      />
    );
  else if (pathname === "/projects/new" && session.workspace.role === "owner")
    route = <ProjectFormRoute onProjectsChanged={refreshProjects} />;
  else if (pathname === "/agents" && session.workspace.role === "owner")
    route = <AgentsRoute projects={projects} />;
  else if (pathname === "/members" && session.workspace.role === "owner")
    route = <MembersRoute projects={projects} />;
  else if (pathname === "/owners" && session.platformAdmin)
    route = <OwnerInvitationsRoute />;
  else if (pathname === "/audit" && session.workspace.role === "owner")
    route = <AccessAuditRoute workspaceId={session.workspace.id} />;
  else if (pathname === "/notifications")
    route = (
      <NotificationsRoute
        workspaceId={session.workspace.id}
        key={`${session.workspace.id}:${session.user.id}`}
      />
    );
  else if (pathname === "/ownership")
    route = <OwnershipRoute workspaceId={session.workspace.id} />;
  else if (pathname === "/account")
    route = (
      <AccountRoute
        session={session}
        onProfileSaved={(name) =>
          onSession({
            kind: "authenticated",
            session: { ...session, user: { ...session.user, name } },
          })
        }
      />
    );
  else if (collaboratorsMatch?.[1])
    route = (
      <CollaboratorsRoute
        key={collaboratorsMatch[1]}
        projectId={collaboratorsMatch[1]}
      />
    );
  else if (pathname === "/connect" && session.workspace.role === "owner")
    route = <ConnectRoute />;
  else if (pathname === "/extensions") route = <ExtensionsRoute />;
  else if (pathname === "/extensions/link") route = <ExtensionsRoute linking />;
  else if (pathname === "/consent")
    route = (
      <ConsentRoute
        search={window.location.search}
        workspaceName={session.workspace.name}
      />
    );
  else if (projectSettingsMatch?.[1] && session.workspace.role === "owner")
    route = (
      <ProjectFormRoute
        projectId={projectSettingsMatch[1]}
        onProjectsChanged={refreshProjects}
      />
    );
  else if (issueCreateMatch?.[1])
    route = <IssueFormRoute projectId={issueCreateMatch[1]} />;
  else if (epicsMatch?.[1]) route = <EpicsRoute projectId={epicsMatch[1]} />;
  else if (epicEditMatch?.[1])
    route = <EpicFormRoute epicId={epicEditMatch[1]} />;
  else if (epicDetailMatch?.[1])
    route = <EpicDetailRoute epicId={epicDetailMatch[1]} />;
  else if (issueEditMatch?.[1])
    route = <IssueFormRoute issueId={issueEditMatch[1]} />;
  else if (projectMatch?.[1])
    route = (
      <BoardRoute
        projectId={projectMatch[1]}
        canManageProject={session.workspace.role === "owner"}
      />
    );
  else if (issueDetailMatch?.[1])
    route = (
      <IssueDetailRoute issueId={issueDetailMatch[1]} session={session} />
    );
  else route = <UnavailableRoute />;

  return (
    <AuthenticatedShell
      session={session}
      projects={projects}
      pathname={pathname}
      onSignedOut={() => {
        onSession({ kind: "anonymous" });
        navigate("/sign-in", true);
      }}
    >
      {route}
    </AuthenticatedShell>
  );
}
