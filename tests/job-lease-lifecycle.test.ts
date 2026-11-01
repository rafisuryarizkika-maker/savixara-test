import postgres from "postgres";
import { assertEquals } from "jsr:@std/assert";

const databaseUrl = Deno.env.get("TEST_DATABASE_URL");

Deno.test({
  name: "PostgreSQL lease lifecycle: concurrent claim, reclaim, pause, completion and safe release",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required");

    const db = postgres(databaseUrl, { max: 3 });
    const jobId = crypto.randomUUID();
    const tokenA = crypto.randomUUID();
    const tokenB = crypto.randomUUID();
    const tokenC = crypto.randomUUID();

    async function claim(token: string) {
      return await db`
        UPDATE public.melostore_sync_jobs
        SET status = 'running',
            lease_token = ${token}::uuid,
            lease_until = clock_timestamp() + interval '2 minutes',
            updated_at = clock_timestamp()
        WHERE id = ${jobId}::uuid
          AND status IN ('pending', 'running', 'paused')
          AND (lease_until IS NULL OR lease_until < clock_timestamp())
        RETURNING id, lease_token
      `;
    }

    try {
      const active = await db`
        SELECT count(*)::int AS count
        FROM public.melostore_sync_jobs
        WHERE status IN ('pending', 'running', 'paused')
      `;
      assertEquals(
        active[0].count,
        0,
        "Skip safely when the test database already has an active sync job",
      );

      await db`
        INSERT INTO public.melostore_sync_jobs
          (id, status, lease_token, lease_until)
        VALUES (${jobId}::uuid, 'pending', NULL, NULL)
      `;

      // Two independent SQL statements compete for the same pending row.
      const [claimA, claimB] = await Promise.all([claim(tokenA), claim(tokenB)]);
      assertEquals(claimA.length + claimB.length, 1, "Exactly one concurrent claimant must win");

      const winningToken = claimA.length === 1 ? tokenA : tokenB;
      const losingToken = claimA.length === 1 ? tokenB : tokenA;

      const afterRace = await db`
        SELECT status, lease_token
        FROM public.melostore_sync_jobs
        WHERE id = ${jobId}::uuid
      `;
      assertEquals(afterRace[0].status, "running");
      assertEquals(afterRace[0].lease_token, winningToken);
      assertEquals(losingToken === winningToken, false);

      // Expiry allows a new worker to reclaim the same job.
      await db`
        UPDATE public.melostore_sync_jobs
        SET lease_until = clock_timestamp() - interval '1 second'
        WHERE id = ${jobId}::uuid
      `;
      const reclaimed = await claim(tokenC);
      assertEquals(reclaimed.length, 1, "Expired lease must be reclaimable");

      // The old worker must not clear the new worker's lease.
      const staleRelease = await db`
        UPDATE public.melostore_sync_jobs
        SET lease_token = NULL, lease_until = NULL
        WHERE id = ${jobId}::uuid
          AND lease_token = ${winningToken}::uuid
        RETURNING id
      `;
      assertEquals(staleRelease.length, 0, "Stale token must not release new lease");

      const afterStaleRelease = await db`
        SELECT lease_token
        FROM public.melostore_sync_jobs
        WHERE id = ${jobId}::uuid
      `;
      assertEquals(afterStaleRelease[0].lease_token, tokenC);

      // Current worker releases its own lease, leaving the job claimable.
      const validRelease = await db`
        UPDATE public.melostore_sync_jobs
        SET lease_token = NULL, lease_until = NULL, updated_at = clock_timestamp()
        WHERE id = ${jobId}::uuid
          AND lease_token = ${tokenC}::uuid
        RETURNING id
      `;
      assertEquals(validRelease.length, 1);

      // Reclaim, then exercise the same guarded running -> paused transition
      // used by the Edge Function's failure handler.
      const afterReleaseClaim = await claim(tokenA);
      assertEquals(afterReleaseClaim.length, 1, "Released running job must be claimable");

      const paused = await db`
        UPDATE public.melostore_sync_jobs
        SET status = 'paused', updated_at = clock_timestamp()
        WHERE id = ${jobId}::uuid
          AND lease_token = ${tokenA}::uuid
          AND status = 'running'
          AND lease_until > clock_timestamp()
        RETURNING status
      `;
      assertEquals(paused.length, 1, "Current lease holder can pause a running job");
      assertEquals(paused[0].status, "paused");

      // Simulate finally-style release after pause; it must preserve paused.
      const releasePaused = await db`
        UPDATE public.melostore_sync_jobs
        SET lease_token = NULL, lease_until = NULL, updated_at = clock_timestamp()
        WHERE id = ${jobId}::uuid
          AND lease_token = ${tokenA}::uuid
        RETURNING status
      `;
      assertEquals(releasePaused.length, 1);
      assertEquals(releasePaused[0].status, "paused");

      const pausedState = await db`
        SELECT status, lease_token, lease_until
        FROM public.melostore_sync_jobs
        WHERE id = ${jobId}::uuid
      `;
      assertEquals(pausedState[0].status, "paused");
      assertEquals(pausedState[0].lease_token, null);
      assertEquals(pausedState[0].lease_until, null);

      // A paused job can be reclaimed; the prior token cannot pause it again.
      const reclaimedPaused = await claim(tokenB);
      assertEquals(reclaimedPaused.length, 1, "Paused job must be reclaimable");

      const stalePause = await db`
        UPDATE public.melostore_sync_jobs
        SET status = 'paused'
        WHERE id = ${jobId}::uuid
          AND lease_token = ${tokenA}::uuid
          AND status = 'running'
          AND lease_until > clock_timestamp()
        RETURNING id
      `;
      assertEquals(stalePause.length, 0, "Stale worker must not pause a reclaimed job");

      // Simulate completion followed by finally-style lease release.
      const completed = await db`
        UPDATE public.melostore_sync_jobs
        SET status = 'completed', updated_at = clock_timestamp()
        WHERE id = ${jobId}::uuid
          AND lease_token = ${tokenB}::uuid
          AND status = 'running'
          AND lease_until > clock_timestamp()
        RETURNING status
      `;
      assertEquals(completed.length, 1);
      assertEquals(completed[0].status, "completed");

      const releaseCompleted = await db`
        UPDATE public.melostore_sync_jobs
        SET lease_token = NULL, lease_until = NULL, updated_at = clock_timestamp()
        WHERE id = ${jobId}::uuid
          AND lease_token = ${tokenB}::uuid
        RETURNING status
      `;
      assertEquals(releaseCompleted.length, 1);
      assertEquals(
        releaseCompleted[0].status,
        "completed",
        "Lease release must not overwrite completed status",
      );

      const finalState = await db`
        SELECT status, lease_token, lease_until
        FROM public.melostore_sync_jobs
        WHERE id = ${jobId}::uuid
      `;
      assertEquals(finalState[0].status, "completed");
      assertEquals(finalState[0].lease_token, null);
      assertEquals(finalState[0].lease_until, null);
    } finally {
      // Cleanup is restricted to this test's unique job ID.
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
