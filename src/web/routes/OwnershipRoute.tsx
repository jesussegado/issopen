import { useCallback, useEffect, useRef, useState } from "react";
import { Button, PageHeading, StatusBanner } from "../components/ui.js";
import { apiRequest } from "../lib/api.js";
import { selectedWorkspace } from "../lib/workspace-context.js";

type Person = {
  id: string;
  name: string;
  membershipVersion: string;
  eligible: boolean;
  reason: string | null;
};
type Transfer = {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromName: string;
  toName: string;
  version: string;
  status: string;
  expiresAt: string;
};
type Snapshot = {
  workspaceName: string;
  workspaceVersion: number;
  canPropose: boolean;
  userId: string;
  freshUntil: string | null;
  transfers: Transfer[];
};
const endpoint = "/api/v1/workspace/ownership";

export function OwnershipRoute({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [people, setPeople] = useState<Person[]>([]),
    [query, setQuery] = useState(""),
    [after, setAfter] = useState<string | null>(null);
  const [person, setPerson] = useState<Person | null>(null),
    [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const generation = useRef(0),
    proposal = useRef<{ payload: string; id: string } | null>(null);
  const mounted = useRef(true);
  const current = () => mounted.current && selectedWorkspace() === workspaceId;
  const load = useCallback(async () => {
    const version = ++generation.current;
    try {
      const snapshot = await apiRequest<Snapshot>(endpoint, {
        cache: "no-store",
        headers: { "X-Issopen-Workspace": workspaceId },
      });
      if (
        mounted.current &&
        version === generation.current &&
        selectedWorkspace() === workspaceId
      ) {
        setData(snapshot);
        setError("");
      }
    } catch (e) {
      if (mounted.current && version === generation.current) {
        setData(null);
        setPeople([]);
        setPerson(null);
        setError(
          e instanceof Error ? e.message : "Ownership could not be loaded.",
        );
      }
    }
  }, [workspaceId]);
  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      generation.current++;
      clearInterval(timer);
    };
  }, [load]);
  async function search(cursor?: string) {
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{
        people: Person[];
        nextAfter: string | null;
      }>(
        `${endpoint}/people?${new URLSearchParams({ q: query, ...(cursor ? { after: cursor } : {}) })}`,
        { cache: "no-store" },
      );
      if (current()) {
        setPeople(result.people);
        setAfter(result.nextAfter);
      }
    } catch (e) {
      if (current()) {
        setPeople([]);
        setAfter(null);
        setError(
          e instanceof Error ? e.message : "People could not be loaded.",
        );
      }
    } finally {
      if (current()) setBusy(false);
    }
  }
  async function act(
    kind: "propose" | "accept" | "cancel",
    transfer?: Transfer,
  ) {
    if (!data) return;
    setBusy(true);
    setError("");
    setNotice("");
    let path = endpoint;
    let body: unknown;
    if (kind === "propose" && person) {
      const input = {
        recipientId: person.id,
        recipientMembershipVersion: person.membershipVersion,
        expectedWorkspaceVersion: data.workspaceVersion,
        confirmation,
      };
      const payload = JSON.stringify(input);
      if (proposal.current?.payload !== payload)
        proposal.current = { payload, id: crypto.randomUUID() };
      body = { ...input, clientRequestId: proposal.current.id };
    } else if (transfer) {
      path += `/${transfer.id}/${kind}`;
      body = {
        expectedVersion: transfer.version,
        ...(kind === "accept" ? { confirmation } : {}),
      };
    } else {
      setBusy(false);
      return;
    }
    try {
      await apiRequest(path, { method: "POST", body: JSON.stringify(body) });
      if (!current()) return;
      setConfirmation("");
      setPerson(null);
      setPeople([]);
      proposal.current = null;
      if (kind === "accept") {
        window.location.reload();
        return;
      }
      setNotice(
        kind === "propose"
          ? "Proposal sent. Keep this session open and ask the recipient to open Workspace ownership in this workspace before it expires."
          : "Proposal cancelled. Ownership has not changed.",
      );
      await load();
    } catch (e) {
      if (current())
        setError(
          `${e instanceof Error ? e.message : "The request could not be confirmed."} Your confirmation was kept. Refresh status before retrying an acceptance; never assume it failed.`,
        );
    } finally {
      if (current()) setBusy(false);
    }
  }
  const fresh = !!data?.freshUntil && new Date(data.freshUntil).getTime() > now;
  const pending = data?.transfers.find(
    (t) => t.status === "pending" && new Date(t.expiresAt).getTime() > now,
  );
  return (
    <div className="page-stack account-page">
      <PageHeading>Workspace ownership</PageHeading>
      {error && <StatusBanner error>{error}</StatusBanner>}
      {notice && <StatusBanner>{notice}</StatusBanner>}
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => {
          setNotice("");
          setConfirmation("");
          setPerson(null);
          setPeople([]);
          proposal.current = null;
          void load();
        }}
      >
        Refresh status
      </Button>
      {data && (
        <>
          <section className="detail-panel form-stack">
            <h2>{data.workspaceName}</h2>
            <p>
              The current Owner proposes and the selected verified Member
              accepts. Both must sign in within the last 5 minutes and type the
              workspace name. The Owner must keep the proposing session open.
            </p>
            <p>
              The previous Owner becomes a Member with edit access to current
              projects, without administration or automatic access to future
              projects. Existing tickets, history and agent permissions are
              preserved.
            </p>
            <StatusBanner error={!fresh}>
              {fresh
                ? "Recent login confirmed. You can confirm a transfer until " +
                  new Date(data.freshUntil ?? "").toLocaleTimeString()
                : "A recent login is required. Sign out using the account menu, sign in again, then return here. Refreshing the page or accepting an invitation does not count. Google may reuse your existing Google session; this is not a forced password or MFA challenge."}
            </StatusBanner>
            <p>
              Only one owned workspace per person is supported. A Member who
              already owns another workspace cannot receive this one.
            </p>
          </section>
          {data.canPropose && !pending && (
            <section className="detail-panel form-stack">
              <h2>Propose a new Owner</h2>
              <label className="field">
                Find a verified Member
                <input
                  value={query}
                  maxLength={80}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPeople([]);
                    setAfter(null);
                  }}
                />
              </label>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void search()}
              >
                Find members
              </Button>
              <ul className="form-stack">
                {people.map((p) => (
                  <li key={p.id}>
                    <Button
                      variant="secondary"
                      disabled={busy || !p.eligible}
                      onClick={() => {
                        setPerson(p);
                        setConfirmation("");
                      }}
                    >
                      {p.name}
                      {p.reason ? ` · ${p.reason}` : ""}
                    </Button>
                  </li>
                ))}
              </ul>
              {after && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void search(after)}
                >
                  More members
                </Button>
              )}
              {person && (
                <>
                  <p>
                    Selected recipient: <strong>{person.name}</strong>
                  </p>
                  <label className="field">
                    Type workspace name to propose
                    <input
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <Button
                    disabled={
                      busy || !fresh || confirmation !== data.workspaceName
                    }
                    onClick={() => void act("propose")}
                  >
                    Confirm proposal
                  </Button>
                </>
              )}
            </section>
          )}
          <section className="detail-panel form-stack">
            <h2>Recent transfers</h2>
            {!data.transfers.length && <p>No transfers yet.</p>}
            {data.transfers.map((t) => {
              const active =
                t.status === "pending" && new Date(t.expiresAt).getTime() > now;
              return (
                <article className="form-stack" key={t.id}>
                  <h3>
                    {t.fromName} → {t.toName}
                  </h3>
                  <p>
                    Status:{" "}
                    {t.status === "pending" && !active ? "expired" : t.status} ·
                    Expires {new Date(t.expiresAt).toLocaleString()}
                  </p>
                  {active && t.toUserId === data.userId && (
                    <>
                      <label className="field">
                        Type workspace name to accept
                        <input
                          value={confirmation}
                          onChange={(e) => setConfirmation(e.target.value)}
                          autoComplete="off"
                        />
                      </label>
                      <Button
                        disabled={
                          busy || !fresh || confirmation !== data.workspaceName
                        }
                        onClick={() => void act("accept", t)}
                      >
                        Accept ownership
                      </Button>
                    </>
                  )}
                  {active && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void act("cancel", t)}
                    >
                      Cancel proposal
                    </Button>
                  )}
                </article>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
