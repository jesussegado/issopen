import { workspaceUrl } from "./workspace-context.js";
// Events only invalidate authorized data; every refresh still goes through REST.
export function subscribeToProjectChanges(
  projectId: string,
  refresh: () => void,
  accessLost: () => void,
) {
  let stopped = false;
  const visibleRefresh = () => {
    if (!stopped && document.visibilityState === "visible") refresh();
  };
  const stream =
    typeof EventSource === "undefined"
      ? null
      : new EventSource(
          workspaceUrl(`/api/v1/projects/${projectId}/board/events`),
        );
  const onAccessLost = () => {
    if (stopped) return;
    stop();
    accessLost();
  };
  stream?.addEventListener("board", visibleRefresh);
  stream?.addEventListener("error", visibleRefresh);
  stream?.addEventListener("access-lost", onAccessLost);
  window.addEventListener("focus", visibleRefresh);
  window.addEventListener("online", visibleRefresh);
  document.addEventListener("visibilitychange", visibleRefresh);
  const timer = window.setInterval(visibleRefresh, 30_000);
  function stop() {
    stopped = true;
    stream?.removeEventListener("board", visibleRefresh);
    stream?.removeEventListener("error", visibleRefresh);
    stream?.removeEventListener("access-lost", onAccessLost);
    stream?.close();
    window.removeEventListener("focus", visibleRefresh);
    window.removeEventListener("online", visibleRefresh);
    document.removeEventListener("visibilitychange", visibleRefresh);
    window.clearInterval(timer);
  }
  return stop;
}
