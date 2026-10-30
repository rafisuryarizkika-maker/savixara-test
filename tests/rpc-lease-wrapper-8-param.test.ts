
import postgres from "postgres";
import { assert, assertEquals } from "jsr:@std/assert";

const databaseUrl = Deno.env.get("TEST_DATABASE_URL");

Deno.test({
  name: "RPC 8-param wrapper rejects expired leases and non-running jobs",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    if (!databaseUrl) {
      throw new Error("TEST_DATABASE_URL is required");
    }

    const db = postgres(databaseUrl, { max: 1 });
    const jobId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const validKey = `wrapper-valid-${crypto.randomUUID()}`;
    const expiredKey = `wrapper-expired-${crypto.randomUUID()}`;
    const pausedKey = `wrapper-paused-${crypto.randomUUID()}`;

    async function callWrapper(pageKey: string) {
      return await db`
        SELECT public.melostore_apply_sync_page(
          ${jobId}::uuid,
          ${pageKey},
          '[]'::jsonb,
          NULL::text,
          true,
          0,
          0,
          0
        )
      `;
    }

    async function expectRejected(pageKey: string) {
      let rejected = false;
      try {
        await callWrapper(pageKey);
      } catch {
        rejected = true;
      }
      assert(rejected, "Wrapper must reject invalid lease or status");

      const pages = await db`
        SELECT count(*)::int AS count
        FROM public.melostore_sync_pages
        WHERE job_id = ${jobId}::uuid
          AND page_key = ${pageKey}
      `;
      assertEquals(pages[0].count, 0);

      const jobs = await db`
        SELECT pages_fetched, processed_products
        FROM public.melostore_sync_jobs
        WHERE id = ${jobId}::uuid
      `;
      assertEquals(jobs.length, 1);
      assertEquals(jobs[0].pages_fetched, 1);
      assertEquals(jobs[0].processed_products, 0);
    }

    try {
      const installed = await db`
        SELECT
          to_regclass('public.melostore_sync_jobs') IS NOT NULL
            AS has_jobs,
          to_regclass('public.melostore_sync_pages') IS NOT NULL
            AS has_pages,
          to_regprocedure(
            'public.melostore_apply_sync_page(uuid,text,jsonb,text,boolean,integer,integer,integer)'
          ) IS NOT NULL AS has_wrapper
      `;
      assertEquals(installed[0].has_jobs, true);
      assertEquals(installed[0].has_pages, true);
      assertEquals(installed[0].has_wrapper, true);

      await db`
        INSERT INTO public.melostore_sync_jobs
          (id, status, lease_token, lease_until)
        VALUES (
          ${jobId}::uuid,
          'running',
          ${token}::uuid,
          clock_timestamp() + interval '5 minutes'
        )
      `;

      // Valid running job: wrapper should succeed.
      await callWrapper(validKey);

      const pages = await db`
        SELECT count(*)::int AS count
        FROM public.melostore_sync_pages
        WHERE job_id = ${jobId}::uuid
          AND page_key = ${validKey}
      `;
      assertEquals(pages[0].count, 1);

      const progress = await db`
        SELECT pages_fetched, processed_products
        FROM public.melostore_sync_jobs
        WHERE id = ${jobId}::uuid
      `;
      assertEquals(progress[0].pages_fetched, 1);
      assertEquals(progress[0].processed_products, 0);

      // Expired lease: must reject without additional progress.
      await db`
        UPDATE public.melostore_sync_jobs
        SET lease_until = clock_timestamp() - interval '1 minute'
        WHERE id = ${jobId}::uuid
      `;
      await expectRejected(expiredKey);

      // Paused status: must reject without additional progress.
      await db`
        UPDATE public.melostore_sync_jobs
        SET status = 'paused',
            lease_until = clock_timestamp() + interval '5 minutes'
        WHERE id = ${jobId}::uuid
      `;
      await expectRejected(pausedKey);
    } finally {
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
          
