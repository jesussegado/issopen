import type { CaptureSubmission } from "../../../../../src/shared/capture-contract";
import type { Draft, ReviewedEvidence } from "../../../lib/draft";
import type { TicketRequest } from "../../../lib/tickets";

export type Project = { id: string; name: string };
export type Epic = { id: string; number: number; title: string };
export type CreatedTicket = {
  id: string;
  number: number;
  title: string;
  url: string;
  attachmentCount: number;
};

export const initialComposerForm: Draft["form"] = {
  projectId: "",
  epicId: "",
  title: "",
  description: "",
  priority: "medium",
  status: "backlog",
};

export type ComposerDraftState = {
  owner: string | null;
  identity: string | null;
  form: Draft["form"];
  evidence: ReviewedEvidence | null;
  pending: CaptureSubmission | null;
  inline: TicketRequest | null;
};
