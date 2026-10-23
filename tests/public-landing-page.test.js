import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const authProvider = await readFile(new URL("../components/auth/AuthProvider.tsx", import.meta.url), "utf8");
const landingPage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const pricingSection = await readFile(new URL("../components/landing/PricingSection.tsx", import.meta.url), "utf8");

test("root landing page is public and does not require session verification", () => {
  assert.match(authProvider, /PUBLIC_PATHS\s*=\s*\[\s*["']\/["']\s*,\s*["']\/login["']\s*,\s*["']\/register["']/);
  assert.match(authProvider, /if\s*\(isPublic\)\s*return/);
});

test("landing page communicates the product value and provides auth entry points", () => {
  assert.match(landingPage, /Run your shop with/);
  assert.match(landingPage, /organize products, track stock, record sales/);
  assert.match(landingPage, /href="\/register"/);
  assert.match(landingPage, /href="\/login"/);
  assert.match(landingPage, /LandingPricingSection/);
  assert.doesNotMatch(landingPage, /Public plan prices are not published/i);
});

test("public landing page displays server-backed Free and Pro pricing and limits", () => {
  assert.match(pricingSection, /api<PlanCatalogResponse>\("\/subscriptions\/plans"\)/);
  assert.match(pricingSection, /proPlan\.billing_options/);
  assert.match(pricingSection, /Usage limits/);
  assert.match(pricingSection, /Products/);
  assert.match(pricingSection, /Customers/);
  assert.match(pricingSection, /Sales per month/);
  assert.match(pricingSection, /staff accounts/i);
  assert.match(pricingSection, /paid billing is not yet configured/i);
  assert.match(pricingSection, /role="status"/);
  assert.match(pricingSection, /role="alert"/);
});


test("landing page includes honest product previews, offline guidance, FAQs, and support links", () => {
  assert.match(landingPage, /Product preview/);
  assert.match(landingPage, /not screenshots of live store data/);
  assert.match(landingPage, /Does RetailOS work offline\?/);
  assert.match(landingPage, /needs an internet connection to load and save store data/i);
  assert.match(landingPage, /Frequently asked questions/);
  assert.match(landingPage, /github\.com\/ENJ0Y-Labs\/retailos-client\/issues/);
});

test("signed-in shell reports offline status without claiming offline-first support", async () => {
  const shell = await readFile(new URL("../components/layout/DashboardShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /addEventListener\("offline"/);
  assert.match(shell, /addEventListener\("online"/);
  assert.match(shell, /role="status"/);
  assert.match(shell, /unsaved changes may be lost/i);
});

test("tour onboarding explains that only user-performed actions can change data", async () => {
  const welcome = await readFile(new URL("../components/tour/WelcomeDialog.tsx", import.meta.url), "utf8");
  const helpMenu = await readFile(new URL("../components/tour/HelpMenu.tsx", import.meta.url), "utf8");
  assert.match(welcome, /tour never clicks controls or submits forms/i);
  assert.match(welcome, /that action may change your data/i);
  assert.match(helpMenu, /Read FAQs and support options/);
});
