// Pure, framework-free logic for the guided tour. Kept as plain ESM so it can be
// unit-tested with `node --test` (same pattern as nigeria-time-core.mjs) and
// imported by the React layer in components/tour/.
//
// Every `target` below is the value of a `data-tour="..."` attribute that exists
// in the real UI. tests/tour-core.test.mjs verifies each one is present in the
// page source for the chapter's route, so a renamed element fails CI instead of
// silently breaking the walkthrough.

export const TOUR_STORAGE_VERSION = 1;

/**
 * Step shape:
 *  id, target (data-tour value), route, title, body (what it is),
 *  why (when/why to use it), action? { type: "click" | "input", instruction,
 *  selector? } — if present, Next stays locked until the user really does it
 *  (or chooses "Skip step").
 */
export const CHAPTERS = [
  {
    id: "start",
    title: "Getting started",
    summary: "Find your way around and read your dashboard.",
    route: "/dashboard",
    steps: [
      {
        id: "nav",
        target: "nav",
        route: "/dashboard",
        title: "Your menu",
        body: "Every part of RetailOS is one click away here: Sales, Products & Inventory, Transactions, Customers, Who Owes Me, Alerts and Settings.",
        why: "Use it whenever you want to switch tasks. The highlighted item shows where you are.",
      },
      {
        id: "summary",
        target: "dashboard-summary",
        route: "/dashboard",
        title: "Your business at a glance",
        body: "These tiles show how many products you have, which are running low, open alerts and today's sales.",
        why: "Check this first thing each day to see whether anything needs attention.",
      },
      {
        id: "brief",
        target: "dashboard-brief",
        route: "/dashboard",
        title: "Daily Business Brief",
        body: "Compares today's sales with yesterday's, lists alerts, and suggests what to restock.",
        why: "It tells you what to do next without digging through numbers.",
      },
      {
        id: "help",
        target: "help-menu",
        route: "/dashboard",
        title: "Learn the app any time",
        body: "Open this menu to replay this tour or take a short tour of Sales, Inventory, Customers, Money and Alerts.",
        why: "You can leave the tour whenever you like and pick it up again from here.",
      },
    ],
  },
  {
    id: "sales",
    title: "Recording a sale",
    summary: "Add items to a cart, take payment and complete the sale.",
    route: "/sales",
    steps: [
      {
        id: "search",
        target: "sales-search",
        route: "/sales",
        title: "Find what the customer wants",
        body: "Search your products and services by name.",
        why: "Quicker than scrolling when you have many products.",
        action: { type: "input", instruction: "Type a product name (or any letter) in the box." },
      },
      {
        id: "add",
        target: "sales-add",
        route: "/sales",
        title: "Add it to the cart",
        body: "Each product card shows the price and how much stock is left. Out-of-stock products can't be added.",
        why: "Adding to the cart does not record a sale yet, so you can change your mind.",
        action: { type: "click", instruction: "Press the first \"Add to cart\" button." },
      },
      {
        id: "cart",
        target: "sales-cart",
        route: "/sales",
        title: "Check the cart",
        body: "Change the quantity or the selling unit (for example carton or piece) and see the line total.",
        why: "Make sure quantities are right before taking payment.",
      },
      {
        id: "payment",
        target: "sales-payment",
        route: "/sales",
        title: "Record how they paid",
        body: "Enter the amount paid and pick Cash, Transfer or POS. If they pay less than the total, the rest becomes a balance you must attach to a customer.",
        why: "This is how credit sales end up in Who Owes Me.",
      },
      {
        id: "complete",
        target: "sales-complete",
        route: "/sales",
        title: "Complete the sale",
        body: "This saves the sale, reduces stock and adds it to Transactions.",
        why: "The tour will never press this for you. When you're ready, press it yourself.",
      },
    ],
  },
  {
    id: "inventory",
    title: "Products & stock",
    summary: "Add products, import a list and keep stock correct.",
    route: "/inventory",
    steps: [
      {
        id: "form",
        target: "inventory-form",
        route: "/inventory",
        title: "Add a product or service",
        body: "Enter a name, price, opening stock and base unit, then press Add product. Choose Service for things you don't count in stock.",
        why: "Products must exist here before you can sell them. Nothing is saved until you press Add product.",
      },
      {
        id: "import",
        target: "inventory-import",
        route: "/inventory",
        title: "Have a long list? Import it",
        body: "Upload a CSV file to add many products at once.",
        why: "Saves time when you are moving from a notebook or spreadsheet.",
      },
      {
        id: "table",
        target: "inventory-table",
        route: "/inventory",
        title: "Keep stock correct",
        body: "Use +1 and -1 for quick stock changes, Edit to change details, and Movements to see the history of one product.",
        why: "Accurate stock means alerts and the Daily Business Brief can be trusted.",
      },
      {
        id: "movements",
        target: "inventory-movements",
        route: "/inventory",
        title: "See every stock change",
        body: "Each sale, adjustment and import is logged with the date, change and new stock.",
        why: "Use it to find out why a number looks wrong.",
      },
    ],
  },
  {
    id: "customers",
    title: "Customers",
    summary: "Save customers and review what they bought.",
    route: "/customers",
    steps: [
      {
        id: "form",
        target: "customers-form",
        route: "/customers",
        title: "Add a customer",
        body: "Save a name and phone number so you can pick them at checkout.",
        why: "You need a saved customer to sell on credit.",
      },
      {
        id: "table",
        target: "customers-table",
        route: "/customers",
        title: "Review purchase history",
        body: "Press Purchase history to see everything a customer has bought.",
        why: "Helpful when a customer asks about an earlier purchase.",
      },
    ],
  },
  {
    id: "money",
    title: "Transactions & debts",
    summary: "Look up past sales and see who still owes you.",
    route: "/transactions",
    steps: [
      {
        id: "filters",
        target: "transactions-filters",
        route: "/transactions",
        title: "Find a past sale",
        body: "Search by sale ID or filter by how it was paid.",
        why: "Use it to answer \"did this customer pay?\" quickly.",
      },
      {
        id: "list",
        target: "transactions-table",
        route: "/transactions",
        title: "Open a receipt",
        body: "Press Details on any row to see what was sold and how it was paid.",
        why: "Good for checking a receipt or settling a disagreement.",
      },
      {
        id: "owed",
        target: "debts-total",
        route: "/debts",
        title: "Who owes you",
        body: "The total of every unpaid balance from credit sales, followed by each customer's balance.",
        why: "Review each unpaid sale and record a customer payment here. Every collection is saved separately, and the remaining balance updates automatically.",
      },
      {
        id: "outstanding-sales",
        target: "debts-sales-table",
        route: "/debts",
        title: "Review unpaid sales",
        body: "Each row shows an outstanding sale and lets you open the payment flow for that sale.",
        why: "Record only the amount the customer actually pays so the remaining balance stays accurate.",
      },
    ],
  },
  {
    id: "settings",
    title: "Account and store settings",
    summary: "Manage your account, store name, password and sign-out.",
    route: "/settings",
    steps: [
      {
        id: "account",
        target: "settings-account",
        route: "/settings",
        title: "Check your account",
        body: "Review the username and email associated with this login. Sign out when you are finished using a shared device.",
        why: "Knowing which account is active helps prevent changes being made under the wrong login.",
      },
      {
        id: "store",
        target: "settings-store",
        route: "/settings",
        title: "Update your store profile",
        body: "Change the store name shown throughout RetailOS. The account must have a store assigned, and only the store owner can change its name.",
        why: "A consistent store name makes the workspace easier to identify.",
      },
      {
        id: "password",
        target: "settings-password",
        route: "/settings",
        title: "Change your password",
        body: "Enter your current password, choose a new one and confirm it. You will need to sign in again after a successful change.",
        why: "Use this when you need to rotate your password or protect your account.",
      },
    ],
  },
  {
    id: "alerts",
    title: "Low-stock alerts",
    summary: "Review alerts and resolve them after taking action.",
    route: "/alerts",
    steps: [
      {
        id: "list",
        target: "alerts-list",
        route: "/alerts",
        title: "Review open alerts",
        body: "This page lists low-stock alerts available from the server.",
        why: "Use the product inventory screen to check current stock and reorder thresholds, then resolve alerts once you've restocked.",
      },
    ],
  },
];

