
import postgres from "postgres";
import { assertEquals } from "jsr:@std/assert";

const databaseUrl = Deno.env.get("TEST_DATABASE_URL");

Deno.test({
  name: "PostgreSQL: only one independent connection claims a row",
  ignore: !databaseUrl,
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    if (!databaseUrl) {
      throw new Error("TEST_DATABASE_URL is required");
    }

    // Dua pool terpisah untuk memastikan dua koneksi independen.
    const dbA = postgres(databaseUrl, { max: 1 });
    const dbB = postgres(databaseUrl, { max: 1 });

    const table = "public.savixara_concurrency_probe";
    const testId = crypto.randomUUID();

    try {
      // Tabel khusus probe, bukan tabel pekerjaan produksi.
      await dbA.unsafe(`
        CREATE TABLE IF NOT EXISTS ${table} (
          id uuid PRIMARY KEY,
          status text NOT NULL,
          lease_token uuid NULL
        )
      `);

      await dbA`
        INSERT INTO ${dbA(table)} (id, status, lease_token)
        VALUES (${testId}::uuid, 'paused', NULL)
      `;

      const tokenA = crypto.randomUUID();
      const tokenB = crypto.randomUUID();

      const claim = async (
        db: typeof dbA,
        token: string,
      ) => {
        return await db`
          UPDATE public.savixara_concurrency_probe
          SET status = 'running',
              lease_token = ${token}::uuid
          WHERE id = ${testId}::uuid
            AND status = 'paused'
            AND lease_token IS NULL
          RETURNING id, lease_token
        `;
      };

      // Dua permintaan dimulai tanpa menunggu satu sama lain.
      const [resultA, resultB] = await Promise.all([
        claim(dbA, tokenA),
        claim(dbB, tokenB),
      ]);

      assertEquals(
        resultA.length + resultB.length,
        1,
        "Tepat satu klaim harus berhasil",
      );

      const finalRows = await dbA`
        SELECT status, lease_token
        FROM public.savixara_concurrency_probe
        WHERE id = ${testId}::uuid
      `;

      assertEquals(finalRows.length, 1);
      assertEquals(finalRows[0].status, "running");

      const winner = resultA.length === 1 ? tokenA : tokenB;
      assertEquals(finalRows[0].lease_token, winner);
    } finally {
      // Hapus hanya baris milik tes ini.
      await dbA`
        DELETE FROM public.savixara_concurrency_probe
        WHERE id = ${testId}::uuid
      `.catch(() => []);

      await dbA.end();
      await dbB.end();
    }
  },
});
