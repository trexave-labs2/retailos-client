import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/layout/DashboardShell.tsx", import.meta.url), "utf8");
const theme = readFileSync(new URL("../components/theme/ThemeProvider.tsx", import.meta.url), "utf8");

test("mobile layout constrains content, wraps long text, and preserves local table scrolling", () => {
  assert.match(css, /#main-content[\s\S]*?min-width:\s*0/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /\.overflow-x-auto[\s\S]*?overscroll-behavior-x:\s*contain/);
  assert.match(css, /max-width:\s*100%/);
  assert.match(css, /@media \(max-width:\s*640px\)/);
});

test("mobile dashboard header reduces spacing and can compact the theme control on narrow screens", () => {
  assert.match(shell, /flex min-w-0 items-center gap-2[^"]*px-3[^"]*sm:gap-3/);
  assert.match(theme, /header-theme-toggle/);
  assert.match(css, /@media \(max-width:\s*360px\)[\s\S]*?header-theme-toggle/);
});