export function getChapter(chapterId) {
  return CHAPTERS.find((chapter) => chapter.id === chapterId) ?? null;
}

export function getStep(chapterId, stepIndex) {
  const chapter = getChapter(chapterId);
  if (!chapter) return null;
  return chapter.steps[stepIndex] ?? null;
}

/** The chapter for this page (its own route first, then any step on it), for "Tour this page". */
export function chapterForPath(pathname) {
  return (
    CHAPTERS.find((chapter) => chapter.route === pathname) ??
    CHAPTERS.find((chapter) => chapter.steps.some((step) => step.route === pathname)) ??
    null
  );
}

export function progressLabel(chapterId, stepIndex) {
  const chapter = getChapter(chapterId);
  if (!chapter) return "";
  return `Step ${stepIndex + 1} of ${chapter.steps.length}`;
}

// ---------------------------------------------------------------------------
// Session state machine
// ---------------------------------------------------------------------------

export const IDLE = Object.freeze({ status: "idle", chapterId: null, stepIndex: 0 });

function clampIndex(chapter, index) {
  return Math.max(0, Math.min(chapter.steps.length - 1, index));
}

/**
 * Returns { state, completedChapterId }. `completedChapterId` is set only when
 * the user moves forward past the last step.
 */
export function tourReducer(state, action) {
  switch (action.type) {
    case "start": {
      const chapter = getChapter(action.chapterId);
      if (!chapter) return { state, completedChapterId: null };
      return {
        state: {
          status: "running",
          chapterId: chapter.id,
          stepIndex: clampIndex(chapter, action.stepIndex ?? 0),
        },
        completedChapterId: null,
      };
    }
    case "next":
    case "skip-step": {
      const chapter = getChapter(state.chapterId);
      if (!chapter || state.status === "idle") return { state, completedChapterId: null };
      if (state.stepIndex >= chapter.steps.length - 1) {
        return { state: IDLE, completedChapterId: chapter.id };
      }
      return {
        state: { ...state, status: "running", stepIndex: state.stepIndex + 1 },
        completedChapterId: null,
      };
    }
    case "back": {
      const chapter = getChapter(state.chapterId);
      if (!chapter || state.status === "idle") return { state, completedChapterId: null };
      return {
        state: { ...state, status: "running", stepIndex: clampIndex(chapter, state.stepIndex - 1) },
        completedChapterId: null,
      };
    }
    case "pause":
      if (state.status !== "running") return { state, completedChapterId: null };
      return { state: { ...state, status: "paused" }, completedChapterId: null };
    case "resume":
      if (state.status !== "paused") return { state, completedChapterId: null };
      return { state: { ...state, status: "running" }, completedChapterId: null };
    case "exit":
      return { state: IDLE, completedChapterId: null };
    default:
      return { state, completedChapterId: null };
  }
}

