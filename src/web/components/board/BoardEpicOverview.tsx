import type { Epic } from "../../types.js";
import { epicLabel } from "../../types.js";
import { AppLink, Badge } from "../ui.js";

export function BoardEpicOverview({ epics }: { epics: Epic[] }) {
  return (
    <section className="project-epics" aria-labelledby="project-epics-heading">
      <div className="project-epics-header">
        <h2 id="project-epics-heading">Epics</h2>
        <Badge>{epics.length}</Badge>
      </div>
      {epics.length === 0 ? (
        <p className="metadata">No Epics yet.</p>
      ) : (
        <ul className="project-epic-list">
          {epics.map((epic) => {
            const { doneIssues, totalIssues } = epic.summary;
            return (
              <li className="project-epic-card" key={epic.id}>
                <div className="project-epic-title-row">
                  <AppLink
                    className="epic-card-title"
                    href={`/epics/${epic.id}`}
                  >
                    {epicLabel(epic)}
                  </AppLink>
                  <Badge>
                    {totalIssues} {totalIssues === 1 ? "ticket" : "tickets"}
                  </Badge>
                </div>
                <div className="epic-progress">
                  <div className="epic-progress-label">
                    <span>
                      {doneIssues}/{totalIssues} done
                    </span>
                    <span>
                      {totalIssues === 0
                        ? 0
                        : Math.round((doneIssues / totalIssues) * 100)}
                      %
                    </span>
                  </div>
                  <progress
                    max={Math.max(totalIssues, 1)}
                    value={doneIssues}
                    aria-label={`${epicLabel(epic)}: ${doneIssues} of ${totalIssues} tickets done`}
                  />
                </div>
                <AppLink
                  className="button button-secondary epic-board-link"
                  href={`/projects/${epic.projectId}?epic=${epic.id}`}
                  aria-label={`View tickets for ${epicLabel(epic)}`}
                >
                  View tickets
                </AppLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
