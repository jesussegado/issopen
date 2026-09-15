import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CollaboratorsPage } from "../../shared/profile-contract.js";
import {
  AppLink,
  Badge,
  Button,
  Field,
  PageHeading,
  Skeleton,
  StatusBanner,
  TextInput,
} from "../components/ui.js";
import { apiRequest, unavailable } from "../lib/api.js";
import { subscribeToProjectChanges } from "../lib/project-live.js";

export function CollaboratorsRoute({ projectId }: { projectId: string }) {
  const [data, setData] = useState<CollaboratorsPage | null>(null),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0);
  const latest = useRef({ busy, query });
  latest.current = { busy, query };
  const load = useCallback(
    async (q: string, cursor?: string, signal?: AbortSignal) => {
      const request = ++generation.current;
      setBusy(true);
      setError("");
      if (!cursor) setData(null);
      try {
        const params = new URLSearchParams({
          q,
          limit: "25",
          ...(cursor ? { cursor } : {}),
        });
        const page = await apiRequest<CollaboratorsPage>(
          `/api/v1/projects/${projectId}/collaborators?${params}`,
          { cache: "no-store", signal: signal ?? null },
        );
        if (request !== generation.current || signal?.aborted) return;
        setData((previous) => ({
          ...page,
          collaborators: cursor
            ? [
                ...(previous?.collaborators ?? []),
                ...page.collaborators,
              ].filter(
                (person, index, all) =>
                  all.findIndex((other) => other.id === person.id) === index,
              )
            : page.collaborators,
        }));
        setQuery(q);
      } catch (caught) {
        if (request !== generation.current || signal?.aborted) return;
        if (unavailable(caught)) setData(null);
        setError(
          unavailable(caught)
            ? "This project's collaborators are no longer available to you."
            : "Couldn't load collaborators. Retry this search.",
        );
      } finally {
        if (request === generation.current && !signal?.aborted) setBusy(false);
      }
    },
    [projectId],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load("", undefined, controller.signal);
    return () => {
      generation.current++;
      controller.abort();
    };
  }, [load]);
  useEffect(
    () =>
      subscribeToProjectChanges(
        projectId,
        () => {
          if (!latest.current.busy) void load(latest.current.query);
        },
        () => {
          generation.current++;
          setData(null);
          setBusy(false);
          setError(
            "This project's collaborators are no longer available to you.",
          );
        },
      ),
    [projectId, load],
  );
  return (
    <div className="reading-column form-stack">
      <PageHeading>Project collaborators</PageHeading>
      <AppLink href={`/projects/${projectId}`}>Back to board</AppLink>
      <p>
        Only people who currently share this project are listed. Emails and
        login providers stay private. This directory does not grant access.
      </p>
      <form
        className="form-stack"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void load(search.trim());
        }}
      >
        <Field label="Search collaborators" htmlFor="collaborator-search">
          <TextInput
            id="collaborator-search"
            value={search}
            maxLength={80}
            disabled={busy}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <Button type="submit" disabled={busy}>
          Search collaborators
        </Button>
      </form>
      {error ? <StatusBanner error>{error}</StatusBanner> : null}
      {busy && !data ? <Skeleton label="Loading collaborators…" /> : null}
      {data ? (
        <>
          <ul className="access-list">
            {data.collaborators.map((person) => (
              <li className="access-list-item" key={person.id}>
                {person.avatarUrl ? (
                  <img
                    className="collaborator-avatar"
                    src={person.avatarUrl}
                    alt=""
                  />
                ) : null}
                <span className="collaborator-name">{person.name}</span>
                <Badge>
                  {person.role === "owner" ? "Owner" : "Member"} ·{" "}
                  {person.permission === "read" ? "read only" : "edit"}
                </Badge>
              </li>
            ))}
          </ul>
          {!data.collaborators.length ? (
            <p>No matching collaborators.</p>
          ) : null}
          {data.nextCursor ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void load(query, data.nextCursor ?? undefined)}
            >
              Load more collaborators
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
