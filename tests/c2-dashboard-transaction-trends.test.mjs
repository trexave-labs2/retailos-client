import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(resolve(root, path), "utf8");

test("dashboard transaction trends use real store-scoped server sales and product data", () => {
  const chart = source("components/dashboard/TransactionTrendsChart.tsx");
  assert.match(chart, /\/sales\?\$\{params\.toString\(\)\}/);
  assert.match(chart, /start_date: startDate/);
  assert.match(chart, /end_date: today/);
  assert.match(chart, /\/product\/list\?store_id=/);
  assert.match(chart, /item\.line_total/);
  assert.match(chart, /product\.product_type/);
  assert.doesNotMatch(chart, /Math\.random|mockData|dummyData/);
});

test("dashboard transaction trends provide a selectable range and selectable multi-series legend", () => {
  const chart = source("components/dashboard/TransactionTrendsChart.tsx");
  assert.match(chart, /7 days/);
  assert.match(chart, /30 days/);
  assert.match(chart, /90 days/);
  assert.match(chart, /type="checkbox"/);
  assert.match(chart, /setSelectedIds/);
  assert.match(chart, /polyline/);
  assert.match(chart, /series\.values/);
  assert.match(chart, /aria-label="Transaction trends time range"/);
  assert.match(chart, /Daily transaction value/);
});

test("dashboard transaction trends handle loading, empty, error, and retry states", () => {
  const chart = source("components/dashboard/TransactionTrendsChart.tsx");
  assert.match(chart, /Loading transaction trends/);
  assert.match(chart, /No product or service sales were recorded during this period/);
  assert.match(chart, /Transaction trends could not be loaded/);
  assert.match(chart, /Retry chart/);
});

test("dashboard renders the transaction trends chart as a dashboard section", () => {
  const page = source("components/dashboard/LiveDashboard.tsx");
  assert.match(page, /import TransactionTrendsChart from "@\/components\/dashboard\/TransactionTrendsChart"/);
  assert.match(page, /<TransactionTrendsChart \/>/);
});
