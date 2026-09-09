import {
  type DomSnapshot,
  domSnapshotSchema,
  safeAttributesSchema,
  safeTagSchema,
  selectedElementSchema,
} from "../../../src/shared/capture-contract";

function summary(element: Element) {
  const tag = safeTagSchema.safeParse(element.localName);
  const attributes: Record<string, unknown> = {};
  const role = safeAttributesSchema.shape.role.safeParse(
    element.getAttribute("role"),
  );
  if (role.success && role.data) attributes.role = role.data;
  for (const key of ["expanded", "hidden", "disabled"] as const) {
    const value = element.getAttribute(`aria-${key}`);
    if (value === "true" || value === "false")
      attributes[key] = value === "true";
  }
  const omitted =
    !tag.success ||
    element.shadowRoot !== null ||
    element.matches(
      "input,textarea,select,option,iframe,object,embed,script,style,svg,canvas,video,audio,[contenteditable]:not([contenteditable=false]),[hidden],[aria-hidden=true]",
    );
  return {
    tag: tag.success ? tag.data : ("div" as const),
    attributes: safeAttributesSchema.parse(attributes),
    omitted,
    textOmitted: Array.from(element.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE,
    ),
  };
}
export function snapshotElement(element: Element) {
  const nodes: DomSnapshot["nodes"] = [];
  let truncated = false;
  function visit(node: Element, parent: number | null, depth: number) {
    if (nodes.length >= 60) {
      truncated = true;
      return;
    }
    const item = summary(node),
      index = nodes.length;
    nodes.push({ ...item, parent });
    if (item.omitted) return;
    if (depth >= 4) {
      if (node.children.length) truncated = true;
      return;
    }
    for (const child of node.children) {
      if (nodes.length >= 60) {
        truncated = true;
        break;
      }
      visit(child, index, depth + 1);
    }
  }
  visit(element, null, 0);
  const ancestors: DomSnapshot["ancestors"] = [];
  for (
    let p = element.parentElement;
    p && !["html", "body"].includes(p.localName) && ancestors.length < 3;
    p = p.parentElement
  )
    ancestors.push(summary(p));
  ancestors.reverse();
  const dom = domSnapshotSchema.parse({
    version: 1,
    nodes,
    ancestors,
    truncated,
  });
  const path = [];
  for (
    let node: Element | null = element;
    node && path.length < 8;
    node = node.parentElement
  ) {
    const tag = safeTagSchema.safeParse(node.localName);
    path.unshift({
      tag: tag.success ? tag.data : ("*" as const),
      child: node.parentElement
        ? Array.from(node.parentElement.children).indexOf(node) + 1
        : 1,
    });
  }
  const rect = element.getBoundingClientRect();
  return selectedElementSchema.parse({
    element: {
      tag: summary(element).tag,
      path,
      bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    },
    dom,
  });
}

export async function selectElement() {
  return new Promise<ReturnType<typeof snapshotElement> | null>((resolve) => {
    const host = document.createElement("div");
    host.tabIndex = -1;
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    const shadow = host.attachShadow({ mode: "closed" });
    const box = document.createElement("div");
    box.style.cssText =
      "position:absolute;border:3px solid #027067;background:rgba(111,217,181,.18);box-sizing:border-box;";
    const hint = document.createElement("div");
    hint.style.cssText =
      "position:absolute;top:8px;left:8px;padding:12px;background:white;color:#143a32;font:16px system-ui;border:2px solid #027067;";
    hint.textContent =
      "Issopen · Elige un elemento · ↑ ancestro · ↓ volver · Enter confirma · Escape cancela";
    shadow.append(box, hint);
    document.documentElement.append(host);
    let selected: Element | null = null;
    const children: Element[] = [];
    let timer: ReturnType<typeof setTimeout>;
    const previous = document.activeElement;
    function finish(value: ReturnType<typeof snapshotElement> | null) {
      clearTimeout(timer);
      host.remove();
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", cancel);
      window.removeEventListener("pagehide", cancel);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
      resolve(value);
    }
    function cancel() {
      finish(null);
    }
    function eligible(node: Element | null | undefined): node is Element {
      return Boolean(
        node &&
          !["html", "body"].includes(node.localName) &&
          !node.closest(
            "input,textarea,select,iframe,[contenteditable]:not([contenteditable=false])",
          ) &&
          node.getBoundingClientRect().width > 0 &&
          node.getBoundingClientRect().height > 0,
      );
    }
    function highlight(node: Element) {
      selected = node;
      const r = node.getBoundingClientRect();
      Object.assign(box.style, {
        left: `${r.x}px`,
        top: `${r.y}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      });
    }
    function move(event: PointerEvent) {
      const node = document.elementFromPoint(event.clientX, event.clientY);
      if (eligible(node) && node !== host) {
        children.length = 0;
        highlight(node);
      }
    }
    function confirm() {
      if (!selected?.isConnected) return;
      try {
        finish(snapshotElement(selected));
      } catch {
        finish(null);
      }
    }
    function click(event: MouseEvent) {
      event.preventDefault();
      event.stopImmediatePropagation();
      confirm();
    }
    function key(event: KeyboardEvent) {
      if (!["Escape", "Enter", "ArrowUp", "ArrowDown"].includes(event.key))
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === "Escape") cancel();
      else if (event.key === "Enter") confirm();
      else if (
        event.key === "ArrowUp" &&
        selected &&
        eligible(selected.parentElement)
      ) {
        children.push(selected);
        highlight(selected.parentElement);
      } else if (event.key === "ArrowDown") {
        const node = children.pop();
        if (eligible(node)) highlight(node);
      }
    }
    document.addEventListener("pointermove", move, true);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", cancel);
    window.addEventListener("pagehide", cancel);
    host.focus({ preventScroll: true });
    timer = setTimeout(cancel, 30000);
  });
}
