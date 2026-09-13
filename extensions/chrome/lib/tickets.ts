import { z } from "zod";
import { captureSubmissionSchema } from "../../../src/shared/capture-contract";
import { instanceUrl } from "./instance";
export const ticketRequestSchema = z.discriminatedUnion("action", [
  z
    .object({
      type: z.literal("tickets"),
      version: z.literal(1),
      action: z.literal("epics"),
      projectId: z.uuid(),
    })
    .strict(),
  z
    .object({
      type: z.literal("tickets"),
      version: z.literal(1),
      action: z.literal("project"),
      idempotencyKey: z.uuid(),
      name: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      type: z.literal("tickets"),
      version: z.literal(1),
      action: z.literal("epic"),
      idempotencyKey: z.uuid(),
      projectId: z.uuid(),
      title: z.string().trim().min(1).max(240),
    })
    .strict(),
  z
    .object({
      type: z.literal("tickets"),
      version: z.literal(1),
      action: z.literal("capture"),
      payload: captureSubmissionSchema,
    })
    .strict(),
]);
export type TicketRequest = z.infer<typeof ticketRequestSchema>;
export const projectSchema = z
  .object({ id: z.uuid(), name: z.string().max(120) })
  .strict();
export const epicSchema = z
  .object({
    id: z.uuid(),
    number: z.number().int().positive(),
    title: z.string().max(240),
  })
  .strict();
export const createdIssueSchema = z
  .object({
    id: z.uuid(),
    key: z.string().max(32),
    number: z.number().int().positive(),
    title: z.string().max(240),
    url: z.string().refine((s) => {
      try {
        const u = new URL(s);
        return (
          u.origin === instanceUrl &&
          /^\/issues\/[a-f0-9-]+$/.test(u.pathname) &&
          !u.search &&
          !u.hash &&
          !u.username &&
          !u.password
        );
      } catch {
        return false;
      }
    }),
  })
  .strict();
export const ticketErrorSchema = z.enum([
  "network",
  "auth",
  "permission",
  "validation",
  "size",
  "quota",
  "storage",
  "conflict",
  "busy",
  "not_found",
  "version",
]);
export const ticketResponseSchema = z.union([
  z.object({ ok: z.literal(false), code: ticketErrorSchema }).strict(),
  z.object({ ok: z.literal(true), epics: z.array(epicSchema) }).strict(),
  z.object({ ok: z.literal(true), project: projectSchema }).strict(),
  z.object({ ok: z.literal(true), epic: epicSchema }).strict(),
  z.object({ ok: z.literal(true), issue: createdIssueSchema }).strict(),
]);
export type TicketResponse = z.infer<typeof ticketResponseSchema>;
export const ticketErrors: Record<z.infer<typeof ticketErrorSchema>, string> = {
  network:
    "Se perdió la conexión. Reintenta manualmente; se conservará la misma clave para evitar duplicados.",
  auth: "La conexión ya no es válida. Abre Issopen con tu sesión de Google y vuelve a conectar; si tu invitación está pendiente, acéptala primero. Si el propietario retiró tu acceso, el borrador seguirá aquí pero no podrá enviarse hasta que recuperes acceso.",
  permission:
    "Reconecta Issopen y autoriza crear tickets. La conexión anterior sólo permitía lectura.",
  validation:
    "Revisa los campos y las imágenes: el servidor rechazó el contenido.",
  size: "Las imágenes superan los límites (5 imágenes, 8 MiB en total y 32 megapíxeles por imagen). Reduce su tamaño o quita alguna.",
  quota:
    "El almacenamiento está lleno. Tu borrador se conserva; pide revisar la cuota.",
  storage:
    "El servidor no pudo confirmar el envío. Reintenta la misma operación.",
  conflict:
    "Esta clave ya corresponde a otro contenido. Conserva el borrador y revisa el ticket antes de crear otro.",
  busy: "Hay otra operación en curso. Espera y reintenta manualmente.",
  not_found: "El proyecto o Epic ya no está disponible. Revisa el destino.",
  version:
    "La versión del servidor no coincide. Actualiza Issopen o la extensión.",
};
