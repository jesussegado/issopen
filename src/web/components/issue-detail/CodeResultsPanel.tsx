import type { FormEvent } from "react";
import type { CodeLink, CodeLinkType } from "../../types.js";
import { codeLinkLabels, codeLinkTypes } from "../../types.js";
import { Badge, Button, Field, Select, TextInput } from "../ui.js";

export function CodeResultsPanel({
  links,
  linkType,
  linkUrl,
  canEdit,
  online,
  submitting,
  onTypeChange,
  onUrlChange,
  onSubmit,
}: {
  links: CodeLink[];
  linkType: CodeLinkType;
  linkUrl: string;
  canEdit: boolean;
  online: boolean;
  submitting: string | null;
  onTypeChange: (type: CodeLinkType) => void;
  onUrlChange: (url: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="detail-panel" aria-labelledby="code-results-heading">
      <h2 id="code-results-heading">Code results</h2>
      {links.length === 0 ? (
        <p>No code results linked.</p>
      ) : (
        <ul className="code-links">
          {links.map((link) => (
            <li className="code-link" key={link.id}>
              <Badge>{codeLinkLabels[link.type]}</Badge>
              <a
                className="mono"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.url}
                <span className="external-note"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <form className="form-stack" onSubmit={onSubmit}>
          <Field label="Link type" htmlFor="link-type">
            <Select
              id="link-type"
              disabled={submitting !== null}
              value={linkType}
              onChange={(event) =>
                onTypeChange(event.currentTarget.value as CodeLinkType)
              }
            >
              {codeLinkTypes.map((type) => (
                <option key={type} value={type}>
                  {codeLinkLabels[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="URL" htmlFor="link-url" required>
            <TextInput
              id="link-url"
              disabled={submitting !== null}
              className="mono"
              type="url"
              required
              maxLength={2048}
              value={linkUrl}
              onChange={(event) => onUrlChange(event.currentTarget.value)}
            />
          </Field>
          <Button type="submit" disabled={!online || submitting !== null}>
            {submitting === "link" ? "Adding…" : "Add code link"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
