
import postgres from "postgres";
import { assertEquals } from "jsr:@std/assert";

const databaseUrl = Deno.env.get("TEST_DATABASE_URL");

Deno.test({
  name: "RPC accepts decimal cost price and keeps new product inactive",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    if (!databaseUrl) {
      throw new Error("TEST_DATABASE_URL is required");
    }

    const db = postgres(databaseUrl, { max: 1 });
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const gameId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const leaseToken = crypto.randomUUID();
    const sku = `TESTDEC${suffix}`;
    const gameSlug = `decimal-game-${suffix}`;
    const productSlug = `decimal-product-${suffix}`;
    const pageKey = `decimal-price-${suffix}`;

    try {
      const activeJobs = await db`
        SELECT count(*)::int AS count
        FROM public.melostore_sync_jobs
        WHERE status IN ('pending', 'running', 'paused')
      `;

      assertEquals(
        activeJobs[0].count,
        0,
        "Test requires no other active sync job",
      );

      await db`
        INSERT INTO public.games (id, name, slug)
        VALUES (
          ${gameId}::uuid,
          ${`Decimal Test Game ${suffix}`},
          ${gameSlug}
        )
      `;

      await db`
        INSERT INTO public.melostore_sync_jobs
          (id, status, lease_token, lease_until)
        VALUES (
          ${jobId}::uuid,
          'running',
          ${leaseToken}::uuid,
          clock_timestamp() + interval '5 minutes'
        )
      `;

      const products = [{
        sku,
        provider_status: "active",
        name: "Decimal price test product",
        game_id: gameId,
        slug: productSlug,
        category: "Test",
        cost_price: "1234.56",
        description: "Test-only decimal cost price",
      }];

      const rpc = await db`
        SELECT public.melostore_apply_sync_page(
          ${jobId}::uuid,
          ${leaseToken}::uuid,
          ${pageKey},
          ${db.json(products)},
          NULL::text,
          false,
          1,
          1,
          0
        ) AS result
      `;

      assertEquals(
        (rpc[0].result as { ok?: boolean }).ok,
        true,
      );

      const rows = await db`
        SELECT cost_price, selling_price, promo_price, status
        FROM public.products
        WHERE provider = 'Melostore'
          AND provider_product_code = ${sku}
      `;

      assertEquals(rows.length, 1);
      assertEquals(Number(rows[0].cost_price), 1234.56);
      assertEquals(Number(rows[0].selling_price), 0);
      assertEquals(rows[0].promo_price, null);
      assertEquals(rows[0].status, false);
    } finally {
      await db`
        DELETE FROM public.melostore_sync_pages
        WHERE job_id = ${jobId}::uuid
      `.catch(() => []);

      await db`
        DELETE FROM public.melostore_sync_jobs
        WHERE id = ${jobId}::uuid
      `.catch(() => []);

      await db`
        DELETE FROM public.products
        WHERE provider = 'Melostore'
          AND provider_product_code = ${sku}
      `.catch(() => []);

      await db`
        DELETE FROM public.games
        WHERE id = ${gameId}::uuid
      `.catch(() => []);

      await db.end();
    }
  },
});
