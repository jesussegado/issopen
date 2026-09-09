import { z } from "zod";

const restrictedHosts = new Set([
  "chromewebstore.google.com",
  "chrome.google.com",
  "microsoftedge.microsoft.com",
]);

export function inspectableOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    if (restrictedHosts.has(url.hostname.replace(/\.$/, "").toLowerCase()))
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const inspectRequestSchema = z
  .object({
    version: z.literal(1),
    type: z.literal("inspect-active-tab"),
  })
  .strict();
export type InspectRequest = z.infer<typeof inspectRequestSchema>;

export const pageContextSchema = z
  .object({
    origin: z
      .string()
      .max(2048)
      .refine((value) => inspectableOrigin(value) === value),
    viewport: z
      .object({
        width: z.number().int().positive().max(100_000),
        height: z.number().int().positive().max(100_000),
        devicePixelRatio: z.number().positive().max(20),
      })
      .strict(),
  })
  .strict();
export type PageContext = z.infer<typeof pageContextSchema>;

export const inspectResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), context: pageContextSchema }).strict(),
  z
    .object({
      ok: z.literal(false),
      code: z.enum([
        "permission-required",
        "unsupported-page",
        "page-changed",
        "unavailable",
        "invalid-message",
      ]),
    })
    .strict(),
]);
export type InspectResponse = z.infer<typeof inspectResponseSchema>;

export function isPanelSender(
  sender: { id?: string; url?: string; tab?: unknown },
  extensionId: string,
  panelUrl: string,
): boolean {
  return (
    sender.id === extensionId &&
    sender.url === panelUrl &&
    sender.tab === undefined
  );
}

export const errorMessages: Record<
  Extract<InspectResponse, { ok: false }>["code"],
  string
> = {
  "permission-required":
    "Abre una página web y pulsa el icono de Issopen en la barra de Chrome para permitir acceso sólo a esa pestaña. Después, vuelve a comprobarla.",
  "unsupported-page":
    "Esta página no se puede inspeccionar. Usa una web HTTP o HTTPS, fuera de las tiendas de extensiones y del modo incógnito.",
  "page-changed":
    "La pestaña ha cambiado durante la comprobación. Vuelve a abrir Issopen desde su icono en la página que quieras revisar.",
  unavailable:
    "No se pudo comprobar la página. Vuelve a abrir el panel y reinténtalo.",
  "invalid-message":
    "La versión del panel no coincide. Recarga la extensión en chrome://extensions y vuelve a abrirla.",
};
