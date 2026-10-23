import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const importer = readFileSync(new URL("../components/inventory/CsvImport.tsx", import.meta.url), "utf8");
const inventory = readFileSync(new URL("../app/inventory/page.tsx", import.meta.url), "utf8");

test("CSV import is optional and placed after manual product entry", () => {
  assert.match(inventory, /<CsvImport storeId={storeId} onImported={loadProducts}\s*\/>/);
  assert.ok(inventory.indexOf("</form>") < inventory.indexOf("<CsvImport"));
});

test("CSV importer provides template and required-field validation", () => {
  assert.match(importer, /Download CSV template/);
  assert.match(importer, /Product name,Selling price,Opening stock,SKU or barcode,Category,Cost price/);
  assert.match(importer, /Missing required column/);
  assert.match(importer, /Selling price must be a number greater than 0/);
  assert.match(importer, /Opening stock for a product must be a whole number that is 0 or greater/);
  assert.match(importer, /Duplicate SKU\/barcode in this CSV/);
});

test("CSV import previews row errors and imports only valid records", () => {
  assert.match(importer, /Preview: \{parsed\.rows\.length\} row\(s\)/);
  assert.match(importer, /Import valid rows/);
  assert.match(importer, /row\.errors\.length === 0/);
  assert.match(importer, /An item with this name already exists in your store/);
});

test("CSV retry checks the live catalogue and discloses unsupported metadata", () => {
  assert.match(importer, /_import_check=/);
  assert.match(importer, /current\.products\.some/);
  assert.match(importer, /current server API/);
  assert.match(importer, /Already present in your store; will not be imported again/);
});
