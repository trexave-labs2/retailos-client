import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const sales = readFileSync(new URL("../app/sales/page.tsx", import.meta.url), "utf8");
const debts = readFileSync(new URL("../app/debts/page.tsx", import.meta.url), "utf8");
const inventory = readFileSync(new URL("../app/inventory/page.tsx", import.meta.url), "utf8");
const transactions = readFileSync(new URL("../app/transactions/page.tsx", import.meta.url), "utf8");

test("checkout columns can shrink without forcing a 420px cart column on small screens", () => {
  assert.match(sales, /grid min-w-0 gap-6 lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,420px\)\]/);
  assert.match(sales, /data-tour="sales-cart" className="min-w-0 h-fit/);
});

test("debt, inventory, and transaction tables retain readable widths inside scroll regions", () => {
  assert.match(debts, /min-w-\[680px\] w-full text-left text-sm/);
  assert.match(inventory, /min-w-\[880px\] w-full text-left text-sm/);
  assert.match(transactions, /min-w-\[760px\] w-full text-left text-sm/);
  assert.match(css, /\.overflow-x-auto > table[\s\S]*?width:\s*max-content/);
  assert.match(css, /-webkit-overflow-scrolling:\s*touch/);
});

test("mobile table scrolling stays local and checkout cart does not become sticky on phones", () => {
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\[data-tour="sales-cart"\][\s\S]*?position:\s*static/);
  assert.match(css, /#main-content \.overflow-x-auto[\s\S]*?min-width:\s*0/);
});
