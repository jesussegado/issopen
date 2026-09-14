import { useEffect, useState } from "react";
import { workspaceNavigationUrl } from "./workspace-context.js";

const readLocation = () =>
  `${window.location.pathname}${window.location.search}`;

function safeInternalPath(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
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