// ---------------------------------------------------------------------------
// Persistence (non-sensitive: only chapter ids and step numbers)
// ---------------------------------------------------------------------------

export function storageKey(userId) {
  return `retailos:tour:v${TOUR_STORAGE_VERSION}:user:${userId}`;
}

export function emptyProgress() {
  // welcome: null (never shown) | "started" | "dismissed" | "completed"
  return { version: TOUR_STORAGE_VERSION, welcome: null, completed: {}, active: null };
}

const WELCOME_VALUES = new Set([null, "started", "dismissed", "completed"]);

/** Never throws; corrupt or unknown data becomes a fresh record. */
export function parseProgress(raw) {
  if (typeof raw !== "string" || raw === "") return emptyProgress();
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || data.version !== TOUR_STORAGE_VERSION) return emptyProgress();
    const completed = {};
    if (data.completed && typeof data.completed === "object") {
      for (const chapter of CHAPTERS) {
        if (data.completed[chapter.id] === true) completed[chapter.id] = true;
      }
    }
    let active = null;
    if (data.active && typeof data.active === "object") {
      const chapter = getChapter(data.active.chapterId);
      const index = Number(data.active.stepIndex);
      if (chapter && Number.isInteger(index) && index >= 0 && index < chapter.steps.length) {
        active = { chapterId: chapter.id, stepIndex: index };
      }
    }
    return {
      version: TOUR_STORAGE_VERSION,
      welcome: WELCOME_VALUES.has(data.welcome) ? data.welcome : null,
      completed,
      active,
    };
  } catch {
    return emptyProgress();
  }
}

