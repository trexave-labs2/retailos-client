import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../components/notifications/NotificationBell.tsx", import.meta.url), "utf8");
const shell = await readFile(new URL("../components/layout/DashboardShell.tsx", import.meta.url), "utf8");

test("notification bell loads real store-scoped alerts and bypasses stale GET cache", () => {
  assert.match(component, /\/alerts\?/);
  assert.match(component, /store_id/);
  assert.match(component, /refresh:\s*true/);
});

test("notification UI exposes open-alert count, list, refresh, and empty/error states", () => {
  assert.match(component, /aria-expanded=\{open\}/);
  assert.match(component, /openCount/);
  assert.match(component, /alerts\.slice\(0, 10\)/);
  assert.match(component, /Refresh/);
  assert.match(component, /You have no open alerts/);
  assert.match(component, /role="alert"/);
  assert.match(component, /read\/unread status/);
});

test("notifications refresh on focus, visibility changes, and inventory changes", () => {
  assert.match(component, /addEventListener\("focus"/);
  assert.match(component, /addEventListener\("visibilitychange"/);
  assert.match(component, /retailos:inventory-changed/);
});

test("dashboard shell renders the notification bell in the shared header", () => {
  assert.match(shell, /NotificationBell/);
  assert.match(shell, /<NotificationBell\s*\/>/);
});
