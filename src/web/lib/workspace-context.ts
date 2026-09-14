// Per-tab context only. Never localStorage or a server-global active workspace.
const storageKey = "issopen.workspace";
export function selectedWorkspace(): string | null {
  const explicit = new URLSearchParams(window.location.search).get("workspace");
  if (explicit !== null) return explicit;
  try {
    return window.sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function rememberWorkspace(id: string | null) {
  try {
    if (id) window.sessionStorage.setItem(storageKey, id);
    else window.sessionStorage.removeItem(storageKey);
  } catch {
    /* Context still travels in explicit links when storage is unavailable. */
  }
}

export function workspaceHeaders(): Record<string, string> {
  const id = selectedWorkspace();
  return id === null ? {} : { "X-Issopen-Workspace": id };
}

export function workspaceUrl(path: string, id = selectedWorkspace()): string {
  if (!id || !path.startsWith("/") || path.startsWith("//")) return path;
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) return path;
  if (!url.searchParams.has("workspace")) url.searchParams.set("workspace", id);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function switchWorkspace(id: string, path = "/") {
  // A full document navigation cancels the old screen's asynchronous callbacks.
  rememberWorkspace(id);
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin)
    throw new Error("Invalid workspace destination");
  url.searchParams.set("workspace", id);
  window.location.assign(`${url.pathname}${url.search}${url.hash}`);
}

export function workspaceNavigationUrl(path: string): string {
  // Explicit context survives copied links, new tabs and browser history.
  const id = new URLSearchParams(window.location.search).get("workspace");
  return id ? workspaceUrl(path, id) : path;
}
