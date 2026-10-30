
import { assertEquals } from "jsr:@std/assert";

import {
  authenticateMelostoreRequest,
  type AuthDependencies,
} from "../supabase/functions/_shared/melostore-http-auth.ts";

function makeDeps(
  overrides: Partial<AuthDependencies> = {},
): AuthDependencies {
  return {
    getUser: async () => ({
      user: { id: "test-user" },
      error: null,
    }),
    getClaims: async () => ({
      claims: { aal: "aal2" },
      error: null,
    }),
    isAdmin: async () => ({
      value: true,
      error: null,
    }),
    ...overrides,
  };
}

Deno.test("HTTP auth rejects missing token with 401", async () => {
  let called = false;

  const deps = makeDeps({
    getUser: async () => {
      called = true;
      return { user: null, error: null };
    },
  });

  const result = await authenticateMelostoreRequest(
    new Request("https://example.test", { method: "POST" }),
    deps,
  );

  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.response.status, 401);
  assertEquals(called, false);
});

Deno.test("HTTP auth rejects invalid user with 401", async () => {
  const deps = makeDeps({
    getUser: async () => ({
      user: null,
      error: new Error("invalid token"),
    }),
  });

  const result = await authenticateMelostoreRequest(
    new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer invalid-token" },
    }),
    deps,
  );

  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.response.status, 401);
});

Deno.test("HTTP auth rejects AAL1 with 403", async () => {
  const deps = makeDeps({
    getClaims: async () => ({
      claims: { aal: "aal1" },
      error: null,
    }),
  });

  const result = await authenticateMelostoreRequest(
    new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
    }),
    deps,
  );

  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.response.status, 403);
});

Deno.test("HTTP auth rejects non-admin with 403", async () => {
  const deps = makeDeps({
    isAdmin: async () => ({ value: false, error: null }),
  });

  const result = await authenticateMelostoreRequest(
    new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
    }),
    deps,
  );

  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.response.status, 403);
});

Deno.test("HTTP auth allows admin with AAL2 through the gate only", async () => {
  const result = await authenticateMelostoreRequest(
    new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
    }),
    makeDeps(),
  );

  assertEquals(result.ok, true);
  if (result.ok) assertEquals(result.accessToken, "test-token");
});
