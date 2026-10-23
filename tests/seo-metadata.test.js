import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("root metadata describes RetailOS and configures Open Graph and Twitter cards", async () => {
  const source = await read("../app/layout.tsx");
  assert.match(source, /Manage products, track stock, record sales/);
  assert.match(source, /openGraph:/);
  assert.match(source, /siteName/);
  assert.match(source, /twitter:/);
  assert.match(source, /card:\s*"summary_large_image"/);
  assert.match(source, /title: "TX RetailOS \| Retail and Stock Management"/);
});

test("public auth routes have distinct titles and are excluded from indexing", async () => {
  const login = await read("../app/login/layout.tsx");
  const register = await read("../app/register/layout.tsx");
  assert.match(login, /title:\s*"Sign in"/);
  assert.match(login, /index:\s*false/);
  assert.match(register, /title:\s*"Create an account"/);
  assert.match(register, /index:\s*false/);
});

test("main application routes have distinct titles and are excluded from indexing", async () => {
  for (const [path, title] of [
    ["../app/dashboard/layout.tsx", "Dashboard"],
    ["../app/sales/layout.tsx", "Sales"],
    ["../app/customers/layout.tsx", "Customers"],
    ["../app/settings/layout.tsx", "Settings"],
  ]) {
    const source = await read(path);
    assert.match(source, new RegExp('title:\\s*"' + title + '"'));
    assert.match(source, /index:\s*false/);
  }
});

test("branding assets are registered and used across public and authenticated entry points", async () => {
  const layout = await read("../app/layout.tsx");
  const landing = await read("../app/page.tsx");
  const login = await read("../app/login/page.tsx");
  const register = await read("../app/register/page.tsx");
  const shell = await read("../components/layout/DashboardShell.tsx");
  const brand = await read("../components/brand/BrandMark.tsx");
  const css = await read("../app/globals.css");

  assert.ok(layout.includes('"/favicon.ico"'));
  assert.ok(layout.includes('"/icon.png"'));
  assert.ok(layout.includes('"/apple-icon.png"'));
  assert.ok(layout.includes('url: "/og-image.png"'));
  assert.ok(brand.includes('/brand/logo-light.svg'));
  assert.ok(brand.includes('/brand/logo-dark.svg'));
  assert.ok(css.includes('html[data-theme="light"] .brand-mark-dark'));
  for (const source of [landing, login, register, shell]) {
    assert.ok(source.includes("BrandMark"));
  }
});
