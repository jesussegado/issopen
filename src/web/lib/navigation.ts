import { useEffect, useState } from "react";
import { workspaceNavigationUrl } from "./workspace-context.js";

const readLocation = () =>
  `${window.location.pathname}${window.location.search}`;

export function safeInternalPath(path: string): string {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.length > 8192 ||
    [...path].some(
      (character) =>
        character.charCodeAt(0) <= 32 ||
        character.charCodeAt(0) === 127 ||
        character === "\\",
    )
  )
    return "/";
  try {
    const url = new URL(path, window.location.origin);
    if (
      url.origin !== window.location.origin ||
      /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(url.pathname)
    )
      return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function navigate(path: string, replace = false) {
  const target = workspaceNavigationUrl(safeInternalPath(path));
  window.history[replace ? "replaceState" : "pushState"]({}, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useLocation() {
  const [location, setLocation] = useState(readLocation);

  useEffect(() => {
    const update = () => setLocation(readLocation());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  return location;
}

export function returnPath(): string {
  return safeInternalPath(
    new URLSearchParams(window.location.search).get("returnTo") ?? "/",
  );
}
