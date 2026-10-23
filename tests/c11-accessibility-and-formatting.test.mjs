import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const styles = read("../app/globals.css");
const transactions = read("../app/transactions/page.tsx");
const sales = read("../app/sales/page.tsx");
const inventory = read("../app/inventory/page.tsx");
const debts = read("../app/debts/page.tsx");

test("interactive controls have a minimum touch target and keyboard focus remains visible", () => {
  assert.match(styles, /button,\s*\[role="button"\]\s*\{\s*min-height:\s*44px/);
  assert.match(styles, /\.field,[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /:focus-visible/);
});

test("quantities use numeric keyboards and money inputs use decimal keyboards", () => {
  assert.match(sales, /inputMode="numeric"/);
  assert.match(sales, /inputMode="decimal"/);
  assert.match(inventory, /inputMode="numeric"/);
  assert.match(inventory, /inputMode="decimal"/);
  assert.match(debts, /inputMode="decimal"/);
  assert.match(transactions, /inputMode="decimal"/);
});

test("transaction filters have accessible names and a single-column phone layout", () => {
  assert.match(transactions, /aria-label="Search transactions"/);
  assert.match(transactions, /aria-label="Filter start date"/);
  assert.match(transactions, /aria-label="Filter end date"/);
  assert.match(transactions, /grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4/);
  assert.match(transactions, /min-w-\[112px\][\s\S]*?Clear Filters/);
});

test("transaction date chips use Nigeria-localized date formatting and currency remains Nigerian naira", () => {
  assert.match(transactions, /formatNigeriaDate\(startDate \+ "T12:00:00\+01:00"\)/);
  assert.match(transactions, /formatNigeriaDate\(endDate \+ "T12:00:00\+01:00"\)/);
  for (const source of [transactions, sales, debts]) {
    assert.match(source, /toLocaleString\("en-NG"/);
    assert.match(source, /"₦"\s*\+/);
  }
});
