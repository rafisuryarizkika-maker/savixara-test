import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateMelostoreRequest, withCorsHeaders } from "../_shared/melostore-http-auth.ts";

const corsHeaders = {
"Access-Control-Allow-Origin": "https://rafisuryarizkika-maker.github.io",
"Access-Control-Allow-Headers":
"authorization, apikey, x-client-info, content-type",
"Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROVIDER_URL = "https://api.melostore.id/api/v1/h2h/pricelists";
const PROVIDER_DELAY_MS = 3_200;
const DEFAULT_PAGE_SIZE = 500;
const MAX_PAGE_SIZE = 500;

type MelostoreProduct = {
id?: number | string;
name?: string;
sku_code?: string;
price?: string | number;
category_name?: string;
type_name?: string;
status?: string;
description?: string | null;
h2h_description?: string | null;
server_name?: string | null;
};

type GameRow = {
id: string;
name: string;
slug: string;
publisher?: string | null;
};

type SyncJob = {
id: string;
status: string;
cursor: string | null;
pages_fetched: number;
total_products: number;
processed_products: number;
created_products: number;
updated_products: number;
skipped_products: number;
failed_products: number;
last_error: string | null;
next_allowed_at: string | null;
lease_token: string | null;
lease_until: string | null;
};

const jsonResponse = (
body: Record<string, unknown>,
status = 200,
) =>
new Response(JSON.stringify(body), {
status,
headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function slugPart(value: string): string {
return value.toLowerCase().normalize("NFKD")
.replace(/[\u0300-\u036f]/g, "")
.replace(/[^a-z0-9]+/g, "-")
.replace(/^-+|-+$/g, "")
.slice(0, 55);
}

function parsePrice(value: unknown): number | null {
if (typeof value === "number") {
return Number.isFinite(value) && value >= 0 ? value : null;
}

if (typeof value === "string" && value.trim() !== "") {
const parsed = Number(value);
return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

return null;
}

function calculateSellingPrice(costPrice: number): number {
if (!Number.isFinite(costPrice) || costPrice <= 0) return 0;

const markup = costPrice < 10_000 ? 0.08
: costPrice < 50_000 ? 0.06
: costPrice < 200_000 ? 0.05
: 0.04;

return Math.ceil((costPrice * (1 + markup)) / 100) * 100;
}

function normalizedProviderStatus(
value: unknown,
): "active" | "out_of_stock" | "unknown" {
const status = String(value ?? "").trim().toLowerCase();

if (status === "active") return "active";
if (status === "out_of_stock") return "out_of_stock";

return "unknown";
}

function guessGameSlug(item: MelostoreProduct): string | null {
const sku = String(item.sku_code ?? "").toLowerCase();

const text = [
item.name ?? "",
item.category_name ?? "",
item.type_name ?? "",
item.server_name ?? "",
sku,
].join(" ").toLowerCase();

if (
/mobile legends|mobile-legends|\bmlbb\b/.test(text) ||
/^(mlid|mlbb|ml-)/.test(sku)
) return "mobile-legends";

if (
/free fire|free-fire|\bfreefire\b/.test(text) ||
/^(ffid|ff-|freefire)/.test(sku)
) return "free-fire";

if (
/pubg mobile|pubg-mobile|\bpubgm\b/.test(text) ||
/^(pubgm|pubg|pmid)/.test(sku)
) return "pubg-mobile";

if (
/\broblox\b|\brobux\b/.test(text) ||
/^(rblx|roblox|rbx)/.test(sku)
) return "roblox";

if (
/honor of kings|honor-of-kings|\bhok\b/.test(text) ||
/^(hok|hokid)/.test(sku)
) return "honor-of-kings";

if (
/genshin impact|genshin-impact|\bgenshin\b/.test(text) ||
/^(giid|genshin)/.test(sku)
) return "genshin-impact";

return null;
}

function intOr(value: unknown, fallback = 0): number {
const n = Number(value);
return Number.isSafeInteger(n) && n >= 0 ? n : fallback;
}

function waitMsFromDate(
value: string | null | undefined,
): number {
if (!value) return 0;

const timestamp = Date.parse(value);

return Number.isFinite(timestamp)
? Math.max(0, timestamp - Date.now())
: 0;
}

Deno.serve(async (req: Request) => {
if (req.method === "OPTIONS") {
return new Response("ok", { headers: corsHeaders });
}

if (req.method !== "POST") {
return jsonResponse({
ok: false,
message: "Gunakan metode POST.",
}, 405);
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !anonKey) {
  return jsonResponse({
    ok: false,
    message: "Secret Supabase untuk autentikasi belum lengkap.",
  }, 500);
}

const userClient = createClient(supabaseUrl, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      Authorization: req.headers.get("Authorization") ?? "",
    },
  },
});
  

const authResult = await authenticateMelostoreRequest(
  req,
  {
    getUser: async (accessToken) => {
      const { data, error } =
        await userClient.auth.getUser(accessToken);

      return {
        user: data.user,
        error,
      };
    },

    getClaims: async (accessToken) => {
      const { data, error } =
        await userClient.auth.getClaims(accessToken);

      return {
        claims: data?.claims ?? null,
        error,
      };
    },

    isAdmin: async () => {
      const { data, error } =
        await userClient.rpc("is_admin");

      return {
        value: data,
        error,
      };
    },
  },
);

if (!authResult.ok) {
  return withCorsHeaders(authResult.response, corsHeaders);
}
  
// Safe auth-only diagnostic: stop before sync work.
if (new URL(req.url).searchParams.get("auth_check_only") === "1") {
  return jsonResponse({
    ok: true,
    auth_check_only: true,
    message: "Autentikasi valid. Sinkronisasi tidak dijalankan.",
  }, 200);
}
  
const accessToken = authResult.accessToken;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const apiKey = Deno.env.get("MELOSTORE_API_KEY");
const secretKey = Deno.env.get("MELOSTORE_SECRET_KEY");

if (!serviceRoleKey || !apiKey || !secretKey) {
  return jsonResponse({
    ok: false,
    message: "Secret Supabase atau Melostore belum lengkap. Periksa konfigurasi Secrets di Supabase.",
  }, 500);
} 
  
const db = createClient(supabaseUrl, serviceRoleKey, {
auth: {
persistSession: false,
autoRefreshToken: false,
},
});

let payload: Record<string, unknown> = {};

try {
payload = await req.json();
} catch {
// Body kosong berarti mulai pekerjaan baru.
}

const pageSize = payload.limit === undefined
? DEFAULT_PAGE_SIZE
: Number(payload.limit);

if (
!Number.isInteger(pageSize) ||
pageSize < 1 ||
pageSize > MAX_PAGE_SIZE
) {
return jsonResponse({
ok: false,
message: `Limit halaman harus berupa bilangan bulat 1–${MAX_PAGE_SIZE}.`,
}, 400);
}

const dryRun = payload.dry_run === true;

// Pure dry-run: fetch a small provider sample and preview prices without
// creating/updating melostore_sync_jobs or writing catalog data.
if (dryRun) {
const previewUrl = new URL(PROVIDER_URL);
previewUrl.searchParams.set("limit", String(Math.min(pageSize, 5)));
let previewResponse: Response;
try {
  previewResponse = await fetch(previewUrl.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
      "X-Secret-Key": secretKey,
    },
    signal: AbortSignal.timeout(25_000),
  });
} catch (error) {
  return jsonResponse({
    ok: false,
    dry_run: true,
    catalog_changed: false,
    message: `Permintaan simulasi ke Melostore gagal: ${error instanceof Error ? error.message : "kesalahan jaringan"}`,
  }, 502);
}
const previewText = await previewResponse.text();
if (previewResponse.status === 429) {
  const rawRetryAfter = Number(previewResponse.headers.get("Retry-After") ?? "60");
  const retrySeconds = Number.isFinite(rawRetryAfter) && rawRetryAfter > 0 ? Math.min(rawRetryAfter, 300) : 60;
  return jsonResponse({
    ok: false,
    dry_run: true,
    catalog_changed: false,
    retry_after_seconds: retrySeconds,
    message: `Melostore membatasi simulasi (HTTP 429). Coba lagi setelah ${retrySeconds} detik.`,
  }, 429);
}
let previewPayload: any = null;
try {
previewPayload = previewText ? JSON.parse(previewText) : {};
} catch {
return jsonResponse({
ok: false,
dry_run: true,
catalog_changed: false,
message: `Respons Melostore bukan JSON yang valid (HTTP ${previewResponse.status}).`,
}, 502);
}
if (!previewResponse.ok) {
return jsonResponse({
ok: false,
dry_run: true,
catalog_changed: false,
message: `Melostore menolak simulasi (HTTP ${previewResponse.status}): ${String(previewPayload?.message ?? "tanpa detail")}`,
}, previewResponse.status === 429 ? 429 : 502);
}
if (previewPayload?.success !== true || !Array.isArray(previewPayload?.data)) {
return jsonResponse({
ok: false,
dry_run: true,
catalog_changed: false,
message: "Respons pricelist Melostore tidak valid: success bukan true atau data bukan array.",
}, 502);
}
const previewProducts = (previewPayload.data as MelostoreProduct[]).slice(0, 5).map((item) => {
const parsedPrice = parsePrice(item.price);
const validPrice = parsedPrice !== null && parsedPrice > 0;
return {
sku: String(item.sku_code ?? ""),
name: String(item.name ?? ""),
category: String(item.category_name ?? ""),
type: String(item.type_name ?? ""),
provider_status: normalizedProviderStatus(item.status),
cost_price: validPrice ? parsedPrice : null,
selling_price_preview: validPrice ? calculateSellingPrice(parsedPrice) : null,
game_slug_guess: guessGameSlug(item),
valid_for_price_preview: validPrice,
};
});
return jsonResponse({
ok: true,
dry_run: true,
catalog_changed: false,
job_created: false,
preview_count: previewProducts.length,
has_more: previewPayload?.meta?.pagination?.has_more === true,
products: previewProducts,
message: "Dry-run berhasil. Pricelist diperiksa dan harga jual disimulasikan; tidak ada pekerjaan sinkronisasi atau perubahan katalog yang dibuat.",
});
}


let leasedJobId: string | null = null;
let activeLeaseToken: string | null = null;

try {
let job: SyncJob;

const requestedJobId =
typeof payload.job_id === "string" ? payload.job_id.trim() : "";

if (requestedJobId) {
const { data, error } = await db
.from("melostore_sync_jobs")
.select("*")
.eq("id", requestedJobId)
.maybeSingle();

if (error) {
throw new Error(
`Gagal membaca pekerjaan sinkronisasi: ${error.message}`,
);
}

if (!data) {
return jsonResponse({
ok: false,
message: "Pekerjaan sinkronisasi tidak ditemukan.",
}, 404);
}

job = data as SyncJob;

if (job.status === "completed") {
return jsonResponse({
ok: true,
done: true,
has_more: false,
job_id: job.id,
message: "Sinkronisasi ini sudah selesai.",
summary: jobSummary(job),
});
}

if (job.status === "paused" && payload.resume_paused !== true) {
  return jsonResponse({
    ok: false,
    requires_resume: true,
    job_id: job.id,
    message:
      "Pekerjaan sedang dijeda. Konfirmasi eksplisit diperlukan sebelum melanjutkan.",
  });
}

if (!["pending", "running", "paused"].includes(job.status)) {
  return jsonResponse({
    ok: false,
    job_id: job.id,
    message: `Pekerjaan berstatus '${job.status}' dan tidak dapat dilanjutkan.`,
  }, 409);
}
  
} else {
const { data, error } = await db
.from("melostore_sync_jobs")
.insert({
status: "running",
created_by: authResult.userId,
cursor: null,
pages_fetched: 0,
total_products: 0,
processed_products: 0,
created_products: 0,
updated_products: 0,
skipped_products: 0,
failed_products: 0,
last_error: null,
})
.select("*")
.single();

if (error) {
  if (error.code === "23505") {
    const { data: activeJob, error: activeJobError } = await db
      .from("melostore_sync_jobs")
      .select("id, status")
      .in("status", ["pending", "running", "paused"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeJobError) {
      throw new Error(
        `Konflik pekerjaan aktif terjadi, tetapi pekerjaan yang ada gagal dibaca: ${activeJobError.message}`,
      );
    }

    return jsonResponse({
      ok: false,
      active_job_exists: true,
      job_id: activeJob?.id ?? null,
      job_status: activeJob?.status ?? null,
      message:
        "Pembuatan pekerjaan baru ditolak karena sudah ada pekerjaan aktif. Periksa pekerjaan tersebut sebelum melanjutkan.",
    }, 409);
  }

  throw new Error(
    `Gagal membuat pekerjaan sinkronisasi: ${error.message}`,
  );
}

job = data as SyncJob;
}

const waitBeforeRequest = waitMsFromDate(job.next_allowed_at);

if (waitBeforeRequest > 0) {
return jsonResponse({
ok: true,
waiting: true,
done: false,
has_more: true,
job_id: job.id,
wait_ms: waitBeforeRequest,
message: `Menunggu jeda aman provider (${Math.ceil(waitBeforeRequest / 1000)} detik).`,
summary: jobSummary(job),
});
}

const claimToken = crypto.randomUUID();
const claimNow = new Date();

const leaseExpiry = new Date(
claimNow.getTime() + 120_000,
).toISOString();

const { data: claimedJob, error: claimError } = await db
.from("melostore_sync_jobs")
.update({
status: "running",
lease_token: claimToken,
lease_until: leaseExpiry,
updated_at: claimNow.toISOString(),
})
.eq("id", job.id)
.in("status", ["pending", "running", "paused"])
.or(`lease_until.is.null,lease_until.lt.${claimNow.toISOString()}`)
.select("*")
.maybeSingle();

if (claimError) {
throw new Error(
`Gagal mengunci pekerjaan sinkronisasi: ${claimError.message}`,
);
}

if (!claimedJob) {
const { data: busyJob } = await db
.from("melostore_sync_jobs")
.select("lease_until,status")
.eq("id", job.id)
.maybeSingle();

const waitMs = waitMsFromDate(busyJob?.lease_until) || 5_000;

return jsonResponse({
ok: true,
waiting: true,
done: false,
has_more: true,
job_id: job.id,
wait_ms: waitMs,
message: "Pekerjaan ini sedang diproses oleh permintaan lain. Menunggu giliran.",
summary: jobSummary(job),
});
}

job = claimedJob as SyncJob;
leasedJobId = job.id;
activeLeaseToken = claimToken;

const { data: gameRows, error: gamesError } = await db
.from("games")
.select("id,name,slug,publisher");

if (gamesError) {
throw new Error(
`Gagal membaca tabel games: ${gamesError.message}`,
);
}

const gamesBySlug = new Map<string, GameRow>();

for (const game of (gameRows ?? []) as GameRow[]) {
gamesBySlug.set(String(game.slug ?? "").toLowerCase(), game);
}

const requestStartedAt = new Date();
const url = new URL(PROVIDER_URL);

url.searchParams.set("limit", String(pageSize));

if (job.cursor) {
url.searchParams.set("cursor", job.cursor);
}

const providerResponse = await fetch(url.toString(), {
method: "GET",
headers: {
Accept: "application/json",
"X-API-Key": apiKey,
"X-Secret-Key": secretKey,
},
signal: AbortSignal.timeout(25_000),
});

const responseText = await providerResponse.text();
let providerData: any = null;

if (providerResponse.status === 429) {
const retryAfterHeader = Number(
providerResponse.headers.get("Retry-After") ?? "60",
);

const retrySeconds =
Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
? Math.min(retryAfterHeader, 300)
: 60;

const nextAllowed = new Date(
Date.now() + retrySeconds * 1000,
).toISOString();

const { data: updatedJob, error } = await db
  .from("melostore_sync_jobs")
  .update({
    next_allowed_at: nextAllowed,
    last_provider_request_at: requestStartedAt.toISOString(),
    updated_at: new Date().toISOString(),
    last_error: `Provider membatasi permintaan (HTTP 429); mencoba lagi setelah ${retrySeconds} detik.`,
  })
  .eq("id", job.id)
  .eq("lease_token", activeLeaseToken)
  .eq("status", "running")
  .gt("lease_until", new Date().toISOString())
  .select("id")
  .maybeSingle();

if (error) {
  console.error("Gagal mencatat jeda 429:", error.message);
  throw new Error(`Gagal mencatat jeda 429: ${error.message}`);
}

if (!updatedJob) {
  return jsonResponse({
    ok: false,
    waiting: false,
    done: false,
    job_id: job.id,
    message: "Lease tidak lagi valid; jeda HTTP 429 tidak diterapkan.",
  }, 409);
}

return jsonResponse({
ok: true,
waiting: true,
done: false,
has_more: true,
job_id: job.id,
wait_ms: retrySeconds * 1000,
message: `Melostore membatasi permintaan (HTTP 429). Melanjutkan setelah ${retrySeconds} detik.`,
summary: jobSummary(job),
});
}

try {
providerData = responseText ? JSON.parse(responseText) : {};
} catch {
const paused = await pauseJob(
  db,
  job.id,
  activeLeaseToken,
  "Respons Melostore bukan JSON yang valid.",
);

return jsonResponse({
  ok: false,
  job_id: job.id,
  paused,
  message: paused
    ? `Respons Melostore bukan JSON yang valid (HTTP ${providerResponse.status}); pekerjaan dijeda.`
    : `Respons Melostore bukan JSON yang valid (HTTP ${providerResponse.status}), tetapi pekerjaan tidak berhasil dijeda karena lease tidak lagi valid. Periksa status pekerjaan sebelum melanjutkan.`,
}, paused ? 502 : 409);
}

if (!providerResponse.ok) {
const message =
`Melostore menolak permintaan (HTTP ${providerResponse.status}): ` +
String(providerData?.message ?? "tanpa detail");

const paused = await pauseJob(db, job.id, activeLeaseToken, message);

return jsonResponse({
  ok: false,
  job_id: job.id,
  paused,
  message: paused
    ? `${message} Pekerjaan dijeda.`
    : `${message} Namun pekerjaan tidak berhasil dijeda karena lease tidak lagi valid; periksa status sebelum melanjutkan.`,
}, paused ? 502 : 409);
}

if (
!providerData ||
providerData.success !== true ||
!Array.isArray(providerData.data)
) {
const message =
`Respons pricelist Melostore tidak valid: ` +
String(providerData?.message ?? "format data tidak sesuai");

const paused = await pauseJob(db, job.id, activeLeaseToken, message);

return jsonResponse({
  ok: false,
  job_id: job.id,
  paused,
  message: paused
    ? `${message} Pekerjaan dijeda.`
    : `${message} Namun pekerjaan tidak berhasil dijeda karena lease tidak lagi valid; periksa status sebelum melanjutkan.`,
}, paused ? 502 : 409);
}

const rawItems = providerData.data as MelostoreProduct[];
const pagination = providerData.meta?.pagination ?? {};
const hasMore = pagination.has_more === true;

const nextCursor =
hasMore && pagination.next_cursor != null
? String(pagination.next_cursor)
: null;

if (hasMore && (!nextCursor || nextCursor === job.cursor)) {
const message =
"Melostore menyatakan masih ada halaman, tetapi cursor berikutnya kosong atau tidak berubah. Pekerjaan dijeda untuk mencegah loop.";

const paused = await pauseJob(db, job.id, activeLeaseToken, message);

return jsonResponse({
  ok: false,
  job_id: job.id,
  paused,
  message: paused
    ? `${message} Pekerjaan dijeda.`
    : `${message} Namun pekerjaan tidak berhasil dijeda karena lease tidak lagi valid; periksa status sebelum melanjutkan.`,
}, paused ? 502 : 409);
}
const mapped: Record<string, unknown>[] = [];
const seenSkus = new Set<string>();
let skippedCount = 0;

for (const item of rawItems) {
const sku = String(item.sku_code ?? "").trim();
const name = String(item.name ?? "").trim();
const providerStatus = normalizedProviderStatus(item.status);
const price = parsePrice(item.price);
const gameSlug = guessGameSlug(item);
const game = gameSlug
? gamesBySlug.get(gameSlug)
: undefined;

if (!sku || providerStatus === "unknown") {
skippedCount++;
continue;
}

const skuKey = sku.toLowerCase();

if (seenSkus.has(skuKey)) {
skippedCount++;
continue;
}

seenSkus.add(skuKey);

// Semua produk out_of_stock diteruskan ke SQL,
// meskipun harga atau mapping game tidak valid.
if (providerStatus === "out_of_stock") {
mapped.push({
sku,
provider_status: providerStatus,
cost_price: price === null ? "" : price,
});
continue;
}

// Produk active harus memiliki nama, harga positif,
// dan mapping game yang valid.
if (!name || price === null || price <= 0 || !game) {
skippedCount++;
continue;
}

const category =
String(item.type_name ?? item.category_name ?? "").trim() ||
null;

const description =
String(item.h2h_description ?? item.description ?? "").trim() ||
null;

mapped.push({
sku,
provider_status: providerStatus,
name,
game_id: game.id,
slug: `${slugPart(name) || "produk"}-${slugPart(sku) || crypto.randomUUID().slice(0, 8)}`,
category,
cost_price: price,
description,
selling_price_preview: calculateSellingPrice(price),
});
}
  
  // Perpanjang lease hanya jika lease lama masih berlaku.
const leaseCheckTime = new Date().toISOString();
const renewedUntil = new Date(Date.now() + 120_000).toISOString();

const {
  data: renewedLease,
  error: renewError,
} = await db
  .from("melostore_sync_jobs")
  .update({
    lease_until: renewedUntil,
  updated_at: new Date().toISOString(),
  })
  .eq("id", job.id)
  .eq("lease_token", activeLeaseToken)
  .gt("lease_until", leaseCheckTime)
  .select("id")
  .maybeSingle();

if (renewError) {
throw new Error(
`Gagal memperpanjang lease sinkronisasi: ${renewError.message}`,
);
}

if (!renewedLease) {
return jsonResponse({
ok: false,
message:
"Lease sinkronisasi tidak lagi valid. Halaman ini tidak diterapkan.",
}, 409);
}

const pageKey = job.cursor ? `cursor:${job.cursor}` : "first";
const total = intOr(
pagination.total ?? providerData.meta?.total,
0,
);

const {
data: applyResult,
error: applyError,
} = await db.rpc("melostore_apply_sync_page", {
p_job_id: job.id,
p_lease_token: activeLeaseToken,
p_page_key: pageKey,
p_products: mapped,
p_next_cursor: nextCursor,
p_has_more: hasMore,
p_total: total,
p_processed: rawItems.length,
p_skipped: skippedCount,
});

if (applyError) {
const message =
`Gagal menerapkan halaman pricelist: ${applyError.message}`;

const paused = await pauseJob(db, job.id, activeLeaseToken, message);

if (!paused) {

  console.error(

    "Pekerjaan tidak berhasil dijeda setelah RPC gagal; lease mungkin sudah tidak valid.",

    { jobId: job.id },

  );

}

return jsonResponse({
ok: false,
message,
job_id: job.id,
}, 500);
}

if (applyResult?.duplicate_page === true) {
  const duplicateNextAllowedAt = hasMore
    ? new Date(Date.now() + PROVIDER_DELAY_MS).toISOString()
    : null;
  const duplicateUpdateTime = new Date().toISOString();

  const {
    data: duplicateJob,
    error: duplicateRefreshError,
  } = await db
    .from("melostore_sync_jobs")
    .update({
      last_provider_request_at: requestStartedAt.toISOString(),
      next_allowed_at: duplicateNextAllowedAt,
      updated_at: duplicateUpdateTime,
      last_error: null,
    })
    .eq("id", job.id)
    .eq("lease_token", activeLeaseToken)
    .gt("lease_until", duplicateUpdateTime)
    .select("*")
    .maybeSingle();

  if (duplicateRefreshError) {
    throw new Error(
      `Gagal memperbarui metadata halaman duplikat: ${duplicateRefreshError.message}`,
    );
  }

  if (!duplicateJob) {
    return jsonResponse({
      ok: false,
      duplicate_page: true,
  job_id: job.id,
      message:
        "Halaman sudah diterapkan sebelumnya, tetapi metadata jeda tidak diperbarui karena lease tidak lagi valid. Periksa progres pekerjaan sebelum mencoba ulang.",
    }, 409);
  }

  return jsonResponse({
    ok: true,
    duplicate_page: true,
    job_id: job.id,
    wait_ms: waitMsFromDate(duplicateJob.next_allowed_at),
    summary: jobSummary(duplicateJob as SyncJob),
    message:
      "Halaman ini sudah pernah diproses; tidak diterapkan ulang.",
  });
}

const nextAllowedAt = hasMore
? new Date(Date.now() + PROVIDER_DELAY_MS).toISOString()
: null;

const {
data: refreshed,
error: refreshError,
} = await db
.from("melostore_sync_jobs")
.update({
last_provider_request_at: requestStartedAt.toISOString(),
next_allowed_at: nextAllowedAt,
updated_at: new Date().toISOString(),
last_error: null,
})
.eq("id", job.id)
.eq("lease_token", activeLeaseToken)
.gt("lease_until", new Date().toISOString())
.select("*")
.maybeSingle();

  if (refreshError) {
throw new Error(
`Gagal memperbarui status job: ${refreshError.message}`,
);
}

if (!refreshed) {
return jsonResponse({
ok: false,
job_id: job.id,
message: "Halaman sudah diterapkan oleh RPC, tetapi pembaruan metadata ditolak karena lease tidak lagi valid. Periksa progres pekerjaan sebelum mencoba ulang.",
}, 409);
}

const refreshedJob = refreshed as SyncJob;
const done =
refreshedJob.status === "completed" || !hasMore;

return jsonResponse({
ok: true,
waiting: false,
done,
has_more: !done,
job_id: job.id,
wait_ms: done ? 0 : PROVIDER_DELAY_MS,
message: done
? "Sinkronisasi pricelist Melostore selesai."
: `Halaman ${refreshedJob.pages_fetched} selesai; sinkronisasi akan dilanjutkan.`,
summary: jobSummary(refreshedJob),
providerMeta: providerData.meta ?? {},
page: {
received: rawItems.length,
valid: mapped.length,
skipped: skippedCount,
},
});
} catch (error) {
console.error("melostore-sync-pricelist error:", error);
if (leasedJobId && activeLeaseToken) {
const errorMessage = error instanceof Error
? error.message
: String(error);
const paused = await pauseJob(
  db,
  leasedJobId,
  activeLeaseToken,
  errorMessage,
);
if (!paused) {
  console.error(
    "Pekerjaan tidak berhasil dijeda setelah kesalahan; lease mungkin sudah tidak valid.",
    { jobId: leasedJobId },
  );
}
}

return jsonResponse({
ok: false,
message: error instanceof Error
? error.message
: "Terjadi kesalahan saat sinkronisasi.",
}, 500);
} finally {
if (leasedJobId && activeLeaseToken) {
const { error: releaseError } = await db
.from("melostore_sync_jobs")
.update({
lease_token: null,
lease_until: null,
updated_at: new Date().toISOString(),
})
.eq("id", leasedJobId)
.eq("lease_token", activeLeaseToken);

if (releaseError) {
console.error(
  "Gagal melepas lease sinkronisasi:",
releaseError.message,
);
}
}
}
});

function jobSummary(job: SyncJob) {
return {
jobId: job.id,
status: job.status,
pagesFetched: intOr(job.pages_fetched),
totalProducts: intOr(job.total_products),
processed: intOr(job.processed_products),
created: intOr(job.created_products),
updated: intOr(job.updated_products),
skipped: intOr(job.skipped_products),
failed: intOr(job.failed_products),
lastError: job.last_error,
};
}

async function pauseJob(
db: any,
jobId: string,
leaseToken: string,
message: string,
    ): Promise<boolean> {
const { data, error } = await db
.from("melostore_sync_jobs")
.update({
status: "paused",
last_error: message,
updated_at: new Date().toISOString(),
next_allowed_at: null,
})
.eq("id", jobId)
.eq("lease_token", leaseToken)
.eq("status", "running")
.gt("lease_until", new Date().toISOString())
.select("id")
.maybeSingle();

if (error) {
console.error(
"Gagal menjeda job sinkronisasi dengan lease guard:",
error.message,
);
return false;
}
return Boolean(data);
       }
