
import postgres from "postgres";
import { assert, assertEquals } from "jsr:@std/assert";

const databaseUrl = Deno.env.get("TEST_DATABASE_URL");

Deno.test({
  name: "RPC 9-param rejects invalid leases without mutating progress",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    if (!databaseUrl) {
      throw new Error("TEST_DATABASE_URL is required");
    }

    const db = postgres(databaseUrl, { max: 1 });
    const jobId = crypto.randomUUID();
    const validToken = crypto.randomUUID();
    const pageKey = `lease-guard-test-${crypto.randomUUID()}`;

    async function expectRpcRejected(token: string) {
      let rejected = false;

      try {
        await db`
          SELECT public.melostore_apply_sync_page(
            ${jobId}::uuid,
            ${token}::uuid,
            ${pageKey},
            '[]'::jsonb,
            NULL::text,
            true,
            0,
            0,
            0
          )
        `;
      } catch {
        rejected = true;
      }

      assert(rejected, "RPC must reject this invalid lease or job state");

      const pages = await db`
        SELECT count(*)::int AS count
        FROM public.melostore_sync_pages
        WHERE job_id = ${jobId}::uuid
          AND page_key = ${pageKey}
      `;

      assertEquals(pages[0].count, 0, "Rejected call must not persist a page");

      const jobs = await db`
        SELECT pages_fetched, processed_products
        FROM public.melostore_sync_jobs
        WHERE id = ${jobId}::uuid
      `;

      assertEquals(jobs.length, 1);
      assertEquals(jobs[0].pages_fetched, 0);
      assertEquals(jobs[0].processed_products, 0);
    }

    try {
      const installed = await db`
        SELECT
          to_regclass('public.melostore_sync_jobs') IS NOT NULL AS has_jobs,
          to_regclass('public.melostore_sync_pages') IS NOT NULL AS has_pages,
          to_regprocedure(
            'public.melostore_apply_sync_page(uuid,uuid,text,jsonb,text,boolean,integer,integer,integer)'
          ) IS NOT NULL AS has_rpc
      `;

      assertEquals(installed[0].has_jobs, true);
      assertEquals(installed[0].has_pages, true);
      assertEquals(installed[0].has_rpc, true);

      await db`
        INSERT INTO public.melostore_sync_jobs
          (id, status, lease_token, lease_until)
        VALUES (
          ${jobId}::uuid,
          'running',
          ${validToken}::uuid,
          clock_timestamp() + interval '5 minutes'
        )
      `;

      // Case 1: token does not match the current lease.
      await expectRpcRejected(crypto.randomUUID());

      // Case 2: the correct token exists, but its lease has expired.
      await db`
        UPDATE public.melostore_sync_jobs
        SET lease_until = clock_timestamp() - interval '1 minute'
        WHERE id = ${jobId}::uuid
      `;
      await expectRpcRejected(validToken);

      // Case 3: restore a valid lease, but make the job non-running.
      await db`
        UPDATE public.melostore_sync_jobs
        SET status = 'paused',
            lease_until = clock_timestamp() + interval '5 minutes'
        WHERE id = ${jobId}::uuid
      `;
      await expectRpcRejected(validToken);
    } finally {
      // Delete only this test's uniquely identified rows.
      await db`
        DELETE FROM public.melostore_sync_pages
        WHERE job_id = ${jobId}::uuid
      `.catch(() => []);

      await db`
        DELETE FROM public.melostore_sync_jobs
        WHERE id = ${jobId}::uuid
      `.catch(() => []);

      await db.end();
    }
  },
});
        
