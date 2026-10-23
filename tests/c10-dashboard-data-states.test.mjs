import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../components/dashboard/LiveDashboard.tsx", import.meta.url), "utf8");
const chart = readFileSync(new URL("../components/dashboard/TransactionTrendsChart.tsx", import.meta.url), "utf8");

test("dashboard shows a loading skeleton before rendering fetched metric values", () => {
  assert.match(dashboard, /loading \? \([\s\S]*?<DashboardSkeleton \/>/);
  assert.match(dashboard, /function DashboardSkeleton\(\)/);
  assert.match(dashboard, /aria-busy="true"/);
});

test("first-day guidance only appears when successful sales data and summary counts agree there is no activity", () => {
  assert.match(dashboard, /const firstDay = !salesError && sales\.length === 0 && stats\.products_count === 0 && Number\(stats\.today_sales_count\) === 0 && Number\(stats\.today_sales_total\) === 0/);
  assert.match(dashboard, /Your store is ready for its first records/);
  assert.match(dashboard, /figures below reflect saved records, not estimates or loading placeholders/);
  assert.match(dashboard, /href="\/inventory"[^>]*>Add a product/);
  assert.match(dashboard, /href="\/sales"[^>]*>Record a sale/);
  assert.match(dashboard, /firstDay \? "No sales yet" : stats\.today_sales_count/);
});

test("a failed recent-sales request is not silently converted into an empty sales list", () => {
  assert.match(dashboard, /if \(salesResult\.status === "fulfilled"\)[\s\S]*?setSales\(salesResult\.value\.sales \?\? \[\]\)[\s\S]*?else \{[\s\S]*?setSalesError/);
  assert.match(dashboard, /Recent sales could not be loaded, so an empty list cannot be confirmed/);
  assert.match(dashboard, /Retry sales/);
});

test("dashboard chart and rankings retain explicit loading, error, empty, and retry feedback", () => {
  assert.match(chart, /Loading transaction trends/);
  assert.match(chart, /Transaction trends could not be loaded/);
  assert.match(chart, /No product or service sales were recorded during this period/);
  assert.match(chart, /Retry chart/);
  assert.match(dashboard, /Loading product and service rankings/);
  assert.match(dashboard, /Rankings could not be loaded/);
  assert.match(dashboard, /No physical product units were sold in this reporting period/);
  assert.match(dashboard, /Retry rankings/);
});
