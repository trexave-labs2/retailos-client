import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/transactions/page.tsx", import.meta.url), "utf8");

test("transaction exports are disabled while transactions load or no visible records exist", () => {
  assert.equal((source.match(/disabled={exporting !== null \|\| loading \|\| visibleRows\.length === 0}/g) ?? []).length, 2);
});

test("export handler also refuses to export while loading or with no visible records", () => {
  assert.match(source, /if \(!storeId \|\| loading \|\| visibleRows\.length === 0 \|\| exportInProgress\.current\) return;/);
});
