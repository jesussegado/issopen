import type { Project } from "../../types.js";

export function RepositoryPanel({ project }: { project: Project }) {
  return (
    <section className="detail-panel" aria-labelledby="repository-heading">
      <h2 id="repository-heading">Repository context</h2>
      {project.repositoryUrl ? (
        <p className="mono">{project.repositoryUrl}</p>
      ) : (
        <p className="metadata">No repository context</p>
      )}
      {project.defaultBranch ? (
        <p>
          <strong>Default branch:</strong>{" "}
          <span className="mono">{project.defaultBranch}</span>
        </p>
      ) : null}
      {project.repositorySubdirectory ? (
        <p>
          <strong>Subdirectory:</strong>{" "}
          <span className="mono">{project.repositorySubdirectory}</span>
        </p>
      ) : null}
      <p className="metadata">
        Issopen stores this context but does not access the repository.
      </p>
    </section>
  );
}
