import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/transactions/page.tsx", import.meta.url), "utf8");

test("transaction history resolves customer names and labels unassigned sales Walk-in", () => {
  assert.match(source, /api<\{ customers: Customer\[\] \}>\(\`\/customers\?store_id=\$\{storeId\}\`/);
  assert.match(source, /if \(customerId == null\) return "Walk-in"/);
  assert.match(source, /customersStoreId !== storeId/);
  assert.match(source, /customers\.find\(\(customer\) => customer\.id === customerId\)\?\.name/);
  assert.match(source, /if \(!storeId\) return;/);
  assert.doesNotMatch(source, /if \(!storeId\) \{ setCustomers\(\[\]\); return; \}/);
  assert.match(source, /"CUSTOMER"/);
  assert.doesNotMatch(source, /"Customer ID"/);
});

test("transaction CSV and PDF exports use customer display names rather than customer IDs", () => {
  assert.match(source, /"Date","Customer","Payment Method"/);
  assert.match(source, /customerName\(sale\.customer_id\)/);
  assert.match(source, /<th>Customer<\/th>/);
});
