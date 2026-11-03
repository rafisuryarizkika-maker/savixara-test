export type SmartVariantStatus = "active" | "out_of_stock";

export type ParsedSmartVariant = {
  sku_code: string;
  price: number | null;
  status: SmartVariantStatus;
};

export type ParsedSmartProduct = {
  name: string;
  brand_id: number;
  category_name: string;
  type_name: string;
  category_order: number;
  type_order: number;
  status: SmartVariantStatus;
  inquiry_form_key: string;
  h2h_description: string | null;
  description: string | null;
  smart_sku_code: string;
  min_price: number;
  max_price: number;
  variants: ParsedSmartVariant[];
};

export type SmartParseResult =
  | { ok: true; product: ParsedSmartProduct }
  | { ok: false; code: string; message: string };

function fail(code: string, message: string): SmartParseResult {
  return { ok: false, code, message };
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function normalizeStatus(value: unknown): SmartVariantStatus | null {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  return status === "active" || status === "out_of_stock" ? status : null;
}

function parsePrice(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  return undefined;
}

/**
 * Pure Smart Pricelist parser based on the documented compact response.
 * It performs no network, database, or provider operations.
 * Count mismatches and incomplete required fields are rejected for review.
 */
export function parseSmartProduct(input: unknown): SmartParseResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("invalid_product", "Produk Smart harus berupa objek.");
  }

  const item = input as Record<string, unknown>;
  const name = nonEmptyString(item.name);
  const smartSku = nonEmptyString(item.smart_sku_code);
  const brandId = positiveInteger(item.brand_id);
  const categoryName = nonEmptyString(item.category_name);
  const typeName = nonEmptyString(item.type_name);
  const categoryOrder = nonNegativeInteger(item.category_order);
  const typeOrder = nonNegativeInteger(item.type_order);
  const inquiryFormKey = nonEmptyString(item.inquiry_form_key);
  const h2hDescription = nullableString(item.h2h_description);
  const description = nullableString(item.description);
  const minPrice = positiveInteger(item.min_price);
  const maxPrice = positiveInteger(item.max_price);

  if (!name) return fail("missing_name", "Nama produk Smart kosong.");
  if (!smartSku) return fail("missing_smart_sku", "smart_sku_code kosong.");
  if (brandId === null) return fail("invalid_brand_id", "brand_id tidak valid.");
  if (!categoryName) return fail("missing_category_name", "category_name kosong.");
  if (!typeName) return fail("missing_type_name", "type_name kosong.");
  if (categoryOrder === null) return fail("invalid_category_order", "category_order tidak valid.");
  if (typeOrder === null) return fail("invalid_type_order", "type_order tidak valid.");
  if (!inquiryFormKey) return fail("missing_inquiry_form_key", "inquiry_form_key kosong.");
  if (h2hDescription === undefined) return fail("invalid_h2h_description", "h2h_description harus string atau null.");
  if (description === undefined) return fail("invalid_description", "description harus string atau null.");
  if (minPrice === null) return fail("invalid_min_price", "min_price harus bilangan bulat positif.");
  if (maxPrice === null || maxPrice < minPrice) {
    return fail("invalid_max_price", "max_price tidak valid atau lebih kecil dari min_price.");
  }

  const productStatus = normalizeStatus(item.status);
  if (!productStatus) return fail("unknown_product_status", "Status produk Smart tidak dikenal.");

  if (!Number.isSafeInteger(item.variant_count) || (item.variant_count as number) < 0) {
    return fail("invalid_variant_count", "variant_count tidak valid.");
  }
  if (!Array.isArray(item.variants)) return fail("missing_variants", "variants bukan array.");
  if (item.variant_count !== item.variants.length) {
    return fail(
      "variant_count_mismatch",
      `variant_count (${String(item.variant_count)}) tidak sama dengan jumlah variants (${item.variants.length}).`,
    );
  }
  if (item.variants.length === 0) return fail("empty_variants", "Produk Smart tidak memiliki varian.");

  const seen = new Set<string>();
  const variants: ParsedSmartVariant[] = [];

  for (let index = 0; index < item.variants.length; index++) {
    const raw = item.variants[index];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return fail("invalid_variant", `Varian ke-${index + 1} bukan objek.`);
    }

    const variant = raw as Record<string, unknown>;
    const sku = nonEmptyString(variant.sku_code);
    if (!sku) return fail("missing_variant_sku", `SKU varian ke-${index + 1} kosong.`);

    const key = sku.toLowerCase();
    if (seen.has(key)) return fail("duplicate_variant_sku", `SKU varian duplikat: ${sku}.`);
    seen.add(key);

    const status = normalizeStatus(variant.status);
    if (!status) return fail("unknown_variant_status", `Status varian ke-${index + 1} tidak dikenal.`);

    const price = parsePrice(variant.price);
    if (price === undefined) return fail("invalid_variant_price", `Harga varian ke-${index + 1} harus integer atau null.`);
    if (status === "active" && (price === null || price <= 0)) {
      return fail("active_variant_without_price", `Varian aktif ke-${index + 1} harus memiliki harga positif.`);
    }

    variants.push({ sku_code: sku, price, status });
  }

  return {
    ok: true,
    product: {
      name,
      brand_id: brandId,
      category_name: categoryName,
      type_name: typeName,
      category_order: categoryOrder,
      type_order: typeOrder,
      status: productStatus,
      inquiry_form_key: inquiryFormKey,
      h2h_description: h2hDescription,
      description,
      smart_sku_code: smartSku,
      min_price: minPrice,
      max_price: maxPrice,
      variants,
    },
  };
}
