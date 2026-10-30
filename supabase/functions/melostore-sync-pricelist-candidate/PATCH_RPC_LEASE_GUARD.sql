-- CANDIDATE PATCH ONLY. Review and test on a separate test project before applying.
-- Source 9-arg function MD5: c5d38c4ca588c49209d1fdf79c8dae52
-- This file is not automatically applied to any database.

CREATE OR REPLACE FUNCTION public.melostore_apply_sync_page(p_job_id uuid, p_lease_token uuid, p_page_key text, p_products jsonb, p_next_cursor text, p_has_more boolean, p_total integer, p_processed integer, p_skipped integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
item jsonb;
inserted_new boolean;
created_count integer := 0;
updated_count integer := 0;
job_status text;
current_lease_token uuid;
current_lease_until timestamptz;
item_cost numeric;
item_selling numeric;
item_provider_status text;
item_active boolean;
extra_skipped integer := 0;
item_sku text;
item_cost_text text;
item_slug text;
BEGIN
IF p_lease_token IS NULL THEN
RAISE EXCEPTION 'Token penguncian wajib diisi';
END IF;

IF p_page_key IS NULL OR length(trim(p_page_key)) = 0 THEN
RAISE EXCEPTION 'Identitas halaman wajib diisi';
END IF;

IF p_products IS NULL
OR jsonb_typeof(p_products) <> 'array'
OR jsonb_array_length(p_products) > 500 THEN
RAISE EXCEPTION 'Produk harus berupa array maksimal 500 item';
END IF;

IF COALESCE(p_total, -1) < 0
OR COALESCE(p_processed, -1) < 0
OR COALESCE(p_skipped, -1) < 0 THEN
RAISE EXCEPTION 'Jumlah produk tidak boleh negatif';
END IF;

-- Edge Function: processed = jumlah rawItems; skipped = item yang tidak masuk mapped.
-- Maka mapped + skipped harus sama dengan jumlah item provider yang diterima.
IF p_skipped > p_processed
OR jsonb_array_length(p_products) + p_skipped <> p_processed THEN
RAISE EXCEPTION
'Jumlah produk valid dan dilewati tidak cocok dengan jumlah produk yang diterima';
END IF;

SELECT status, lease_token, lease_until
INTO job_status, current_lease_token, current_lease_until
FROM public.melostore_sync_jobs
WHERE id = p_job_id
FOR UPDATE;

IF NOT FOUND THEN
RAISE EXCEPTION 'Pekerjaan sinkronisasi tidak ditemukan';
END IF;

IF current_lease_token IS DISTINCT FROM p_lease_token THEN
RAISE EXCEPTION 'Token penguncian tidak valid atau sudah kedaluwarsa';
END IF;

IF current_lease_until IS NULL OR current_lease_until <= clock_timestamp() THEN
RAISE EXCEPTION 'Lease penguncian sudah kedaluwarsa';
END IF;

IF job_status <> 'running' THEN
RAISE EXCEPTION 'Pekerjaan tidak dapat dilanjutkan';
END IF;

INSERT INTO public.melostore_sync_pages(
job_id, page_key, next_cursor, product_count
)
VALUES (p_job_id, p_page_key, p_next_cursor, p_processed)
ON CONFLICT (job_id, page_key) DO NOTHING;

IF NOT FOUND THEN
RETURN jsonb_build_object(
'ok', true,
'duplicate_page', true,
'message', 'Halaman ini sudah diproses; progres tidak ditambah.'
);
END IF;

FOR item IN SELECT value FROM jsonb_array_elements(p_products)
LOOP
item_sku := NULLIF(trim(item->>'sku'), '');
item_provider_status := lower(trim(COALESCE(item->>'provider_status', '')));
item_cost_text := COALESCE(item->>'cost_price', '');

IF item_sku IS NULL THEN
RAISE EXCEPTION 'SKU produk wajib diisi';
END IF;

IF item_provider_status NOT IN ('active', 'out_of_stock') THEN
RAISE EXCEPTION 'Status provider tidak valid untuk SKU %', item_sku;
END IF;

-- File TypeScript mengirim sebagian item out_of_stock dengan game_id/harga NULL.
-- Semua out_of_stock hanya menonaktifkan SKU lama; harga tidak diubah dan SKU baru tidak dibuat.
IF item_provider_status = 'out_of_stock' THEN
UPDATE public.products
SET status = false,
updated_at = now()
WHERE provider = 'Melostore'
AND provider_product_code = item_sku;

IF FOUND THEN
updated_count := updated_count + 1;
ELSE
extra_skipped := extra_skipped + 1;
END IF;

CONTINUE;
END IF;

-- Item active harus punya nama, game UUID, slug, dan harga positif yang valid.
IF NULLIF(trim(item->>'name'), '') IS NULL
OR NULLIF(trim(item->>'game_id'), '') IS NULL
OR NULLIF(trim(item->>'slug'), '') IS NULL
OR item_cost_text !~ '^[0-9]+(\.[0-9]+)?$' THEN
RAISE EXCEPTION
'Nama, game, slug, atau harga modal tidak valid untuk SKU %',
item_sku;
END IF;

item_cost := item_cost_text::numeric;

IF item_cost <= 0 THEN
RAISE EXCEPTION 'Harga modal harus lebih besar dari nol untuk SKU %', item_sku;
END IF;

-- Harga jual tidak dihitung/diubah oleh sinkronisasi.
-- Harga jual ditentukan manual melalui panel admin setelah sinkronisasi.
item_selling := 0;
item_active := false;
item_slug := trim(item->>'slug');

-- Hindari kegagalan seluruh halaman jika slug dipakai produk lain.
-- SKU yang sama dikecualikan agar produk yang sedang diperbarui boleh mempertahankan slug-nya.
IF EXISTS (
SELECT 1
FROM public.products existing
WHERE existing.slug = item_slug
AND NOT (
existing.provider = 'Melostore'
AND existing.provider_product_code = item_sku
)
) THEN
extra_skipped := extra_skipped + 1;
CONTINUE;
END IF;

-- Tangani benturan unik yang tetap bisa terjadi karena proses bersamaan.
-- Jika slug atau constraint unik lain bentrok, batalkan hanya operasi SKU ini,
-- bukan seluruh halaman sinkronisasi.
BEGIN
INSERT INTO public.products(
game_id, name, slug, category, provider, provider_product_code,
cost_price, selling_price, promo_price, description, status,
sort_order, category_id
)
VALUES (
(item->>'game_id')::uuid,
trim(item->>'name'),
item_slug,
NULLIF(trim(item->>'category'), ''),
'Melostore',
item_sku,
item_cost,
0,
NULL,
NULLIF(trim(item->>'description'), ''),
false,
0,
NULL
)
ON CONFLICT (provider, provider_product_code)
WHERE provider_product_code IS NOT NULL
DO UPDATE SET
game_id = EXCLUDED.game_id,
name = EXCLUDED.name,
slug = EXCLUDED.slug,
category = EXCLUDED.category,
cost_price = EXCLUDED.cost_price,
-- Pertahankan selling_price, promo_price, dan status manual produk lama.
description = EXCLUDED.description,
-- Status hanya diubah oleh admin atau jalur khusus out_of_stock.
updated_at = now()
RETURNING (xmax = 0) INTO inserted_new;

IF inserted_new THEN
created_count := created_count + 1;
ELSE
updated_count := updated_count + 1;
END IF;
EXCEPTION
WHEN unique_violation THEN
-- Tetap lanjutkan halaman; hitung SKU ini sebagai dilewati.
extra_skipped := extra_skipped + 1;
CONTINUE;
END;
END LOOP;

UPDATE public.melostore_sync_jobs
SET status = CASE WHEN p_has_more THEN 'running' ELSE 'completed' END,
cursor = CASE WHEN p_has_more THEN p_next_cursor ELSE NULL END,
pages_fetched = pages_fetched + 1,
total_products = GREATEST(total_products, p_total),
processed_products = processed_products + p_processed,
created_products = created_products + created_count,
updated_products = updated_products + updated_count,
skipped_products = skipped_products + p_skipped + extra_skipped,
last_error = NULL,
updated_at = now(),
completed_at = CASE WHEN p_has_more THEN NULL ELSE now() END
WHERE id = p_job_id
AND lease_token = p_lease_token
AND lease_until > clock_timestamp();

IF NOT FOUND THEN
RAISE EXCEPTION 'Lease berubah atau kedaluwarsa sebelum progres disimpan';
END IF;

RETURN jsonb_build_object(
'ok', true,
'duplicate_page', false,
'created', created_count,
'updated', updated_count,
'skipped_extra', extra_skipped,
'has_more', p_has_more
);
END;
$function$;

CREATE OR REPLACE FUNCTION public.melostore_apply_sync_page(
p_job_id uuid,
p_page_key text,
p_products jsonb,
p_next_cursor text,
p_has_more boolean,
p_total integer,
p_processed integer,
p_skipped integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $wrapper$
DECLARE
current_lease_token uuid;
current_lease_until timestamptz;
job_status text;
BEGIN
SELECT status, lease_token, lease_until
INTO job_status, current_lease_token, current_lease_until
FROM public.melostore_sync_jobs
WHERE id = p_job_id
FOR UPDATE;

IF NOT FOUND THEN
RAISE EXCEPTION 'Pekerjaan sinkronisasi tidak ditemukan';
END IF;

IF job_status <> 'running' THEN
RAISE EXCEPTION 'Pekerjaan tidak dapat dilanjutkan';
END IF;

IF current_lease_token IS NULL THEN
RAISE EXCEPTION 'Token penguncian tidak tersedia';
END IF;

IF current_lease_until IS NULL OR current_lease_until <= clock_timestamp() THEN
RAISE EXCEPTION 'Lease penguncian sudah kedaluwarsa';
END IF;

RETURN public.melostore_apply_sync_page(
p_job_id,
current_lease_token,
p_page_key,
p_products,
p_next_cursor,
p_has_more,
p_total,
p_processed,
p_skipped
);
END;
$wrapper$;
