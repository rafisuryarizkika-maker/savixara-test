import postgres from "postgres";
import { assertEquals } from "jsr:@std/assert";

const databaseUrl = Deno.env.get("TEST_DATABASE_URL");
const rollbackMarker = "ROLLBACK_ADMIN_PRICE_RPC_TEST";

Deno.test({
  name: "Admin save product prices enforces AAL2 and rolls back real RPC writes",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    if (!databaseUrl) {
      throw new Error("TEST_DATABASE_URL is required");
    }

    const db = postgres(databaseUrl, { max: 1 });

    try {
      const rows = await db`
        SELECT
          (
            SELECT id
            FROM public.profiles
            WHERE role = 'admin' AND status = true
            LIMIT 1
          ) AS admin_id,
          (
            SELECT id
            FROM public.profiles
            WHERE role IS DISTINCT FROM 'admin'
               OR status IS DISTINCT FROM true
            LIMIT 1
          ) AS non_admin_id,
          (
            SELECT id
            FROM public.products
            ORDER BY id
            LIMIT 1
          ) AS product_id
      `;

      const { admin_id, non_admin_id, product_id } = rows[0];

      if (!admin_id || !non_admin_id || !product_id) {
        throw new Error(
          "savixara-test needs an active admin, a non-admin profile, and a test product",
        );
      }

      const beforeRows = await db`
        SELECT
          cost_price,
          selling_price,
          promo_price,
          status,
          name,
          slug
        FROM public.products
        WHERE id = ${product_id}::uuid
      `;

      if (beforeRows.length !== 1) {
        throw new Error("Selected test product was not found");
      }

      const before = beforeRows[0];
      const beforeCostRows = await db`
        SELECT cost_price
        FROM public.product_costs
        WHERE product_id = ${product_id}::uuid
      `;
      const beforeDedicatedCost = beforeCostRows[0]?.cost_price ?? null;

      async function withClaims(
        userId: string,
        aal: "aal1" | "aal2",
        fn: (tx: postgres.TransactionSql) => Promise<unknown>,
      ): Promise<void> {
        await db.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`;

          const claims = JSON.stringify({
            sub: userId,
            role: "authenticated",
            aal,
          });

          await tx`
            SELECT
              set_config('request.jwt.claims', ${claims}, true),
              set_config('request.jwt.claim.sub', ${userId}, true),
              set_config('request.jwt.claim.role', 'authenticated', true)
          `;

          await fn(tx);
        });
      }

      async function expectDenied(
        userId: string,
        aal: "aal1" | "aal2",
        costPrice: number,
        expectedCode: string,
      ) {
        let caught: unknown;

        try {
          await withClaims(userId, aal, async (tx) => {
            await tx`
              SELECT public.admin_save_product_prices(
                ${product_id}::uuid,
                ${costPrice}::numeric,
                2222::numeric,
                333::numeric
              )
            `;
          });
        } catch (error) {
          caught = error;
        }

        assertEquals(
          (caught as { code?: string } | undefined)?.code,
          expectedCode,
          `Expected SQLSTATE ${expectedCode} for user ${userId} at ${aal}`,
        );
      }

      // Non-admin at AAL2 must be rejected.
      await expectDenied(non_admin_id, "aal2", 1111, "42501");

      // Admin at AAL1 must be rejected.
      await expectDenied(admin_id, "aal1", 1111, "42501");

      // Admin at AAL2 must reach validation; negative prices are invalid.
      await expectDenied(admin_id, "aal2", -1, "22023");

      // Execute a real successful RPC call and verify both price tables.
      // A deliberate marker error then rolls the entire transaction back.
      let writeVerified = false;

      try {
        await withClaims(admin_id, "aal2", async (tx) => {
          const result = await tx`
            SELECT public.admin_save_product_prices(
              ${product_id}::uuid,
              1111::numeric,
              2222::numeric,
              333::numeric
            ) AS ok
          `;

          assertEquals(result[0].ok, true);

          await tx`RESET ROLE`;

          const productAfterWrite = await tx`
            SELECT
              cost_price,
              selling_price,
              promo_price,
              status,
              name,
              slug
            FROM public.products
            WHERE id = ${product_id}::uuid
          `;

          assertEquals(productAfterWrite.length, 1);
          assertEquals(Number(productAfterWrite[0].cost_price), 1111);
          assertEquals(Number(productAfterWrite[0].selling_price), 2222);
          assertEquals(Number(productAfterWrite[0].promo_price), 333);
          assertEquals(productAfterWrite[0].status, before.status);
          assertEquals(productAfterWrite[0].name, before.name);
          assertEquals(productAfterWrite[0].slug, before.slug);

          const dedicatedCostAfterWrite = await tx`
            SELECT cost_price
            FROM public.product_costs
            WHERE product_id = ${product_id}::uuid
          `;

          assertEquals(dedicatedCostAfterWrite.length, 1);
          assertEquals(Number(dedicatedCostAfterWrite[0].cost_price), 1111);

          writeVerified = true;
          throw new Error(rollbackMarker);
        });
      } catch (error) {
        if (
          !writeVerified ||
          !(error instanceof Error) ||
          error.message !== rollbackMarker
        ) {
          throw error;
        }
      }

      assertEquals(
        writeVerified,
        true,
        "Successful RPC write must be verified before rollback",
      );

      // Confirm the transaction rollback restored every original value.
      const afterRollbackRows = await db`
        SELECT
          cost_price,
          selling_price,
          promo_price,
          status,
          name,
          slug
        FROM public.products
        WHERE id = ${product_id}::uuid
      `;

      assertEquals(afterRollbackRows.length, 1);
      assertEquals(
        Number(afterRollbackRows[0].cost_price),
        Number(before.cost_price),
      );
      assertEquals(
        Number(afterRollbackRows[0].selling_price),
        Number(before.selling_price),
      );
      assertEquals(
        afterRollbackRows[0].promo_price === null
          ? null
          : Number(afterRollbackRows[0].promo_price),
        before.promo_price === null ? null : Number(before.promo_price),
      );
      assertEquals(afterRollbackRows[0].status, before.status);
      assertEquals(afterRollbackRows[0].name, before.name);
      assertEquals(afterRollbackRows[0].slug, before.slug);

      const afterRollbackCostRows = await db`
        SELECT cost_price
        FROM public.product_costs
        WHERE product_id = ${product_id}::uuid
      `;

      assertEquals(
        afterRollbackCostRows[0]?.cost_price === undefined
          ? null
          : Number(afterRollbackCostRows[0].cost_price),
        beforeDedicatedCost === null ? null : Number(beforeDedicatedCost),
      );
    } finally {
      await db.end();
    }
  },
});
