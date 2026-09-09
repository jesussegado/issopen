import { z } from "zod";
import {
  captureMetadataSchema,
  captureSubmissionSchema,
  pngDataUrlSchema,
} from "../../../src/shared/capture-contract";
import { ticketRequestSchema } from "./tickets";
export const reviewedEvidenceSchema = z
  .object({
    image: pngDataUrlSchema.nullable(),
    metadata: captureMetadataSchema.nullable(),
  })
  .strict();
export type ReviewedEvidence = z.infer<typeof reviewedEvidenceSchema>;
export const draftSchema = z
  .object({
    version: z.literal(1),
    expiresAt: z.number(),
    owner: z.string().nullable(),
    form: z
      .object({
        projectId: z.union([z.uuid(), z.literal("")]),
        epicId: z.union([z.uuid(), z.literal("")]),
        title: z.string().max(240),
        description: z.string().max(50000),
        priority: captureSubmissionSchema.shape.priority,
        status: captureSubmissionSchema.shape.status,
      })
      .strict(),
    evidence: reviewedEvidenceSchema.nullable(),
    pending: captureSubmissionSchema.nullable(),
    inline: ticketRequestSchema.nullable(),
  })
  .strict();
export type Draft = z.infer<typeof draftSchema>;
export const draftLifetime = 24 * 60 * 60 * 1000;
export function validDraft(value: unknown, now = Date.now()): Draft | null {
  const result = draftSchema.safeParse(value);
  return result.success &&
    result.data.expiresAt > now &&
    result.data.expiresAt <= now + draftLifetime + 1000
    ? result.data
    : null;
}
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("issopen-reviewed-draft-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("draft");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Draft unavailable"));
  });
}
async function access<T>(
  mode: IDBTransactionMode,
  operation: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("draft", mode);
    const request = operation(tx.objectStore("draft"));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(new Error("Draft unavailable"));
    };
  });
}
export async function loadDraft() {
  const raw = await access("readonly", (s) => s.get("current"));
  const draft = validDraft(raw);
  if (!draft && raw) await clearDraft();
  return draft;
}
export async function saveDraft(draft: Draft) {
  const validated = draftSchema.parse(draft);
  await access("readwrite", (s) => s.put(validated, "current"));
}
export async function clearDraft() {
  await access("readwrite", (s) => s.delete("current"));
}
