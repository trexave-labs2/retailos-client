import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("theme preference is persisted and applied to the document root", () => {
  const provider = read("../components/theme/ThemeProvider.tsx");
  const layout = read("../app/layout.tsx");

  assert.match(provider, /retailos:theme:v1/);
  assert.match(provider, /localStorage\.getItem/);
  assert.match(provider, /localStorage\.setItem/);
  assert.match(provider, /document\.documentElement\.dataset\.theme = theme/);
  assert.match(provider, /useEffect\(\(\) => \{/);
  assert.match(provider, /document\.documentElement\.style\.colorScheme = theme/);
  assert.match(layout, /savedTheme === "light" \|\| savedTheme === "dark"/);
});

test("theme switch is available in the authenticated shell and auth screens", () => {
  const shell = read("../components/layout/DashboardShell.tsx");
  const login = read("../app/login/page.tsx");
  const register = read("../app/register/page.tsx");

  assert.match(shell, /<ThemeToggle compact \/>/);
  assert.match(login, /<ThemeToggle compact \/>/);
  assert.match(register, /<ThemeToggle compact \/>/);
});

test("light palette covers core surfaces, controls, states, and active navigation", () => {
  const css = read("../app/globals.css");

  for (const expected of [
    'html[data-theme="light"]',
    "--app-bg: #f6f5f2",
    "--accent: #c2410c",
    '[class*="bg-[#0b0b0b]"]',
    '[class*="text-white/"]',
    "select option",
    "[role=\"dialog\"]",
    "nav a[aria-current=\"page\"]",
    "button:disabled",
    ":focus-visible",
  ]) {
    assert.ok(css.includes(expected), `Missing theme contract: ${expected}`);
  }

  assert.ok(css.includes('html[data-theme="light"] [class*="bg-black/"]'));
  assert.ok(css.includes('html[data-theme="light"] [class*="hover:bg-white/"]'));
});
