
import postgres from "postgres";
import { assertEquals } from "jsr:@std/assert";

const databaseUrl = Deno.env.get("TEST_DATABASE_URL");

Deno.test({
  name: "Admin cost RPCs enforce admin and AAL2 authorization",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    if (!databaseUrl) {
      throw new Error("TEST_DATABASE_URL is required");
    }

    const db = postgres(databaseUrl, { max: 1 });

    try {
      const profiles = await db`
        SELECT
          (
            SELECT id
            FROM public.profiles
            WHERE role = 'admin'
              AND status = true
            LIMIT 1
          ) AS admin_id,
          (
            SELECT id
            FROM public.profiles
            WHERE role IS DISTINCT FROM 'admin'
               OR status IS DISTINCT FROM true
            LIMIT 1
          ) AS non_admin_id
      `;

      const adminId = profiles[0]?.admin_id;
      const nonAdminId = profiles[0]?.non_admin_id;

      if (!adminId || !nonAdminId) {
        throw new Error(
          "savixara-test needs an active admin and a non-admin test profile",
        );
      }

      const fakeProductId = crypto.randomUUID();

      async function invoke(
        userId: string,
        aal: "aal1" | "aal2",
        operation: "list" | "set-negative",
      ) {
        return await db.begin(async (tx) => {
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
              set_config(
                'request.jwt.claim.role',
                'authenticated',
                true
              )
          `;

          if (operation === "list") {
            return await tx`
              SELECT count(*)::int AS count
              FROM public.admin_list_product_costs()
            `;
          }

          return await tx`
            SELECT public.admin_set_product_cost(
              ${fakeProductId}::uuid,
              -1::numeric
            )
          `;
        });
      }

      async function expectDenied(
        userId: string,
        aal: "aal1" | "aal2",
        operation: "list" | "set-negative",
        expectedCode: string,
      ) {
        let caught: unknown;

        try {
          await invoke(userId, aal, operation);
        } catch (error) {
          caught = error;
        }

        if (!caught) {
          throw new Error(
            `${operation} unexpectedly succeeded for ${aal}`,
          );
        }

        assertEquals(
          (caught as { code?: string }).code,
          expectedCode,
          `Unexpected SQLSTATE for ${operation} at ${aal}`,
        );
      }

      // Non-admin at AAL2 must be denied by both RPCs.
      await expectDenied(nonAdminId, "aal2", "list", "42501");
      await expectDenied(
        nonAdminId,
        "aal2",
        "set-negative",
        "42501",
      );

      // Admin at AAL1 must be denied by both RPCs.
      await expectDenied(adminId, "aal1", "list", "42501");
      await expectDenied(
        adminId,
        "aal1",
        "set-negative",
        "42501",
      );

      // Admin at AAL2 may list costs.
      const listed = await invoke(adminId, "aal2", "list");
      assertEquals(Array.isArray(listed), true);

      // Admin at AAL2 reaches input validation:
      // negative cost must be rejected with SQLSTATE 22023.
      await expectDenied(
        adminId,
        "aal2",
        "set-negative",
        "22023",
      );
    } finally {
      await db.end();
    }
  },
});
      
