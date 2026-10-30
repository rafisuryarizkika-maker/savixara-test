
import { assertEquals } from "jsr:@std/assert";

import {
  rejectInvalidUser,
  requireAal2,
  requireAdmin,
} from "../supabase/functions/_shared/melostore-auth-gate.ts";

Deno.test("invalid user is rejected with 401", () => {
  const result = rejectInvalidUser(null, null);

  assertEquals(result?.status, 401);
});

Deno.test("user lookup error is rejected with 401", () => {
  const result = rejectInvalidUser(
    { id: "test-user" },
    new Error("invalid session"),
  );

  assertEquals(result?.status, 401);
});

Deno.test("AAL1 is rejected and requires MFA", () => {
  const result = requireAal2({ aal: "aal1" }, null);

  assertEquals(result?.status, 403);
  assertEquals(result?.body.requires_mfa, true);
});

Deno.test("claims lookup error is rejected", () => {
  const result = requireAal2(
    { aal: "aal2" },
    new Error("claims unavailable"),
  );

  assertEquals(result?.status, 403);
});

Deno.test("AAL2 passes the authentication gate", () => {
  const result = requireAal2({ aal: "aal2" }, null);

  assertEquals(result, null);
});

Deno.test("AAL2 non-admin is rejected", () => {
  const result = requireAdmin(false, null);

  assertEquals(result?.status, 403);
});

Deno.test("AAL2 admin passes the admin gate", () => {
  const result = requireAdmin(true, null);

  assertEquals(result, null);
});

Deno.test("admin RPC error is rejected", () => {
  const result = requireAdmin(
    true,
    new Error("admin check failed"),
  );

  assertEquals(result?.status, 403);
});
