
import postgres from "postgres";
import { assertEquals } from "jsr:@std/assert";

const databaseUrl = Deno.env.get("TEST_DATABASE_URL");

Deno.test({
  name: "Game RPCs enforce admin AAL2 and preserve catalog integrity",
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
            SELECT id FROM public.profiles
            WHERE role = 'admin' AND status = true
            LIMIT 1
          ) AS admin_id,
          (
            SELECT id FROM public.profiles
            WHERE role IS DISTINCT FROM 'admin'
               OR status IS DISTINCT FROM true
            LIMIT 1
          ) AS non_admin_id,
          (
            SELECT g.id
            FROM public.games g
            JOIN public.products p ON p.game_id = g.id
            LIMIT 1
          ) AS linked_game_id,
          (
            SELECT slug FROM public.games LIMIT 1
          ) AS existing_slug
      `;

      const { admin_id, non_admin_id, linked_game_id, existing_slug } =
        rows[0];

      if (!admin_id || !non_admin_id) {
        throw new Error(
          "savixara-test needs an active admin and a non-admin profile",
        );
      }

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
              set_config(
                'request.jwt.claim.role',
                'authenticated',
                true
              )
          `;

          await fn(tx);
});
      }

      async function expectDenied(
        userId: string,
        aal: "aal1" | "aal2",
        operation: "list" | "create" | "status" | "delete",
      ) {
        let caught: unknown;

        try {
          await withClaims(userId, aal, async (tx) => {     
         if (operation === "list") {
          await tx`
            SELECT count(*) FROM public.admin_list_games()
          `;
        } else if (operation === "create") {
          await tx`
            SELECT public.admin_create_game(
              'RPC Test Game',
              'rpc-test-game',
              NULL, NULL, NULL, NULL, NULL,
              0, true
            )
          `;    
       } else if (operation === "status") {
              await tx`
                SELECT public.admin_set_game_status(
                  ${crypto.randomUUID()}::uuid,
                  true
                )
              `;
            } else {
              await tx`
                SELECT public.admin_delete_game(
                  ${crypto.randomUUID()}::uuid
                )
              `;
            }
          });
        } catch (error) {
          caught = error;
        }

        assertEquals(
          (caught as { code?: string } | undefined)?.code,
          "42501",
          `${operation} should reject ${aal}`,
        );
      }

      for (const operation of [
  "list",
  "create",
  "status",
  "delete",
] as const) {
        await expectDenied(non_admin_id, "aal2", operation);
        await expectDenied(admin_id, "aal1", operation);
      }

      // A linked game must not be deleted.
      if (linked_game_id) {
        let caught: unknown;

        try {
          await withClaims(admin_id, "aal2", async (tx) => {
            await tx`
              SELECT public.admin_delete_game(
                ${linked_game_id}::uuid
              )
            `;
          });
        } catch (error) {
          caught = error;
        }

        assertEquals(
          (caught as { code?: string } | undefined)?.code,
          "23503",
          "Deleting a game linked to products must be rejected",
        );
      }

      // Duplicate slug must fail without replacing the existing game.
      if (existing_slug) {
        const existing = await db`
          SELECT name, slug FROM public.games
          WHERE slug = ${existing_slug}
          LIMIT 1
        `;

        if (existing[0]) {
          let caught: unknown;

          try {
            await withClaims(admin_id, "aal2", async (tx) => {
              await tx`
                SELECT public.admin_create_game(
                  ${existing[0].slug.replaceAll("-", " ")},
                  ${existing[0].slug},
                  NULL, NULL, NULL, NULL, NULL,
                  0, true
                )
              `;
            });
          } catch (error) {
            caught = error;
          }

          assertEquals(
            (caught as { code?: string } | undefined)?.code,
            "23505",
            "Duplicate slug must be rejected",
          );
        }
      }
      
    // Admin AAL2 must be able to list games.
    await withClaims(admin_id, "aal2", async (tx) => {
      const result = await tx`
        SELECT count(*)::integer AS count
        FROM public.admin_list_games()
      `;

      assertEquals(typeof result[0].count, "number");
    });
        
      // Test create and status update, then force a rollback.
      const suffix = crypto.randomUUID()
        .replaceAll("-", "")
        .slice(0, 12);
      const gameName = `Audit Game ${suffix}`;
      const gameSlug = gameName.toLowerCase().replaceAll(" ", "-");

      let operationsCompleted = false;

      try {
        await withClaims(admin_id, "aal2", async (tx) => {
          const created = await tx`
            SELECT public.admin_create_game(
              ${gameName},
              ${gameSlug},
              NULL, NULL, NULL, NULL, NULL,
              0, true
            ) AS id
          `;

          const gameId = created[0].id as string;
          assertEquals(typeof gameId, "string");

          const changed = await tx`
            SELECT public.admin_set_game_status(
              ${gameId}::uuid, false
            ) AS ok
          `;

          assertEquals(changed[0].ok, true);

          const status = await tx`
            SELECT status FROM public.games
            WHERE id = ${gameId}::uuid
          `;

          assertEquals(status[0].status, false);

          operationsCompleted = true;
          throw new Error("ROLLBACK_GAME_RPC_TEST");
        });
            } catch (error) {
        if (
          operationsCompleted &&
          error instanceof Error &&
          error.message === "ROLLBACK_GAME_RPC_TEST"
        ) {
          // Expected error: transaction rollback marker.
        } else {
          throw error;
        }
      }

      assertEquals(
        operationsCompleted,
        true,
        "Create and status RPC operations must succeed before rollback",
      );

      const persisted = await db`
        SELECT id FROM public.games
        WHERE slug = ${gameSlug}
      `;

      assertEquals(
        persisted.length,
        0,
        "Rolled-back test game must not persist",
      );
    } finally {
      await db.end();
    }
  },
});
        
