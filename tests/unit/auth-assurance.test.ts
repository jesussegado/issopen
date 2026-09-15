import { expect, it } from "vitest";
import { authenticationMethod } from "../../src/server/auth-assurance.js";

it("recognizes only trusted successful login hook contexts, not refresh/invitation/link or client claims", () => {
  expect(authenticationMethod({ path: "/sign-in/email" })).toBe("password");
  expect(
    authenticationMethod({ path: "/callback/:id", params: { id: "google" } }),
  ).toBe("google");
  for (const value of [
    null,
    {},
    { path: "/callback/:id", params: { id: "other" } },
    { path: "/callback/google" },
    { path: "/invitation/accept" },
    { path: "/get-session" },
    { path: "/link-social" },
    { path: "/sign-in/email/extra" },
  ])
    expect(authenticationMethod(value)).toBeNull();
});
