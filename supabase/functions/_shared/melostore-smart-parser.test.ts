import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseSmartProduct } from "./melostore-smart-parser.ts";

const validProduct = {
  name: "Contoh Produk Smart",
  brand_id: 10,
  category_name: "Games",
  type_name: "Diamonds",
  category_order: 1,
  type_order: 1,
  status: "active",
  inquiry_form_key: "example-form",
  h2h_description: null,
  description: null,
  smart_sku_code: "SMART-001",
  min_price: 10000,
  max_price: 12000,
  variant_count: 2,
  variants: [
    { sku_code: "VAR-001", price: 10000, status: "active" },
    { sku_code: "VAR-002", price: null, status: "out_of_stock" },
  ],
};

Deno.test("accepts documented Smart product shape", () => {
  const result = parseSmartProduct(validProduct);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.product.smart_sku_code, "SMART-001");
    assertEquals(result.product.brand_id, 10);
    assertEquals(result.product.variants.length, 2);
  }
});

Deno.test("rejects declared/actual variant count mismatch for manual review", () => {
  const result = parseSmartProduct({ ...validProduct, variant_count: 11 });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "variant_count_mismatch");
});

Deno.test("rejects missing Smart SKU", () => {
  const result = parseSmartProduct({ ...validProduct, smart_sku_code: " " });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "missing_smart_sku");
});

Deno.test("rejects missing required brand metadata", () => {
  const result = parseSmartProduct({ ...validProduct, brand_id: undefined });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "invalid_brand_id");
});

Deno.test("rejects missing variant SKU", () => {
  const result = parseSmartProduct({
    ...validProduct,
    variants: [{ price: 10000, status: "active" }],
    variant_count: 1,
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "missing_variant_sku");
});

Deno.test("rejects duplicate variant SKUs case-insensitively", () => {
  const result = parseSmartProduct({
    ...validProduct,
    variants: [
      { sku_code: "VAR-001", price: 10000, status: "active" },
      { sku_code: "var-001", price: 12000, status: "active" },
    ],
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "duplicate_variant_sku");
});

Deno.test("accepts integer prices and out-of-stock null prices", () => {
  const result = parseSmartProduct(validProduct);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.product.variants[0].price, 10000);
    assertEquals(result.product.variants[1].price, null);
  }
});

Deno.test("rejects decimal and negative variant prices", () => {
  for (const price of [10000.5, -1]) {
    const result = parseSmartProduct({
      ...validProduct,
      variant_count: 1,
      variants: [{ sku_code: "VAR-001", price, status: "active" }],
    });
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.code, "invalid_variant_price");
  }
});

Deno.test("accepts documented zero min/max and nullable active variant price", () => {
  const result = parseSmartProduct({
    ...validProduct,
    min_price: 0,
    max_price: 0,
    variant_count: 1,
    variants: [{ sku_code: "VAR-001", price: null, status: "active" }],
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.product.min_price, 0);
    assertEquals(result.product.max_price, 0);
    assertEquals(result.product.variants[0].price, null);
  }
});

Deno.test("rejects invalid min/max price range", () => {
  const result = parseSmartProduct({ ...validProduct, min_price: 15000, max_price: 12000 });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "invalid_max_price");
});

Deno.test("rejects unknown product or variant status", () => {
  const productResult = parseSmartProduct({ ...validProduct, status: "paused" });
  assertEquals(productResult.ok, false);
  if (!productResult.ok) assertEquals(productResult.code, "unknown_product_status");

  const variantResult = parseSmartProduct({
    ...validProduct,
    variants: [{ sku_code: "VAR-001", price: 10000, status: "paused" }],
    variant_count: 1,
  });
  assertEquals(variantResult.ok, false);
  if (!variantResult.ok) assertEquals(variantResult.code, "unknown_variant_status");
});
