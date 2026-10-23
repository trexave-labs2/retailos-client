import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../components/inventory/CsvImport.tsx", import.meta.url), "utf8");

test("CSV import uses the supported server multipart endpoint and contract fields", () => {
  for (const expected of [
    "/product/import",
    'form.append("store_id", String(storeId))',
    'form.append("file", file)',
    "product_type",
    "category_id",
    "base_unit",
    "opening_stock",
    "low_stock_threshold",
    "sku",
    "barcode",
    "cost_price",
  ]) {
    assert.ok(source.includes(expected), "Missing CSV contract detail: " + expected);
  }
});

test("CSV import shows server counts and row validation feedback", () => {
  assert.match(source, /created_count/);
  assert.match(source, /failed_count/);
  assert.match(source, /Rows rejected by the server/);
  assert.match(source, /rowErrors\.map/);
  assert.match(source, /field\.replace\(\/_\/g, " "\)/);
});
