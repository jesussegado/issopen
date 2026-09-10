// These functions are serialized by Chrome into the isolated top-frame world.
// Keep every dependency inside the function (no imported/runtime closures).
export async function selectCaptureArea() {
  return new Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>((resolve) => {
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;cursor:crosshair;outline:none;";
    host.tabIndex = -1;
    const shadow = host.attachShadow({ mode: "closed" });
    const shade = document.createElement("div");
    shade.style.cssText =
      "position:absolute;inset:0;background:rgba(0,0,0,.16);";
    const box = document.createElement("div");
    box.style.cssText =
      "position:absolute;border:2px solid #027067;background:rgba(111,217,181,.25);pointer-events:none;";
    const text = document.createElement("div");
    text.textContent =
      "Issopen · Arrastra para recortar · Escape cancela (30 s)";
    text.style.cssText =
      "position:absolute;top:8px;left:8px;padding:12px;background:#fff;color:#142f29;font:16px system-ui;border:2px solid #027067;pointer-events:none;";
    shadow.append(shade, box, text);
    const previous = document.activeElement;
    let start: { x: number; y: number } | null = null;
    let timer: ReturnType<typeof setTimeout>;
    function done(
      rect: { x: number; y: number; width: number; height: number } | null,
    ) {
      clearTimeout(timer);
      host.remove();
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", cancel);
      window.removeEventListener("pagehide", cancel);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
      resolve(rect);
    }
    const cancel = () => done(null);
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancel();
      }
    }
    const point = (e: PointerEvent) => ({
      x: Math.max(0, Math.min(innerWidth, e.clientX)),
      y: Math.max(0, Math.min(innerHeight, e.clientY)),
    });
    host.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      start = point(e);
      host.setPointerCapture(e.pointerId);
    });
    host.addEventListener("pointermove", (e) => {
      if (!start) return;
      const end = point(e);
      Object.assign(box.style, {
        left: `${Math.min(start.x, end.x)}px`,
        top: `${Math.min(start.y, end.y)}px`,
        width: `${Math.abs(end.x - start.x)}px`,
        height: `${Math.abs(end.y - start.y)}px`,
      });
    });
    host.addEventListener("pointerup", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!start) return;
      const end = point(e);
      const rect = {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
      };
      done(rect.width >= 2 && rect.height >= 2 ? rect : null);
    });
    window.addEventListener("keydown", key, true);
    window.addEventListener("resize", cancel);
    window.addEventListener("pagehide", cancel);
    document.documentElement.append(host);
    host.focus({ preventScroll: true });
    timer = setTimeout(cancel, 30000);
  });
}

export async function prepareCapturePage(full: boolean) {
  const root = document.documentElement;
  const stateWindow = window as unknown as {
    __issopenCaptureCleanup?: () => void;
    __issopenCaptureValid?: () =>
      | "ready"
      | "content-changed"
      | "viewport-changed";
  };
  stateWindow.__issopenCaptureCleanup?.();
  const originalX = scrollX,
    originalY = scrollY;
  const originalWidth = innerWidth,
    originalHeight = innerHeight,
    originalDpr = devicePixelRatio;
  const changed: { element: HTMLElement; value: string; priority: string }[] =
    [];
  const elements = document.querySelectorAll<HTMLElement>("*");
  if (elements.length > 20000) return { error: "page-too-complex" as const };
  for (const element of elements) {
    const sensitive =
      element.matches(
        "input,textarea,select,[contenteditable]:not([contenteditable=false]),iframe,object,embed",
      ) ||
      element.shadowRoot !== null ||
      element.localName.includes("-");
    const fixed =
      full && ["fixed", "sticky"].includes(getComputedStyle(element).position);
    if (sensitive || fixed) {
      changed.push({
        element,
        value: element.style.getPropertyValue("opacity"),
        priority: element.style.getPropertyPriority("opacity"),
      });
      element.style.setProperty("opacity", "0", "important");
    }
  }
  const style = document.createElement("style");
  style.textContent =
    "* { scroll-behavior:auto!important;scroll-snap-type:none!important;animation-play-state:paused!important;transition:none!important; }";
  root.append(style);
  let valid = true;
  const observer = new MutationObserver(() => {
    valid = false;
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  stateWindow.__issopenCaptureValid = () => {
    if (
      innerWidth !== originalWidth ||
      innerHeight !== originalHeight ||
      devicePixelRatio !== originalDpr
    )
      return "viewport-changed";
    return valid ? "ready" : "content-changed";
  };
  let timer: ReturnType<typeof setTimeout>;
  function cleanup() {
    clearTimeout(timer);
    observer.disconnect();
    for (const item of changed) {
      if (item.value)
        item.element.style.setProperty("opacity", item.value, item.priority);
      else item.element.style.removeProperty("opacity");
    }
    scrollTo({ left: originalX, top: originalY, behavior: "instant" });
    style.remove();
    delete stateWindow.__issopenCaptureCleanup;
    delete stateWindow.__issopenCaptureValid;
  }
  stateWindow.__issopenCaptureCleanup = cleanup;
  timer = setTimeout(cleanup, 25000);
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  return {
    width: innerWidth,
    height: innerHeight,
    scrollHeight: root.scrollHeight,
    scrollWidth: root.scrollWidth,
    x: scrollX,
    y: scrollY,
    origin: location.origin,
    dpr: originalDpr,
  };
}

export async function scrollCapturePage(y: number) {
  scrollTo({ left: 0, top: y, behavior: "instant" });
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  return {
    y: scrollY,
    width: innerWidth,
    height: innerHeight,
    scrollHeight: document.documentElement.scrollHeight,
  };
}
export function restoreCapturePage() {
  (
    window as unknown as { __issopenCaptureCleanup?: () => void }
  ).__issopenCaptureCleanup?.();
}
export function validCapturePage() {
  return (
    (
      window as unknown as {
        __issopenCaptureValid?: () =>
          | "ready"
          | "content-changed"
          | "viewport-changed";
      }
    ).__issopenCaptureValid?.() ?? "page-unavailable"
  );
}
