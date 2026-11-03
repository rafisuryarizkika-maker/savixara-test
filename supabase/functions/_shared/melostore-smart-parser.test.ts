import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseSmartProduct } from "./melostore-smart-parser.ts";

const validProduct = {
  name: "Contoh Produk Smart",
  smart_sku_code: "SMART-001",
  status: "active",
  variant_count: 2,
  variants: [
    { sku_code: "VAR-001", price: 10000, status: "active" },
    { sku_code: "VAR-002", price: null, status: "out_of_stock" },
  ],
};

Deno.test("accepts matching variant count and valid variants", () => {
  const result = parseSmartProduct(validProduct);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.product.smart_sku_code, "SMART-001");
    assertEquals(result.product.variants.length, 2);
  }
});

Deno.test("rejects declared/actual variant count mismatch", () => {
  const result = parseSmartProduct({
    ...validProduct,
    variant_count: 11,
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "variant_count_mismatch");
});

Deno.test("rejects missing Smart SKU", () => {
  const result = parseSmartProduct({ ...validProduct, smart_sku_code: " " });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "missing_smart_sku");
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
    variant_count: 2,
    variants: [
      { sku_code: "VAR-001", price: 10000, status: "active" },
      { sku_code: "var-001", price: 12000, status: "active" },
    ],
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "duplicate_variant_sku");
});

Deno.test("accepts numeric string prices and out-of-stock null prices", () => {
  const result = parseSmartProduct({
    ...validProduct,
    variant_count: 2,
    variants: [
      { sku_code: "VAR-001", price: "12500", status: "active" },
      { sku_code: "VAR-002", price: null, status: "out_of_stock" },
    ],
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.product.variants[0].price, 12500);
    assertEquals(result.product.variants[1].price, null);
  }
});

Deno.test("rejects active variants without a positive price", () => {
  const result = parseSmartProduct({
    ...validProduct,
    variant_count: 1,
    variants: [{ sku_code: "VAR-001", price: null, status: "active" }],
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "active_variant_without_price");
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
