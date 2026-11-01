import { assertEquals } from "jsr:@std/assert";
import { parseSyncRequestBody } from "../supabase/functions/_shared/melostore-sync-request.ts";

Deno.test("empty request body remains an empty new-job request", async () => {
  const result = await parseSyncRequestBody(new Request("https://example.test", { method: "POST" }));
  assertEquals(result, { ok: true, payload: {} });
});

Deno.test("rejects malformed JSON", async () => {
  const result = await parseSyncRequestBody(new Request("https://example.test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bad",
  }));
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.status, 400);
});

Deno.test("rejects JSON primitives and arrays", async () => {
  for (const body of ["null", "[]", "\"text\"", "42"]) {
    const result = await parseSyncRequestBody(new Request("https://example.test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }));
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.status, 400);
  }
});

Deno.test("accepts JSON objects and parameters in content type", async () => {
  const result = await parseSyncRequestBody(new Request("https://example.test", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ limit: 5 }),
  }));
  assertEquals(result, { ok: true, payload: { limit: 5 } });
});

Deno.test("rejects non-JSON content type", async () => {
  const result = await parseSyncRequestBody(new Request("https://example.test", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "{}",
  }));
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.status, 415);
});
