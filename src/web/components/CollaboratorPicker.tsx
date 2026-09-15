import { useEffect, useRef, useState } from "react";
import type {
  Collaborator,
  CollaboratorsPage,
} from "../../shared/profile-contract.js";
import { apiRequest } from "../lib/api.js";

export function CollaboratorPicker({
  projectId,
  onChoose,
  disabled = false,
  requireEdit = false,
}: {
  projectId: string;
  onChoose: (person: Collaborator) => void;
  disabled?: boolean;
  requireEdit?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<CollaboratorsPage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const latestProject = useRef(projectId);
  latestProject.current = projectId;
  useEffect(() => {
    latestProject.current = projectId;
    generation.current += 1;
    setQuery("");
    setPage(null);
    setError("");
    setBusy(false);
    return () => {
      generation.current += 1;
    };
  }, [projectId]);
  async function search(cursor?: string) {
    const request = ++generation.current;
    setBusy(true);
    setError("");
    if (!cursor) setPage(null);
    try {
      const params = new URLSearchParams({ q: query, limit: "10" });
      if (cursor) params.set("cursor", cursor);
      const data = await apiRequest<CollaboratorsPage>(
        `/api/v1/projects/${projectId}/collaborators?${params}`,
      );
      if (request !== generation.current || projectId !== latestProject.current)
        return;
      setPage(data);
    } catch {
      if (request === generation.current) {
        setPage(null);
        setError("Could not load collaborators. Check access and try again.");
      }
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  return (
    <div className="form-stack">
      <label className="field">
        Search people in this project
        <input
          value={query}
          maxLength={80}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!busy && !disabled) void search();
            }
          }}
          disabled={disabled || busy}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            setPage(null);
          }}
        />
      </label>
      <button
        type="button"
        className="button button-secondary"
        disabled={disabled || busy}
        onClick={() => void search()}
      >
        Find people
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {page ? (
        <>
          <ul className="collaborator-picker-list">
            {page.collaborators.map((person) => (
              <li key={person.id}>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={
                    disabled ||
                    busy ||
                    (requireEdit && person.permission !== "edit")
                  }
                  onClick={() => onChoose(person)}
                >
                  {person.name} · {person.role} ·{" "}
                  {person.permission === "edit" ? "Can edit" : "Read only"}
                  <span className="metadata">ID {person.id}</span>
                </button>
              </li>
            ))}
          </ul>
          {page.collaborators.length === 0 ? (
            <p role="status">No matching collaborators</p>
          ) : null}
          {page.nextCursor ? (
            <button
              type="button"
              className="button button-secondary"
              disabled={disabled || busy}
              onClick={() => void search(page.nextCursor ?? undefined)}
            >
              Next people
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
