import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CHAPTERS,
  IDLE,
  chapterForPath,
  emptyProgress,
  getStep,
  isRectVisible,
  parseProgress,
  placePopover,
  progressLabel,
  serializeProgress,
  shouldShowWelcome,
  storageKey,
  tourReducer,
  withActive,
  withChapterCompleted,
  withWelcome,
} from "../lib/tour-core.mjs";

// Sources are checked out with the platform's line endings (CRLF on Windows),
// so normalize to LF before matching multi-line snippets.
const read = async (path) =>
  (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

function run(actions, initial = IDLE) {
  let state = initial;
  let completed = [];
  for (const action of actions) {
    const result = tourReducer(state, action);
    state = result.state;
    if (result.completedChapterId) completed.push(result.completedChapterId);
  }
  return { state, completed };
}

// ---- state machine -------------------------------------------------------

test("start, next and back move through steps and show progress", () => {
  const { state } = run([{ type: "start", chapterId: "sales" }, { type: "next" }, { type: "next" }, { type: "back" }]);
  assert.deepEqual(state, { status: "running", chapterId: "sales", stepIndex: 1 });
  assert.equal(progressLabel("sales", 1), `Step 2 of ${CHAPTERS.find((c) => c.id === "sales").steps.length}`);
});

test("back on the first step stays on the first step", () => {
  const { state } = run([{ type: "start", chapterId: "start" }, { type: "back" }]);
  assert.equal(state.stepIndex, 0);
});

test("starting an unknown chapter changes nothing", () => {
  assert.deepEqual(run([{ type: "start", chapterId: "nope" }]).state, IDLE);
});

test("finishing the last step completes the chapter and returns to idle", () => {
  const chapter = CHAPTERS.find((c) => c.id === "alerts");
  const actions = [{ type: "start", chapterId: "alerts" }, ...chapter.steps.map(() => ({ type: "next" }))];
  const { state, completed } = run(actions);
  assert.deepEqual(state, IDLE);
  assert.deepEqual(completed, ["alerts"]);
});

test("skipping a step advances without needing the action", () => {
  const { state } = run([{ type: "start", chapterId: "sales" }, { type: "skip-step" }]);
  assert.equal(state.stepIndex, 1);
});

test("exit ends the tour without completing it", () => {
  const { state, completed } = run([{ type: "start", chapterId: "sales" }, { type: "next" }, { type: "exit" }]);
  assert.deepEqual(state, IDLE);
  assert.deepEqual(completed, []);
});

test("pause and resume keep the same step", () => {
  const { state } = run([{ type: "start", chapterId: "inventory" }, { type: "next" }, { type: "pause" }]);
  assert.equal(state.status, "paused");
  assert.equal(state.stepIndex, 1);
  assert.deepEqual(run([{ type: "resume" }], state).state, { ...state, status: "running" });
});

test("pause and resume are ignored in the wrong state", () => {
  assert.deepEqual(run([{ type: "pause" }]).state, IDLE);
  assert.deepEqual(run([{ type: "resume" }]).state, IDLE);
  assert.deepEqual(run([{ type: "next" }]).state, IDLE);
});

// ---- first-time rules and persistence --------------------------------------

test("welcome shows only for users who have never acted on it", () => {
  assert.equal(shouldShowWelcome(emptyProgress()), true);
  assert.equal(shouldShowWelcome(withWelcome(emptyProgress(), "dismissed")), false);
  assert.equal(shouldShowWelcome(withWelcome(emptyProgress(), "started")), false);
  assert.equal(shouldShowWelcome(withWelcome(emptyProgress(), "completed")), false);
});

test("finishing Getting started marks onboarding completed; other chapters do not touch it", () => {
  const afterStart = withChapterCompleted(withWelcome(emptyProgress(), "started"), "start");
  assert.equal(afterStart.welcome, "completed");
  assert.equal(afterStart.completed.start, true);
  const afterSales = withChapterCompleted(withWelcome(emptyProgress(), "dismissed"), "sales");
  assert.equal(afterSales.welcome, "dismissed");
});

test("progress round-trips and an interrupted tour can be resumed", () => {
  const interrupted = withActive(emptyProgress(), { status: "running", chapterId: "inventory", stepIndex: 2 });
  const restored = parseProgress(serializeProgress(interrupted));
  assert.deepEqual(restored.active, { chapterId: "inventory", stepIndex: 2 });
  assert.equal(withActive(restored, IDLE).active, null);
  assert.equal(withChapterCompleted(restored, "inventory").active, null);
});

test("corrupt, outdated or tampered stored data falls back safely", () => {
  assert.deepEqual(parseProgress(null), emptyProgress());
  assert.deepEqual(parseProgress("{not json"), emptyProgress());
  assert.deepEqual(parseProgress(JSON.stringify({ version: 999 })), emptyProgress());
  const messy = parseProgress(
    JSON.stringify({
      version: 1,
      welcome: "<script>",
      completed: { sales: true, bogus: true, start: "yes" },
      active: { chapterId: "sales", stepIndex: 99 },
    }),
  );
  assert.equal(messy.welcome, null);
  assert.deepEqual(messy.completed, { sales: true });
  assert.equal(messy.active, null);
});

test("progress is stored per user so accounts on one browser do not share it", () => {
  assert.notEqual(storageKey(1), storageKey(2));
  assert.match(storageKey(7), /user:7$/);
});

test("stored progress contains only chapter ids and step numbers", () => {
  const json = serializeProgress(withActive(emptyProgress(), { status: "running", chapterId: "sales", stepIndex: 1 }));
  assert.deepEqual(Object.keys(JSON.parse(json)).sort(), ["active", "completed", "version", "welcome"]);
});

// ---- placement ---------------------------------------------------------------

const popover = { width: 360, height: 220 };
const desktop = { width: 1280, height: 800 };
const overlaps = (a, b) => a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;

test("popover does not cover a target when there is room", () => {
  for (const rect of [
    { top: 100, left: 300, width: 400, height: 120 },
    { top: 600, left: 300, width: 400, height: 120 },
    { top: 300, left: 20, width: 220, height: 300 },
  ]) {
    const placed = placePopover({ rect, popover, viewport: desktop });
    assert.ok(!overlaps({ ...popover, top: placed.top, left: placed.left }, rect), JSON.stringify(placed));
  }
});

test("popover always stays inside the viewport", () => {
  for (const rect of [
    { top: 0, left: 0, width: 1280, height: 800 },
    { top: 700, left: 1200, width: 60, height: 60 },
    { top: 5, left: 5, width: 50, height: 20 },
    null,
  ]) {
    const placed = placePopover({ rect, popover, viewport: desktop });
    assert.ok(placed.left >= 0 && placed.top >= 0);
    assert.ok(placed.left + popover.width <= desktop.width);
    assert.ok(placed.top + popover.height <= desktop.height);
  }
});

test("phones get a bottom sheet instead of a floating bubble", () => {
  const placed = placePopover({ rect: { top: 100, left: 10, width: 300, height: 100 }, popover: { width: 300, height: 260 }, viewport: { width: 375, height: 700 } });
  assert.equal(placed.placement, "sheet");
  assert.equal(placed.top + 260 + 12, 700);
});

test("zero-size boxes (hidden elements) are not treated as visible targets", () => {
  assert.equal(isRectVisible({ top: 0, left: 0, width: 0, height: 0 }), false);
  assert.equal(isRectVisible(null), false);
  assert.equal(isRectVisible({ top: 0, left: 0, width: 10, height: 10 }), true);
});

// ---- content must match the real UI -------------------------------------------

const ROUTE_SOURCES = {
  "/dashboard": ["components/dashboard/LiveDashboard.tsx"],
  "/sales": ["app/sales/page.tsx"],
  "/inventory": ["app/inventory/page.tsx"],
  "/customers": ["app/customers/page.tsx"],
  "/transactions": ["app/transactions/page.tsx"],
  "/debts": ["app/debts/page.tsx"],
  "/alerts": ["app/alerts/page.tsx"],
  "/settings": ["app/settings/page.tsx"],
};
const SHARED_SOURCES = ["components/layout/DashboardShell.tsx", "components/tour/HelpMenu.tsx"];

test("every tour step targets an element that exists on its page", async () => {
  for (const chapter of CHAPTERS) {
    for (const step of chapter.steps) {
      const files = [...(ROUTE_SOURCES[step.route] ?? []), ...SHARED_SOURCES];
      assert.ok(ROUTE_SOURCES[step.route], `${chapter.id}/${step.id}: no source mapped for ${step.route}`);
      const sources = await Promise.all(files.map(read));
      const found = sources.some((source) => new RegExp(`data-tour=(?:"${step.target}"|\\{[^}]*"${step.target}"[^}]*\\})`).test(source));
      assert.ok(found, `${chapter.id}/${step.id}: data-tour="${step.target}" not found for ${step.route}`);
    }
  }
});

test("tour routes are real navigation destinations", async () => {
  const shell = await read("components/layout/DashboardShell.tsx");
  for (const chapter of CHAPTERS) {
    for (const route of new Set([chapter.route, ...chapter.steps.map((s) => s.route)])) {
      assert.ok(shell.includes(`href: "${route}"`), `${route} is not in the navigation`);
    }
  }
});

test("steps have plain-language copy and chapters are non-empty with unique ids", () => {
  const ids = new Set();
  for (const chapter of CHAPTERS) {
    assert.ok(!ids.has(chapter.id));
    ids.add(chapter.id);
    assert.ok(chapter.steps.length > 0);
    const stepIds = new Set(chapter.steps.map((s) => s.id));
    assert.equal(stepIds.size, chapter.steps.length, `duplicate step ids in ${chapter.id}`);
    for (const step of chapter.steps) {
      assert.ok(step.title && step.body && step.why, `${chapter.id}/${step.id} is missing copy`);
      assert.equal(getStep(chapter.id, chapter.steps.indexOf(step)), step);
    }
  }
});

test("every chapter can be reached from its page via 'Tour this page'", () => {
  for (const chapter of CHAPTERS) assert.equal(chapterForPath(chapter.route)?.id, chapter.id);
  assert.equal(chapterForPath("/debts")?.id, "money");
  assert.equal(chapterForPath("/settings")?.id, "settings");
});

test("tour never claims features the app does not have", () => {
  const text = JSON.stringify(CHAPTERS).toLowerCase();
  for (const banned of ["purchase order", "report", "employee", "notification", "repay"]) {
    assert.ok(!text.includes(banned), `tour text mentions unsupported feature: ${banned}`);
  }
});

// ---- UI contract ---------------------------------------------------------------

test("tour is mounted for every signed-in page, inside the auth provider", async () => {
  const layout = await read("app/layout.tsx");
  assert.match(layout, /<AuthProvider>\s*<TourProvider>\{children\}<\/TourProvider>\s*<\/AuthProvider>/);
});

test("overlay offers Next, Back, Skip, Exit, progress and accessible announcements", async () => {
  const overlay = await read("components/tour/TourOverlay.tsx");
  for (const text of [">\n            Back\n", "Skip step", "Exit tutorial", "Pause", "Finish"]) {
    assert.ok(overlay.includes(text.trim()) || overlay.includes(text), `overlay is missing: ${text.trim()}`);
  }
  assert.match(overlay, /role="progressbar"/);
  assert.match(overlay, /aria-live="polite"/);
  assert.match(overlay, /role="dialog"/);
  assert.match(overlay, /key === "Escape"/);
  assert.match(overlay, /pointer-events-none/, "spotlight must not block the highlighted UI");
});

test("steps that need an action stay locked until the real event is observed", async () => {
  const overlay = await read("components/tour/TourOverlay.tsx");
  assert.match(overlay, /addEventListener\(eventName, handler, true\)/);
  assert.match(overlay, /const needsAction = Boolean\(step\?\.action\) && !actionDone && !targetMissing/);
  assert.match(overlay, /disabled=\{!canAdvance\}/);
  assert.match(overlay, /Skip step/);
});

test("tour code never submits data or clicks buttons for the user", async () => {
  for (const file of ["TourProvider", "TourOverlay", "WelcomeDialog", "HelpMenu"]) {
    const source = await read(`components/tour/${file}.tsx`);
    assert.doesNotMatch(source, /\bapi\(|fetch\(|\.click\(\)|\.submit\(|requestSubmit/, `${file} must not perform actions`);
    assert.doesNotMatch(source, /sessionStorage|document\.cookie/, `${file} must not use cookies/session storage`);
  }
});

test("tour never overrides manual navigation: it pauses when the user leaves the page", async () => {
  const provider = await read("components/tour/TourProvider.tsx");
  assert.match(provider, /dispatch\(\{ type: "pause" \}\)/);
  assert.match(provider, /pendingRoute/);
});

test("the shell exposes a discoverable help entry point and an accessible, responsive menu", async () => {
  const shell = await read("components/layout/DashboardShell.tsx");
  assert.match(shell, /<HelpMenu \/>/);
  assert.match(shell, /<TourPageButton \/>/);
  assert.match(shell, /aria-current/);
  assert.match(shell, /Skip to main content/);
  assert.match(shell, /aria-label="Open menu"/);
  const menu = await read("components/tour/HelpMenu.tsx");
  assert.match(menu, /Learn the app/);
  assert.match(menu, /Resume/);
  assert.match(menu, /Replay/);
});
