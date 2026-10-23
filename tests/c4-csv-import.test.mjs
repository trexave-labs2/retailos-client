import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../components/inventory/CsvImport.tsx", import.meta.url), "utf8");

test("CSV template uses the server's supported column names and product/service examples", () => {
  assert.match(source, /name,price,product_type,category_id,base_unit,opening_stock,low_stock_threshold,sku,barcode,cost_price/);
  assert.match(source, /Bottled Water 75cl,350,Physical/);
  assert.match(source, /Home delivery,1500,Service/);
  assert.match(source, /retailos-item-import-template\.csv/);
});

test("CSV upload sends the original file and store ID to the server import endpoint", () => {
  assert.match(source, /form\.append\("store_id", String\(storeId\)\)/);
  assert.match(source, /form\.append\("file", file\)/);
  assert.match(source, /api<ImportResult>\("\/product\/import"/);
  assert.match(source, /body: form/);
  assert.doesNotMatch(source, /api\("\/product\/create"/);
});

test("CSV import feedback uses server created/failed counts and row-level errors", () => {
  assert.match(source, /created_count: number/);
  assert.match(source, /failed_count: number/);
  assert.match(source, /result\.created_count/);
  assert.match(source, /result\.failed_count/);
  assert.match(source, /Rows rejected by the server/);
  assert.match(source, /item\.row/);
  assert.match(source, /item\.field/);
  assert.match(source, /item\.message/);
});

test("CSV upload validates file type and size and warns about uncertain outcomes", () => {
  assert.match(source, /endsWith\("\.csv"\)/);
  assert.match(source, /2 \* 1024 \* 1024/);
  assert.match(source, /refresh inventory before retrying/);
});
