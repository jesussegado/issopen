// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useLatestRequest } from "../../src/web/lib/latest-request.js";

afterEach(cleanup);

it("rejects late replies, previous route scopes and replies after unmount", () => {
  const rendered = renderHook(
    ({ scope }: { scope: string }) => useLatestRequest(scope),
    { initialProps: { scope: "project-a" } },
  );
  let first = rendered.result.current.begin();
  const second = rendered.result.current.begin();

  act(() => {
    expect(rendered.result.current.accept(second)).toBe(true);
    expect(rendered.result.current.accept(first)).toBe(false);
  });

  rendered.rerender({ scope: "project-b" });
  act(() => {
    expect(rendered.result.current.accept(second)).toBe(false);
    first = rendered.result.current.begin();
    expect(rendered.result.current.accept(first)).toBe(true);
  });

  rendered.unmount();
  expect(rendered.result.current.accept(first)).toBe(false);
});
