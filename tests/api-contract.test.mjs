import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(resolve(root, path), "utf8");

test("transactions use the supported store-scoped sales contract", () => {
  const page = source("app/transactions/page.tsx");
  assert.match(page, /new URLSearchParams\(\{ store_id: String\(storeId\) \}\)/);
  assert.match(page, /params\.set\("payment_method", paymentMethod\)/);
  assert.match(page, /api<SalesListResponse>/);
  assert.match(page, /sale\.total_amount/);
  assert.match(page, /sale\.payment_method/);
  assert.match(page, /sale\.client_transaction_id/);
  assert.doesNotMatch(page, /method:\s*["']PATCH["']/);
  assert.doesNotMatch(page, /status=|params\.set\(["']search["']/);
});

test("transactions combine filters, show active criteria and refresh matching totals", () => {
  const page = source("app/transactions/page.tsx");
  assert.match(page, /type="date" value=\{startDate\}/);
  assert.match(page, /type="date" value=\{endDate\}/);
  assert.match(page, /params\.set\("start_date", startDate\)/);
  assert.match(page, /params\.set\("end_date", endDate\)/);
  assert.match(page, /params\.set\("category_id", categoryId\)/);
  assert.match(page, /params\.set\("payment_method", paymentMethod\)/);
  assert.match(page, /Start date must be on or before end date/);
  assert.match(page, /Active filters:/);
  assert.match(page, /Clear Filters/);
  assert.match(page, /filteredTotals\.sales/);
  assert.match(page, /filteredTotals\.paid/);
  assert.match(page, /filteredTotals\.balance/);
  assert.match(page, /const paginatedRows = visibleRows\.slice/);
  assert.doesNotMatch(page, /params\.set\("page", String\(page\)\)/);
});

test("transaction details use the supported sale lookup route and store ID", () => {
  const page = source("app/transactions/page.tsx");
  assert.match(page, /\/sales\/get\?/);
  assert.match(page, /id: String\(id\), store_id: String\(storeId\)/);
  assert.match(page, /api<\{ receipt: Receipt \}>/);
});

test("checkout connects customer creation, sale balances, and updated receipt display", () => {
  const page = source("app/sales/page.tsx");
  const types = source("lib/types.ts");
  assert.match(page, /setCustomerId\(String\(data\.customer\.id\)\)/);
  assert.match(page, /customer_id: customerId \? Number\(customerId\) : null/);
  assert.match(page, /client_transaction_id: saleTransactionId/);
  assert.match(page, /payment_method: paymentMethod === "CASH"/);
  assert.match(page, /amount_paid: amountPaid/);
  assert.match(page, /setReceipt\(data\.receipt\)/);
  assert.match(page, /label="Amount paid" value=\{money\(Number\(receipt\.amount_paid\)\)\}/);
  assert.match(page, /label="Outstanding balance" value=\{money\(Number\(receipt\.balance\)\)\}/);
  assert.match(page, /sale\.amount_paid/);
  assert.match(page, /sale\.balance/);
  assert.match(page, /window\.print\(\)/);
  assert.match(types, /export type SaleSummary = \{[\s\S]*?amount_paid: string;[\s\S]*?balance: string;/);
});

test("sales receipt renders detailed item and payment breakdown instead of raw server text", () => {
  const page = source("app/sales/page.tsx");
  assert.match(page, /receipt-document/);
  assert.match(page, /Items purchased/);
  assert.match(page, /Unit price/);
  assert.match(page, /Subtotal/);
  assert.match(page, /receipt\.items\.map/);
  assert.match(page, /products\.find\(\(product\) => product\.id === item\.product_id\)/);
  assert.match(page, /Payment method/);
  assert.match(page, /Outstanding balance/);
  assert.match(page, /Thank you for your purchase/);
  assert.doesNotMatch(page, /<pre className="mt-4[\s\S]*?receipt\.printable_text/);
});

test("debts page records payments through the supported store-scoped payment contract", () => {
  const page = source("app/debts/page.tsx");
  assert.match(page, /\/customers\/owes\?store_id=/);
  assert.match(page, /\/sales\?store_id=/);
  assert.match(page, /\/sales\/payments/);
  assert.match(page, /client_transaction_id:\s*request\.clientTransactionId/);
  assert.match(page, /payment_method:\s*request\.paymentMethod/);
  assert.match(page, /\/sales\/receipt/);
  assert.match(page, /sale\.total_amount/);
  assert.match(page, /sale\.amount_paid/);
  assert.match(page, /sale\.balance/);
  assert.match(page, /amount > remaining/);
  assert.match(page, /paymentHistory\.payments\.map/);
  assert.match(page, /Retry payment/);
  assert.doesNotMatch(page, /\/api\/debts/);
});

test("payment refresh failures do not leave an accepted payment retryable or masquerade as empty history", () => {
  const page = source("app/debts/page.tsx");
  assert.match(page, /setPendingPayment\(null\);[\s\S]*?Refreshing the balance and receipt/);
  assert.match(page, /Payment was accepted by the server, but payment history refresh failed/);
  assert.match(page, /Payment history could not be verified:/);
  assert.match(page, /historyError \? \(/);
  assert.match(page, /Retry only with the same transaction ID/);
});

test("debt payment history bypasses cached reads and explains a missing backend route", () => {
  const page = source("app/debts/page.tsx");
  assert.match(page, /api<PaymentHistory>\(\`\/sales\/payments\?\$\{params\.toString\(\)\}\`, \{ refresh: true \}\)/);
  assert.match(page, /does not expose the payment-history endpoint/);
  assert.match(page, /const newlyCollected = Math\.max\(0, Number\(historyData!\.amount_paid\) - Number\(selectedSale\.amount_paid\)\)/);
  assert.match(page, /max=\{paymentHistory\?\.balance \?\? selectedSale\.balance\}/);
});

test("settings page uses the documented store settings endpoint", () => {
  const page = source("app/settings/page.tsx");
  assert.match(page, /user\?\.store_name/);
  assert.match(page, /api<\{ store: \{ id: number; name: string \} \}>\("\/settings\/store"/);
  assert.match(page, /method: "PATCH"/);
  assert.doesNotMatch(page, /\/api\/store/);
  assert.doesNotMatch(page, /fetch\(/);
});

test("shared API helper unwraps success data and surfaces structured errors", () => {
  const helper = source("lib/api.ts");
  assert.match(helper, /credentials:\s*["\x27]same-origin["\x27]/);
  assert.match(helper, /body\?\.data\s*\?\?\s*body/);
  assert.match(helper, /body\?\.error\?\.message/);
  assert.match(helper, /body\?\.error\?\.code/);
});

test("Next.js uses a configurable same-origin API proxy", () => {
  const config = source("next.config.ts");
  assert.match(config, /RETAILOS_API_ORIGIN/);
  assert.match(config, /source:.*api/);
});

test("protected API 401s send the user to an expired-session login", () => {
  const helper = source("lib/api.ts");
  assert.match(helper, /window.location.assign/);
  assert.match(helper, /session-expired/);
  const login = source("app/login/page.tsx");
  assert.match(login, /Your session expired/);
});

test("navigation contains only implemented routes and does not filter by unsupported roles", () => {
  const shell = source("components/layout/DashboardShell.tsx");
  const navItems = shell.match(/const NAV_ITEMS: NavItem\[\] = \[([\s\S]*?)\];/)?.[1] ?? "";
  for (const route of ["/dashboard", "/sales", "/inventory", "/transactions", "/customers", "/debts", "/settings"]) {
    assert.ok(navItems.includes(`href: "${route}"`), `missing navigation route ${route}`);
  }
  for (const route of ["/purchases", "/report", "/users", "/notification"]) {
    assert.ok(!navItems.includes(`href: "${route}"`), `unsupported navigation route remains: ${route}`);
  }
  assert.doesNotMatch(shell, /ADMIN_ROLES|MANAGEMENT_ROLES|ALL_ROLES|activeRole|item\.roles/);
});


test("inventory category tabs filter by saved category without mutating products", () => {
  const page = source("app/inventory/page.tsx");
  const types = source("lib/types.ts");
  assert.match(types, /export type Category = \{/);
  assert.match(types, /category_id\?: number \| null/);
  assert.match(page, /\/categories\?store_id=/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-selected=\{selectedCategoryId === "all"\}/);
  assert.match(page, /const filteredProducts = selectedCategoryId === "all"[\s\S]*?product\.category_id/);
  assert.match(page, /retailos:inventory:selected-category:/);
  assert.match(page, /filteredProducts\.map\(\(product\) =>/);
  assert.match(page, /Loading categories/);
  assert.match(page, /Categories could not be loaded/);
  assert.match(page, /No products or services are assigned to this category yet/);
  assert.doesNotMatch(page, /selectCategory[\s\S]{0,250}api\(/);
});

test("products and services listing supports category tabs and restores selection", () => {
  const page = source("app/items/page.tsx");
  assert.match(page, /\/categories\?store_id=/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-selected=\{selectedCategoryId === "all"\}/);
  assert.match(page, /selectedCategoryId === "all" \|\| String\(product\.category_id/);
  assert.match(page, /retailos:items:selected-category:/);
  assert.match(page, /Loading categories/);
  assert.match(page, /Categories could not be loaded/);
  assert.match(page, /No products or services are assigned to this category/);
  assert.match(page, /product\.product_type === "Service"/);
});


test("inventory product form supports predefined and custom units without losing legacy values", () => {
  const page = source("app/inventory/page.tsx");
  assert.match(page, /value: "piece", label: "Pieces"/);
  assert.match(page, /value: "kg", label: "kg"/);
  assert.match(page, /value: "bag", label: "Bags"/);
  assert.match(page, /<option value="other">Other<\/option>/);
  assert.match(page, /Custom unit/);
  assert.match(page, /customUnit\.trim\(\)/);
  assert.match(page, /setCustomUnit\(standardUnits\.some\(\(unit\) => unit\.value === product\.base_unit\) \? "" : product\.base_unit\)/);
  assert.match(page, /base_unit: isService \? "piece" : \(usesCustomUnit \? customUnit\.trim\(\) : form\.baseUnit\.trim\(\)\)/);
  assert.match(page, /Unit: \$\{displayUnit\(product\.base_unit\)\}/);
  assert.match(page, /unit not recorded/);
  assert.match(page, /Conversion unavailable/);
});


test("transactions page supports filtered PDF and CSV exports with duplicate-action protection", () => {
  const page = source("app/transactions/page.tsx");
  assert.match(page, /params\.set\("start_date", startDate\)/);
  assert.match(page, /params\.set\("end_date", endDate\)/);
  assert.match(page, /params\.set\("category_id", categoryId\)/);
  assert.match(page, /params\.set\("payment_method", paymentMethod\)/);
  assert.match(page, /Export PDF/);
  assert.match(page, /Export CSV/);
  assert.match(page, /exporting !== null/);
  assert.match(page, /while \(true\)/);
  assert.match(page, /retailos-transactions-/);
  assert.match(page, /window\.print\(\)/);
  assert.match(page, /text\/csv/);
  assert.match(page, /Export failed:/);
});

test("transaction refund workflow uses the authoritative server contract and receipt", () => {
  const page = source("app/transactions/page.tsx");
  assert.match(page, /\/sales\/refunds/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /client_transaction_id: refundRequestRef\.current/);
  assert.match(page, /amount: amount\.toFixed\(2\)/);
  assert.match(page, /reason: refundReason\.trim\(\)/);
  assert.match(page, /payment_method: refundPaymentMethod/);
  assert.match(page, /window\.confirm\(/);
  assert.match(page, /disabled=\{refundSubmitting/);
  assert.match(page, /REFUND_EXCEEDS_REMAINING_AMOUNT|remaining refundable amount/);
  assert.match(page, /data\.refund\.receipt/);
  assert.match(page, /refundReceipt\.refund_reference/);
  assert.match(page, /refundReceipt\.original_sale_id/);
  assert.match(page, /refundReceipt\.amount/);
  assert.match(page, /refundReceipt\.created_at/);
  assert.match(page, /refundReceipt\.payment_method/);
  assert.match(page, /filteredTotals\.refunded/);
  assert.match(page, /filteredTotals\.net/);
  assert.match(page, /printRefundReceipt/);
  assert.match(page, /await load\(\); await showDetails\(selectedSale\.id\)/);
});


test("audit history screen uses the store-scoped audit API with supported filters", () => {
  const page = source("app/audit/page.tsx");
  const shell = source("components/layout/DashboardShell.tsx");
  assert.match(page, /api<AuditResponse>\("\/audit\?/);
  assert.match(page, /params\.set\("start_date", startDate\)/);
  assert.match(page, /params\.set\("end_date", endDate\)/);
  assert.match(page, /params\.set\("action_type", actionType\.trim\(\)\)/);
  assert.match(page, /params\.set\("user_id", userId\.trim\(\)\)/);
  assert.match(page, /entry\.action_type/);
  assert.match(page, /entry\.user_id/);
  assert.match(page, /entry\.created_at/);
  assert.match(page, /entry\.entity_type/);
  assert.match(page, /entry\.entity_id/);
  assert.match(page, /entry\.before/);
  assert.match(page, /entry\.after/);
  assert.match(page, /entry\.details/);
  assert.match(page, /SENSITIVE_KEY/);
  assert.match(page, /Start date must be on or before end date/);
  assert.match(page, /No audit records found/);
  assert.match(page, /Loading audit history/);
  assert.match(page, /role="alert"/);
  assert.match(shell, /href: "\/audit"/);
  assert.doesNotMatch(page, /method:\s*["'](POST|PATCH|PUT|DELETE)["']/);
});


test("offline checkout persists account-scoped carts and restores pending sales", () => {
  const page = source("app/sales/page.tsx");
  assert.match(page, /retailos:offline-checkout:v1:user:/);
  assert.match(page, /localStorage\.getItem\(accountStorageKey\)/);
  assert.match(page, /localStorage\.setItem\(accountStorageKey, JSON\.stringify\(snapshot\)\)/);
  assert.match(page, /window\.addEventListener\("online", updateOnlineStatus\)/);
  assert.match(page, /window\.addEventListener\("offline", updateOnlineStatus\)/);
  assert.match(page, /navigator\.onLine/);
  assert.match(page, /NOT confirmed/);
  assert.match(page, /clearing browser data/i);
});

test("offline sale synchronization uses the server idempotency contract and separates confirmed sales", () => {
  const page = source("app/sales/page.tsx");
  assert.match(page, /api<\{[\s\S]*?sync_status\?: "accepted" \| "already_processed" \| "rejected"/);
  assert.match(page, /"\/sales\/sync"/);
  assert.match(page, /client_transaction_id: saleTransactionId/);
  assert.match(page, /result\.sync_status === "accepted" \|\| result\.sync_status === "already_processed"/);
  assert.match(page, /Retry with same reference/);
  assert.match(page, /IDEMPOTENCY_KEY_REUSED/);
  assert.match(page, /Refresh prices and stock/);
  assert.match(page, /Confirm revised sale and retry/);
  assert.match(page, /Pending sales \(/);
  assert.match(page, /separate from confirmed server sales/);
  assert.match(page, /window\.addEventListener\("beforeunload", warnBeforeUnload\)/);
});

test("pending checkout data is gated by the signed-in account and store", () => {
  const page = source("app/sales/page.tsx");
  assert.match(page, /user:\$\{user\.id\}:store:\$\{storeId\}/);
  assert.match(page, /hydratedKey === accountStorageKey/);
  assert.match(page, /\{accountReady && pendingSales\.length > 0 &&/);
  assert.match(page, /Restoring checkout data for the signed-in account/);
});


test("checkout recovery classifies common failures and keeps ambiguous requests pending", () => {
  const page = source("app/sales/page.tsx");
  assert.match(page, /function checkoutFailureMessage\(cause: unknown\)/);
  assert.match(page, /STALE_PRICE|PRICE_CHANGED|PRICE_MISMATCH/);
  assert.match(page, /There is not enough stock/);
  assert.match(page, /Checkout needs a correction/);
  assert.match(page, /server error while processing checkout/);
  assert.match(page, /kept pending with the same reference/);
  assert.match(page, /savePendingSale\(salePayload, total, customerId[\s\S]*?checkoutFailureMessage\(e\)\)/);
});

test("checkout locks before asynchronous price verification and releases on early recovery paths", () => {
  const page = source("app/sales/page.tsx");
  assert.match(page, /checkoutLock\.current = true;\s*setSubmitting\(true\);\s*setError\(""\);\s*setMessage\(""\);\s*\n\s*if \(!navigator\.onLine\)/);
  assert.match(page, /checkoutLock\.current = false;\s*setSubmitting\(false\);\s*return;/);
  assert.match(page, /disabled=\{\s*loading\s*\|\|\s*submitting/);
});

test("definite checkout rejection preserves the cart and resets the key before corrected resubmission", () => {
  const page = source("app/sales/page.tsx");
  assert.match(page, /A definite rejection means this identifier can no longer be reused/);
  assert.match(page, /setTransactionId\(""\);[\s\S]*?setError\(checkoutFailureMessage\(e\)\)/);
  assert.match(page, /Your cart and entered checkout details have been kept/);
});
