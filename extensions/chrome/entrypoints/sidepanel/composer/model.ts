import type { Draft } from "../../../lib/draft";

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
