import type { BoardColumn } from "../../lib/board-model.js";
import { navigate } from "../../lib/navigation.js";
import type { Epic, IssueStatus, Project } from "../../types.js";
import { epicLabel, statusLabels } from "../../types.js";
import { CollaboratorPicker } from "../CollaboratorPicker.js";
import { Select } from "../ui.js";

export type BoardWarningFilter = "all" | "warnings" | "for_me";

export function BoardToolbar({
  project,
  columns,
  epics,
  status,
  epic,
  warning,
  assigneeMode,
  selectedPerson,
  onStatusChange,
  onWarningChange,
  onAssigneeModeChange,
  onPersonChange,
}: {
  project: Project;
  columns: BoardColumn[];
  epics: Epic[];
  status: "all" | IssueStatus;
  epic: string;
  warning: BoardWarningFilter;
  assigneeMode: string;
  selectedPerson: { id: string; name: string } | null;
  onStatusChange: (status: "all" | IssueStatus) => void;
  onWarningChange: (filter: BoardWarningFilter) => void;
  onAssigneeModeChange: (mode: string) => void;
  onPersonChange: (person: { id: string; name: string }) => void;
}) {
  return (
    <>
      <section
        className="board-toolbar"
        aria-labelledby="board-filters-heading"
      >
        <div className="board-toolbar-heading">
          <h2 id="board-filters-heading">Filter tickets</h2>
          <p className="metadata">
            Narrow the board without changing ticket status.
          </p>
        </div>
        <label
          className="field board-filter board-filter-status"
          htmlFor="status-filter"
        >
          <span>Show status</span>
          <Select
            id="status-filter"
            value={status}
            onChange={(event) =>
              onStatusChange(event.currentTarget.value as "all" | IssueStatus)
            }
          >
            <option value="all">All statuses</option>
            {columns.map((column) => (
              <option key={column.status} value={column.status}>
                {statusLabels[column.status]}
              </option>
            ))}
          </Select>
        </label>
        <label
          className="field board-filter board-filter-epic"
          htmlFor="epic-filter"
        >
          <span>Show Epic</span>
          <Select
            id="epic-filter"
            value={epic}
            onChange={(event) => {
              const value = event.currentTarget.value;
              navigate(
                value === "all"
                  ? `/projects/${project.id}`
                  : `/projects/${project.id}?epic=${encodeURIComponent(value)}`,
              );
            }}
          >
            <option value="all">All Epics</option>
            <option value="unassigned">No Epic</option>
            {epics.map((item) => (
              <option key={item.id} value={item.id}>
                {epicLabel(item)}
              </option>
            ))}
          </Select>
        </label>
        <label
          className="field board-filter board-filter-questions"
          htmlFor="warning-filter"
        >
          <span>Show questions</span>
          <Select
            id="warning-filter"
            value={warning}
            onChange={(event) =>
              onWarningChange(event.currentTarget.value as BoardWarningFilter)
            }
          >
            <option value="all">All tickets</option>
            <option value="warnings">Warnings only</option>
            <option value="for_me">Questions for me</option>
          </Select>
        </label>
        <label
          className="field board-filter board-filter-assignee"
          htmlFor="assignee-filter"
        >
          <span>Human assignee</span>
          <Select
            id="assignee-filter"
            value={assigneeMode}
            onChange={(event) =>
              onAssigneeModeChange(event.currentTarget.value)
            }
          >
            <option value="all">All people</option>
            <option value="mine">My tickets</option>
            <option value="unassigned">Unassigned</option>
            <option value="person">Choose a person</option>
          </Select>
        </label>
      </section>
      {assigneeMode === "person" ? (
        <section className="detail-panel" aria-label="Filter by person">
          <p>
            {selectedPerson
              ? `Showing tickets for ${selectedPerson.name}`
              : "Choose a person below. All people are shown until you select someone."}
          </p>
          <CollaboratorPicker
            key={project.id}
            projectId={project.id}
            onChoose={onPersonChange}
          />
        </section>
      ) : null}
    </>
  );
}
