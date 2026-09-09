// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  domSnapshotSchema,
  formatDom,
  safePageUrl,
  structuralSelector,
} from "../../../../src/shared/capture-contract";
import { snapshotElement } from "../../lib/element";

beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 10,
    y: 20,
    width: 120,
    height: 80,
    top: 20,
    left: 10,
    right: 130,
    bottom: 100,
    toJSON: () => ({}),
  });
  document.body.innerHTML = "";
});
describe("bounded structural DOM", () => {
  it("never copies text, form values, IDs, classes, arbitrary roles or URL attributes", () => {
    document.body.innerHTML = `<main id="PRIVATE-ID" class="PRIVATE-CLASS"><section role="region" data-secret="PRIVATE-DATA"><button title="PRIVATE-TITLE" aria-label="PRIVATE-LABEL" role="button">PRIVATE-TEXT</button><input value="PRIVATE-VALUE" type="password"><textarea>PRIVATE-TEXTAREA</textarea><iframe src="https://private.test/?token=PRIVATE-TOKEN"></iframe><script>PRIVATE-SCRIPT</script><a href="https://private.test/?token=PRIVATE-HREF" onclick="PRIVATE-HANDLER()">PRIVATE-LINK</a><span role="PRIVATE-ROLE">PRIVATE</span></section><aside>PRIVATE-SIBLING</aside></main>`;
    const selected = document.querySelector("section");
    if (!selected) throw Error("Missing fixture");
    const result = snapshotElement(selected);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
    expect(formatDom(result.dom)).not.toContain("PRIVATE");
    expect(result.dom.ancestors).toHaveLength(1);
    expect(result.dom.nodes.some((n) => n.tag === "input" && n.omitted)).toBe(
      true,
    );
    expect(
      result.dom.nodes.some(
        (n) => n.tag === "button" && n.attributes.role === "button",
      ),
    ).toBe(true);
    expect(document.querySelector(structuralSelector(result.element))).toBe(
      selected,
    );
  });
  it("omits shadow/custom/editable subtrees and explicitly bounds size and depth", () => {
    document.body.innerHTML = `<main><x-private>PRIVATE-CUSTOM</x-private><div contenteditable>PRIVATE-EDITABLE</div>${"<section><p>PRIVATE-TEXT</p></section>".repeat(80)}</main>`;
    const selected = document.querySelector("main");
    if (!selected) throw Error("Missing fixture");
    selected.firstElementChild
      ?.attachShadow({ mode: "open" })
      .append(document.createElement("input"));
    const { dom } = snapshotElement(selected);
    expect(dom.truncated).toBe(true);
    expect(dom.nodes.length).toBeLessThanOrEqual(60);
    expect(JSON.stringify(dom)).not.toContain("PRIVATE");
    expect(dom.nodes[1]?.omitted).toBe(true);
    expect(dom.nodes[2]?.omitted).toBe(true);
  });
  it("rejects injected data, cycles and excessive structures at both boundaries", () => {
    document.body.innerHTML = "<section><button>Click</button></section>";
    const selected = document.querySelector("section");
    if (!selected) throw Error("Missing fixture");
    const { dom } = snapshotElement(selected);
    expect(
      domSnapshotSchema.safeParse({ ...dom, text: "PRIVATE" }).success,
    ).toBe(false);
    expect(
      domSnapshotSchema.safeParse({
        ...dom,
        nodes: dom.nodes.map((n) => ({
          ...n,
          attributes: { onclick: "PRIVATE" },
        })),
      }).success,
    ).toBe(false);
    expect(
      domSnapshotSchema.safeParse({
        ...dom,
        nodes: dom.nodes.map((n) => ({ ...n, parent: 0 })),
      }).success,
    ).toBe(false);
    expect(
      domSnapshotSchema.safeParse({
        ...dom,
        nodes: Array(61).fill(dom.nodes[0]),
      }).success,
    ).toBe(false);
  });
  it("minimizes navigable URLs before review", () => {
    expect(safePageUrl("https://example.test/path?token=PRIVATE#PRIVATE")).toBe(
      "https://example.test/path",
    );
    expect(safePageUrl("https://example.test/reset/PRIVATE")).toBe(
      "https://example.test/redacted/redacted",
    );
    const credentialUrl = new URL("https://example.test/");
    credentialUrl.username = "synthetic";
    credentialUrl.password = "synthetic-test-only";
    expect(safePageUrl(credentialUrl.toString())).toBeNull();
    expect(safePageUrl("javascript:alert(1)")).toBeNull();
  });
});
