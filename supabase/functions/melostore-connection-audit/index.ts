import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateMelostoreRequest,
  withCorsHeaders,
} from "./_shared/melostore-http-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://rafisuryarizkika-maker.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: "Gunakan metode POST." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = req.headers.get("apikey") ?? "";

  if (!supabaseUrl || !anonKey) {
    return jsonResponse({
      ok: false,
      message: "Konfigurasi autentikasi Supabase tidak tersedia.",
    }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: req.headers.get("Authorization") ?? "" },
    },
  });

  const authResult = await authenticateMelostoreRequest(req, {
    getUser: async (accessToken) => {
      const { data, error } = await userClient.auth.getUser(accessToken);
      return { user: data.user, error };
    },
    getClaims: async (accessToken) => {
      const { data, error } = await userClient.auth.getClaims(accessToken);
      return { claims: data?.claims ?? null, error };
    },
    isAdmin: async () => {
      const { data, error } = await userClient.rpc("is_admin");
      return { value: data, error };
    },
  });

  if (!authResult.ok) {
    return withCorsHeaders(authResult.response, corsHeaders);
  }

  const apiKey = Deno.env.get("MELOSTORE_API_KEY");
  const secretKey = Deno.env.get("MELOSTORE_SECRET_KEY");

  if (!apiKey || !secretKey) {
    return jsonResponse({
      ok: false,
      message: "Secret Melostore belum lengkap pada proyek tes.",
    }, 500);
  }

  let providerResponse: Response;
  try {
    providerResponse = await fetch("https://api.melostore.id/api/v1/h2h/profile", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Key": apiKey,
        "X-Secret-Key": secretKey,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return jsonResponse({
      ok: false,
      provider_checked: true,
      message: "Tidak dapat terhubung ke endpoint profil Melostore.",
    }, 502);
  }

  let providerPayload: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await providerResponse.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      providerPayload = parsed as Record<string, unknown>;
    }
  } catch {
    return jsonResponse({
      ok: false,
      provider_checked: true,
      provider_http_status: providerResponse.status,
      message: "Respons profil Melostore bukan JSON yang valid.",
    }, 502);
  }

  if (!providerResponse.ok || providerPayload?.success !== true) {
    return jsonResponse({
      ok: false,
      provider_checked: true,
      provider_http_status: providerResponse.status,
      message: "Melostore belum mengonfirmasi autentikasi kredensial. Periksa mode akun dan kredensial di dashboard.",
    }, 502);
  }

  const profile = providerPayload.data && typeof providerPayload.data === "object"
    ? providerPayload.data as Record<string, unknown>
    : {};

  const accountMode = profile.is_sandbox_mode === true
    ? "sandbox"
    : profile.is_sandbox_mode === false
    ? "production"
    : "unknown";

  return jsonResponse({
    ok: true,
    provider_checked: true,
    provider_http_status: providerResponse.status,
    provider_authenticated: true,
    account_mode: accountMode,
    message: "Koneksi dan autentikasi Melostore berhasil. Tidak ada pesanan atau perubahan katalog yang dilakukan.",
  });
});
