
import postgres from "postgres";
import { assert, assertEquals } from "jsr:@std/assert";

const databaseUrl = Deno.env.get("TEST_DATABASE_URL");

Deno.test({
  name: "RPC protects manual catalog fields and handles SKU edge cases",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    if (!databaseUrl) {
      throw new Error("TEST_DATABASE_URL is required");
    }

    const db = postgres(databaseUrl, { max: 1 });
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const jobId = crypto.randomUUID();
    const leaseToken = crypto.randomUUID();
    const pageKey = `catalog-protection-${suffix}`;

    const newSku = `TESTNEW${suffix}`;
    const updateSku = `TESTUPD${suffix}`;
    const collisionSku = `TESTCOL${suffix}`;
    const oosSku = `TESTOOS${suffix}`;

    const gameId = crypto.randomUUID();
    const newSlug = `test-new-${suffix}`;
    const updateSlug = `test-update-${suffix}`;
    const collisionSlug = `test-collision-${suffix}`;
    const oosSlug = `test-oos-${suffix}`;
    const blockerSlug = `test-blocker-${suffix}`;

    try {
      const installed = await db`
        SELECT
          to_regclass('public.products') IS NOT NULL AS has_products,
          to_regclass('public.games') IS NOT NULL AS has_games,
          to_regclass('public.melostore_sync_jobs') IS NOT NULL
            AS has_jobs,
          to_regclass('public.melostore_sync_pages') IS NOT NULL
            AS has_pages,
          to_regprocedure(
            'public.melostore_apply_sync_page(uuid,uuid,text,jsonb,text,boolean,integer,integer,integer)'
          ) IS NOT NULL AS has_rpc
      `;

      assertEquals(installed[0].has_products, true);
      assertEquals(installed[0].has_games, true);
      assertEquals(installed[0].has_jobs, true);
      assertEquals(installed[0].has_pages, true);
      assertEquals(installed[0].has_rpc, true);

      // The schema allows only one pending/running/paused job.
      // Do not alter an existing job to make this test pass.
      const activeJobs = await db`
        SELECT count(*)::int AS count
        FROM public.melostore_sync_jobs
        WHERE status IN ('pending', 'running', 'paused')
      `;

      assertEquals(
        activeJobs[0].count,
        0,
        "Test requires no other active sync job in the test database",
      );

      await db`
        INSERT INTO public.games (id, name, slug)
        VALUES (
          ${gameId}::uuid,
          ${`Test Game ${suffix}`},
          ${`test-game-${suffix}`}
        )
      `;

      // Existing Melostore SKU: manual prices and status must survive.
      await db`
        INSERT INTO public.products (
          game_id, name, slug, provider, provider_product_code,
          cost_price, selling_price, promo_price, status
        )
        VALUES (
          ${gameId}::uuid, 'Old update product', ${updateSlug},
          'Melostore', ${updateSku},
          1000, 7777, 6666, true
        )
      `;

      // Existing SKU that will become out of stock.
      await db`
        INSERT INTO public.products (
          game_id, name, slug, provider, provider_product_code,
          cost_price, selling_price, promo_price, status
        )
        VALUES (
          ${gameId}::uuid, 'Old OOS product', ${oosSlug},
          'Melostore', ${oosSku},
          2000, 8888, 5555, true
        )
      `;

      // A different product owns the collision slug.
      await db`
        INSERT INTO public.products (
          game_id, name, slug, provider, provider_product_code,
          cost_price, selling_price, promo_price, status
        )
        VALUES (
          ${gameId}::uuid, 'Slug blocker', ${blockerSlug},
          'Manual', NULL,
          3000, 9999, 4444, true
        )
      `;

      await db`
        INSERT INTO public.melostore_sync_jobs (
          id, status, lease_token, lease_until
        )
        VALUES (
          ${jobId}::uuid,
          'running',
          ${leaseToken}::uuid,
          clock_timestamp() + interval '5 minutes'
        )
      `;

      const products = [
        {
          sku: newSku,
          provider_status: "active",
          name: "New test product",
          game_id: gameId,
          slug: newSlug,
          category: "Test",
          cost_price: 4000,
          description: "Test-only new product",
        },
        {
          sku: updateSku,
          provider_status: "active",
          name: "Updated test product",
          game_id: gameId,
          slug: updateSlug,
          category: "Test",
          cost_price: 2500,
          description: "Test-only updated product",
        },
        {
          sku: collisionSku,
          provider_status: "active",
          name: "Collision test product",
          game_id: gameId,
          slug: blockerSlug,
          category: "Test",
          cost_price: 3500,
          description: "Must be skipped due to slug collision",
        },
        {
          sku: oosSku,
          provider_status: "out_of_stock",
          cost_price: "",
        },
      ];

      const rpc = await db`
        SELECT public.melostore_apply_sync_page(
          ${jobId}::uuid,
          ${leaseToken}::uuid,
          ${pageKey},
          ${db.json(products)},
          NULL::text,
          false,
          4,
          4,
          0
        ) AS result
      `;

      const result = rpc[0].result as {
        ok?: boolean;
        duplicate_page?: boolean;
        created?: number;
        updated?: number;
        skipped_extra?: number;
      };

      assertEquals(result.ok, true);
      assertEquals(result.duplicate_page, false);
      assertEquals(result.created, 1);
      assertEquals(result.updated, 2);
      assertEquals(result.skipped_extra, 1);

      const created = await db`
        SELECT cost_price, selling_price, promo_price, status
        FROM public.products
        WHERE provider = 'Melostore'
          AND provider_product_code = ${newSku}
      `;

      assertEquals(created.length, 1);
      assertEquals(Number(created[0].cost_price), 4000);
      assertEquals(Number(created[0].selling_price), 0);
      assertEquals(created[0].promo_price, null);
      assertEquals(created[0].status, false);

      const updated = await db`
        SELECT cost_price, selling_price, promo_price, status, name
        FROM public.products
        WHERE provider = 'Melostore'
          AND provider_product_code = ${updateSku}
      `;

      assertEquals(updated.length, 1);
      assertEquals(Number(updated[0].cost_price), 2500);
      assertEquals(Number(updated[0].selling_price), 7777);
      assertEquals(Number(updated[0].promo_price), 6666);
      assertEquals(updated[0].status, true);
      assertEquals(updated[0].name, "Updated test product");

      const collision = await db`
        SELECT id, name, selling_price, promo_price, status
        FROM public.products
        WHERE slug = ${blockerSlug}
      `;

      assertEquals(collision.length, 1);
      assertEquals(collision[0].name, "Slug blocker");
      assertEquals(Number(collision[0].selling_price), 9999);
      assertEquals(Number(collision[0].promo_price), 4444);
      assertEquals(collision[0].status, true);

      const collisionSkuRows = await db`
        SELECT count(*)::int AS count
        FROM public.products
        WHERE provider = 'Melostore'
          AND provider_product_code = ${collisionSku}
      `;

      assertEquals(collisionSkuRows[0].count, 0);

      const outOfStock = await db`
        SELECT cost_price, selling_price, promo_price, status
        FROM public.products
        WHERE provider = 'Melostore'
          AND provider_product_code = ${oosSku}
      `;

      assertEquals(outOfStock.length, 1);
      assertEquals(Number(outOfStock[0].cost_price), 2000);
      assertEquals(Number(outOfStock[0].selling_price), 8888);
      assertEquals(Number(outOfStock[0].promo_price), 5555);
      assertEquals(outOfStock[0].status, false);

      const progress = await db`
        SELECT
          pages_fetched,
          processed_products,
          created_products,
          updated_products,
          skipped_products,
          status
        FROM public.melostore_sync_jobs
        WHERE id = ${jobId}::uuid
      `;

      assertEquals(progress.length, 1);
      assertEquals(progress[0].pages_fetched, 1);
      assertEquals(progress[0].processed_products, 4);
      assertEquals(progress[0].created_products, 1);
      assertEquals(progress[0].updated_products, 2);
      assertEquals(progress[0].skipped_products, 1);
      assertEquals(progress[0].status, "completed");
    } finally {
      // Remove only this test's uniquely identified records.
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
          AND provider_product_code IN (
            ${newSku}, ${updateSku}, ${collisionSku}, ${oosSku}
          )
      `.catch(() => []);

      await db`
        DELETE FROM public.products
        WHERE slug = ${blockerSlug}
      `.catch(() => []);

      await db`
        DELETE FROM public.games
        WHERE id = ${gameId}::uuid
      `.catch(() => []);

      await db.end();
    }
  },
});
        