export function serializeProgress(progress) {
  return JSON.stringify(progress);
}

/** Welcome appears once per user per browser, until they act on it. */
export function shouldShowWelcome(progress) {
  return progress.welcome === null;
}

export function withWelcome(progress, welcome) {
  return { ...progress, welcome };
}

export function withChapterCompleted(progress, chapterId) {
  const completed = { ...progress.completed, [chapterId]: true };
  const welcome = chapterId === "start" ? "completed" : progress.welcome;
  return { ...progress, completed, welcome, active: null };
}

/** Records (or clears) the interrupted position so the tour can be resumed. */
export function withActive(progress, state) {
  if (state.status === "idle" || !state.chapterId) return { ...progress, active: null };
  return { ...progress, active: { chapterId: state.chapterId, stepIndex: state.stepIndex } };
}

// ---------------------------------------------------------------------------
// Popover placement
// ---------------------------------------------------------------------------

/**
 * Chooses where to put the instruction card so it does not cover the target.
// rect: { top, left, width, height } of the (padded) spotlight, or null.
// Returns { top, left, placement } in viewport coordinates.
// placement: "bottom" | "top" | "right" | "left" | "center" | "sheet".
 */
export function placePopover({ rect, popover, viewport, gap = 14, margin = 12 }) {
  const { width: vw, height: vh } = viewport;

  // Small screens: dock as a bottom sheet and let scrolling keep the target visible above it.
  if (vw < 640) {
    return {
      placement: "sheet",
      left: margin,
      top: Math.max(margin, vh - popover.height - margin),
      width: vw - margin * 2,
    };
  }

  if (!rect) {
    return {
      placement: "center",
      left: Math.max(margin, (vw - popover.width) / 2),
      top: Math.max(margin, (vh - popover.height) / 2),
    };
  }

  const clampX = (x) => Math.min(Math.max(margin, x), vw - popover.width - margin);
  const clampY = (y) => Math.min(Math.max(margin, y), vh - popover.height - margin);
  const centerX = rect.left + rect.width / 2 - popover.width / 2;
  const centerY = rect.top + rect.height / 2 - popover.height / 2;

  const spaceBelow = vh - (rect.top + rect.height);
  const spaceAbove = rect.top;
  const spaceRight = vw - (rect.left + rect.width);
  const spaceLeft = rect.left;

  const candidates = [
    { placement: "bottom", fits: spaceBelow >= popover.height + gap + margin, top: rect.top + rect.height + gap, left: clampX(centerX) },
    { placement: "top", fits: spaceAbove >= popover.height + gap + margin, top: rect.top - popover.height - gap, left: clampX(centerX) },
    { placement: "right", fits: spaceRight >= popover.width + gap + margin, top: clampY(centerY), left: rect.left + rect.width + gap },
    { placement: "left", fits: spaceLeft >= popover.width + gap + margin, top: clampY(centerY), left: rect.left - popover.width - gap },
  ];

  const best = candidates.find((candidate) => candidate.fits);
  if (best) return { placement: best.placement, top: best.top, left: best.left };

  // Target is too large for any side (e.g. a full-height panel): float over its
  // lower-right corner inside the viewport instead of hiding the whole target.
  return { placement: "center", top: clampY(vh - popover.height - margin), left: clampX(vw - popover.width - margin) };
}

/** True when an element's box can actually be shown (not display:none / zero-size). */
export function isRectVisible(rect) {
  return Boolean(rect) && rect.width > 0 && rect.height > 0;
}
