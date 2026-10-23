import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../components/inventory/CsvImport.tsx", import.meta.url), "utf8");

test("CSV template includes product and service examples with an item type column", () => {
  assert.match(source, /Item type,Product name,Selling price,Opening stock/);
  assert.match(source, /Product,Bottled Water 75cl/);
  assert.match(source, /Service,Home delivery/);
  assert.match(source, /retailos-item-import-template\.csv/);
});

test("CSV import accepts service aliases and does not require service stock", () => {
  assert.match(source, /"item type": "productType"/);
  assert.match(source, /"product type": "productType"/);
  assert.match(source, /\["service", "services"\]/);
  assert.match(source, /productType === "Physical" && \(!Number\.isInteger\(stockNumber\)/);
  assert.match(source, /Services do not track stock/);
  assert.match(source, /row\.productType === "Physical" \? \{ opening_stock: row\.stock, low_stock_threshold: 0 \} : \{\}/);
});

test("CSV import surfaces structured server validation errors and result counts", () => {
  assert.match(source, /cause instanceof ApiError/);
  assert.match(source, /cause\.fields/);
  assert.match(source, /cause\.code/);
  assert.match(source, /row\.rowNumber \+ " \(" \+ row\.name \+ "\): " \+ serverErrorMessage\(e\)/);
  assert.match(source, /item\(s\) imported: " \+ importedProducts \+ " product\(s\), " \+ importedServices \+ " service\(s\)/);
  assert.match(source, /row\(s\) rejected or failed by the server/);
});
