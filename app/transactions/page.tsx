"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import { formatNigeriaDate, formatNigeriaDateTime } from "@/lib/nigeria-time";
import type { Category, Customer, Receipt } from "@/lib/types";

type ExportSaleItem = {
  product_id?: number;
  product_name?: string;
  category_id?: number | null;
  category_name?: string | null;
  quantity?: number | string;
  unit?: string | null;
  unit_name?: string | null;
  unit_conversion?: number | string | null;
  sale_price?: number | string;
  unit_price?: number | string;
  price_at_sale?: number | string;
  line_total?: number | string;
  total?: number | string;
};

type SaleRow = {
  id: number;
  client_transaction_id: string | null;
  customer_id: number | null;
  total_amount: string;
  amount_paid: string;
  balance: string;
  refunded_amount?: string | number;
  net_amount?: string | number;
  payment_method: "Cash" | "Transfer" | "POS";
  created_at: string;
  items?: ExportSaleItem[];
};

type SalesListResponse = { sales: SaleRow[]; summary?: Record<string, string | number | undefined> };

type RefundRecord = {
  id: number; sale_id: number; original_sale_reference: string | null; amount: string;
  refund_type: "Full" | "Partial"; reason: string; payment_method: "Cash" | "Transfer" | "POS";
  reference: string; client_transaction_id: string; created_at: string;
  receipt: { receipt_type: "Refund"; refund_id: number; refund_reference: string; original_sale_id: number;
    original_sale_reference: string | null; amount: string; refund_type: "Full" | "Partial"; reason: string;
    payment_method: "Cash" | "Transfer" | "POS"; created_at: string; printable_text: string };
};
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c] ?? c));
const csvCell = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
const dateForFilename = () => new Date().toISOString().slice(0, 10);

const money = (value: string | number) =>
  "₦" + Number(value).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function TransactionsPage() {
  const { user } = useAuth();
  const storeId = user?.store_id ?? null;
  const [query, setQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersStoreId, setCustomersStoreId] = useState<number | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);
  const exportInProgress = useRef(false);
  const [page, setPage] = useState(1);
  const LIMIT = 20;
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundPaymentMethod, setRefundPaymentMethod] = useState<"Cash" | "Transfer" | "POS">("Cash");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [refundSuccessMessage, setRefundSuccessMessage] = useState("");
  const [refundReceipt, setRefundReceipt] = useState<RefundRecord["receipt"] | null>(null);
  const refundRequestRef = useRef<{ signature: string; id: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!storeId) {
      setRows([]);
      setError("No store is associated with this account.");
      setLoading(false);
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      setRows([]);
      setError("Start date must be on or before end date.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ store_id: String(storeId) });
      if (paymentMethod) params.set("payment_method", paymentMethod);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      if (categoryId) params.set("category_id", categoryId);
      const data = await api<SalesListResponse>(`/sales?${params.toString()}`, { refresh: true });
      setRows(Array.isArray(data.sales) ? data.sales : []);
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : "Unable to load transactions.");
    } finally {
      setLoading(false);
    }
  }, [storeId, paymentMethod, startDate, endDate, categoryId]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    const params = new URLSearchParams({ store_id: String(storeId) });
    void api<{ categories: Category[] }>(`/categories?${params.toString()}`, { refresh: true })
      .then((data) => { if (!cancelled) setCategories(Array.isArray(data.categories) ? data.categories : []); })
      .catch(() => { if (!cancelled) setCategories([]); });
    return () => { cancelled = true; };
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    void api<{ customers: Customer[] }>(`/customers?store_id=${storeId}`, { refresh: true })
      .then((data) => {
        if (!cancelled) {
          setCustomers(Array.isArray(data.customers) ? data.customers : []);
          setCustomersStoreId(storeId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCustomers([]);
          setCustomersStoreId(storeId);
        }
      });
    return () => { cancelled = true; };
  }, [storeId]);

  const customerName = (customerId: number | null) => {
    if (customerId == null) return "Walk-in";
    if (customersStoreId !== storeId) return "Loading customer…";
    return customers.find((customer) => customer.id === customerId)?.name ?? "Customer not found";
  };

  const visibleRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((sale) =>
      String(sale.id).includes(term) ||
      (sale.client_transaction_id ?? "").toLowerCase().includes(term),
    );
  }, [rows, query]);

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / LIMIT));
  const paginatedRows = visibleRows.slice((page - 1) * LIMIT, page * LIMIT);
  const filteredTotals = useMemo(() => visibleRows.reduce(
    (totals, sale) => ({
      sales: totals.sales + Number(sale.total_amount || 0),
      paid: totals.paid + Number(sale.amount_paid || 0),
      balance: totals.balance + Number(sale.balance || 0),
      refunded: totals.refunded + Number(sale.refunded_amount || 0),
      net: totals.net + Number(sale.net_amount ?? sale.total_amount ?? 0),
    }),
    { sales: 0, paid: 0, balance: 0, refunded: 0, net: 0 },
  ), [visibleRows]);

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string }[] = [];
    if (query.trim()) filters.push({ key: "search", label: "Search: " + query.trim() });
    if (startDate) filters.push({ key: "start", label: "From: " + formatNigeriaDate(startDate + "T12:00:00+01:00") });
    if (endDate) filters.push({ key: "end", label: "To: " + formatNigeriaDate(endDate + "T12:00:00+01:00") });
    if (categoryId) {
      filters.push({
        key: "category",
        label: "Category: " + (categories.find((category) => String(category.id) === categoryId)?.name ?? "Selected category"),
      });
    }
    if (paymentMethod) filters.push({ key: "payment", label: "Payment: " + paymentMethod });
    return filters;
  }, [query, startDate, endDate, categoryId, categories, paymentMethod]);

  function clearFilters() {
    setQuery("");
    setStartDate("");
    setEndDate("");
    setCategoryId("");
    setPaymentMethod("");
    setPage(1);
  }

  async function exportTransactions(format: "pdf" | "csv") {
    if (!storeId || loading || visibleRows.length === 0 || exportInProgress.current) return;
    exportInProgress.current = true;
    const printWindow = format === "pdf" ? window.open("", "_blank") : null;
    if (format === "pdf" && !printWindow) {
      exportInProgress.current = false;
      setError("The PDF window was blocked. Allow pop-ups for RetailOS and try again.");
      return;
    }
    setExporting(format);
    setError("");
    try {
      const allRows: SaleRow[] = [];
      let exportPage = 1;
      const exportLimit = 100;
      while (true) {
        const params = new URLSearchParams({ store_id: String(storeId), page: String(exportPage), limit: String(exportLimit) });
        if (paymentMethod) params.set("payment_method", paymentMethod);
        if (startDate) params.set("start_date", startDate);
        if (endDate) params.set("end_date", endDate);
        if (categoryId) params.set("category_id", categoryId);
        const data = await api<SalesListResponse>("/sales?" + params.toString(), { refresh: true });
        const batch = Array.isArray(data.sales) ? data.sales : [];
        allRows.push(...batch);
        if (batch.length < exportLimit) break;
        if (++exportPage > 10000) throw new Error("Export stopped because the result set is unexpectedly large.");
      }
      const term = query.trim().toLowerCase();
      const rowsToExport = term ? allRows.filter((sale) => String(sale.id).includes(term) || (sale.client_transaction_id ?? "").toLowerCase().includes(term)) : allRows;
      const totalSales = rowsToExport.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
      const totalPaid = rowsToExport.reduce((sum, sale) => sum + Number(sale.amount_paid || 0), 0);
      const totalBalance = rowsToExport.reduce((sum, sale) => sum + Number(sale.balance || 0), 0);
      const filename = "retailos-transactions-" + (startDate || "all") + "-to-" + (endDate || "today") + "-" + dateForFilename();
      if (format === "csv") {
        const lines = [["Sale ID","Transaction ID","Date","Customer","Payment Method","Product ID","Product","Category ID","Category","Quantity","Unit","Unit Conversion","Unit Price","Line Total","Transaction Total","Amount Paid","Balance","Refunded Amount","Net Amount"].map(csvCell).join(",")];
        for (const sale of rowsToExport) {
          for (const item of (sale.items?.length ? sale.items : [null])) {
            lines.push([sale.id,sale.client_transaction_id,sale.created_at,customerName(sale.customer_id),sale.payment_method,item?.product_id,item?.product_name,item?.category_id,item?.category_name,item?.quantity,item?.unit ?? item?.unit_name,item?.unit_conversion,item?.sale_price ?? item?.unit_price ?? item?.price_at_sale,item?.line_total ?? item?.total,sale.total_amount,sale.amount_paid,sale.balance,sale.refunded_amount ?? 0,sale.net_amount ?? sale.total_amount].map(csvCell).join(","));
          }
        }
        lines.push("");
        lines.push(["TOTALS","","","","","","","","","","","","",totalSales,totalPaid,totalBalance].map(csvCell).join(","));
        const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = filename + ".csv";
        document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
        return;
      }
      if (!printWindow) throw new Error("Unable to open PDF export window.");
      const tableRows = rowsToExport.map((sale) => {
        const items = (sale.items ?? []).map((item) => "<li>" + escapeHtml(item.product_name ?? ("Product #" + (item.product_id ?? ""))) + ": " + escapeHtml(item.quantity ?? "") + " " + escapeHtml(item.unit ?? item.unit_name ?? "") + " · " + escapeHtml(money(item.line_total ?? item.total ?? 0)) + "</li>").join("");
        return "<tr><td>" + escapeHtml(formatNigeriaDateTime(sale.created_at)) + "<br><small>#" + sale.id + "</small></td><td>" + escapeHtml(customerName(sale.customer_id)) + "</td><td>" + escapeHtml(sale.payment_method) + "</td><td>" + (items ? "<ul>" + items + "</ul>" : "Item details unavailable") + "</td><td>" + escapeHtml(money(sale.total_amount)) + "</td><td>" + escapeHtml(money(sale.amount_paid)) + "</td><td>" + escapeHtml(money(sale.balance)) + "</td></tr>";
      }).join("");
      const categoryName = categories.find((category) => String(category.id) === categoryId)?.name || "All categories";
      printWindow.document.write("<!doctype html><html><head><meta charset='utf-8'><title>" + escapeHtml(filename) + "</title><style>body{font:12px Arial;color:#222;margin:28px}h1{font-size:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left;vertical-align:top}th{background:#eee}ul{margin:0;padding-left:16px}@media print{tr{break-inside:avoid}}</style></head><body><h1>RetailOS Transactions</h1><p>Dates: " + escapeHtml(startDate || "All dates") + " to " + escapeHtml(endDate || "Today") + " · Category: " + escapeHtml(categoryName) + " · Payment: " + escapeHtml(paymentMethod || "All methods") + "</p><p>Transactions: " + rowsToExport.length + " · Total sales: " + escapeHtml(money(totalSales)) + " · Paid: " + escapeHtml(money(totalPaid)) + " · Balance: " + escapeHtml(money(totalBalance)) + "</p><table><thead><tr><th>Date / Sale</th><th>Customer</th><th>Payment</th><th>Items</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead><tbody>" + (tableRows || "<tr><td colspan='7'>No transactions match these filters.</td></tr>") + "</tbody></table><script>window.addEventListener('load',()=>window.print());</script></body></html>");
      printWindow.document.close(); printWindow.focus();
    } catch (cause) {
      printWindow?.close();
      setError(cause instanceof Error ? "Export failed: " + cause.message : "Export failed. Please try again.");
    } finally { exportInProgress.current = false; setExporting(null); }
  }

  async function showDetails(id: number) {
    if (!storeId) return;
    setDetailsLoading(true);
    setSelectedReceipt(null);
    setError("");
    try {
      const params = new URLSearchParams({ id: String(id), store_id: String(storeId) });
      const data = await api<{ receipt: Receipt }>(`/sales/get?${params.toString()}`);
      setSelectedReceipt(data.receipt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load sale details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  const remainingRefundable = selectedSale ? Math.max(0, Number(selectedSale.amount_paid || 0) - Number(selectedSale.refunded_amount || 0)) : 0;

  function openRefundForm() {
    if (!selectedSale || remainingRefundable <= 0) return;
    setRefundAmount(remainingRefundable.toFixed(2)); setRefundReason(""); setRefundPaymentMethod(selectedSale.payment_method);
    setRefundError(""); refundRequestRef.current = null; setShowRefundForm(true);
  }

  async function submitRefund() {
    if (!storeId || !selectedSale || refundSubmitting) return;
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) { setRefundError("Enter a valid refund amount with no more than two decimal places."); return; }
    if (amount > remainingRefundable) { setRefundError("Refund amount exceeds the remaining refundable amount of " + money(remainingRefundable) + "."); return; }
    if (!refundReason.trim()) { setRefundError("A refund reason is required."); return; }
    if (!window.confirm("Confirm refund of " + money(amount) + " for sale #" + selectedSale.id + "? This action will be recorded.")) return;
    const signature = JSON.stringify({ store_id: storeId, sale_id: selectedSale.id, amount: amount.toFixed(2), reason: refundReason.trim(), payment_method: refundPaymentMethod });
    if (!refundRequestRef.current || refundRequestRef.current.signature !== signature) refundRequestRef.current = { signature, id: "REFUND-" + crypto.randomUUID() };
    setRefundSubmitting(true); setRefundError(""); setError(""); setRefundSuccessMessage("");
    try {
      const data = await api<{ refund: RefundRecord }>("/sales/refunds", { method: "POST", body: JSON.stringify({ store_id: storeId, sale_id: selectedSale.id, amount: amount.toFixed(2), reason: refundReason.trim(), payment_method: refundPaymentMethod, client_transaction_id: refundRequestRef.current!.id }), refresh: true });
      setRefundReceipt(data.refund.receipt); setShowRefundForm(false); setRefundSuccessMessage("Refund " + data.refund.reference + " recorded successfully."); refundRequestRef.current = null;
      setSelectedSale({ ...selectedSale, refunded_amount: Number(selectedSale.refunded_amount || 0) + Number(data.refund.amount), net_amount: Number(selectedSale.total_amount) - Number(selectedSale.refunded_amount || 0) - Number(data.refund.amount) });
      await load(); await showDetails(selectedSale.id);
    } catch (cause) { setRefundError(cause instanceof Error ? cause.message : "Unable to process this refund."); }
    finally { setRefundSubmitting(false); }
  }

  function printRefundReceipt() {
    if (!refundReceipt) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { setRefundError("The print window was blocked. Allow pop-ups and try again."); return; }
    printWindow.document.write("<!doctype html><html><head><meta charset=\"utf-8\"><title>Refund " + escapeHtml(refundReceipt.refund_reference) + "</title><style>body{font:14px Arial,sans-serif;margin:32px;color:#111}pre{white-space:pre-wrap;font:inherit}</style></head><body><pre>" + escapeHtml(refundReceipt.printable_text) + "</pre><script>window.addEventListener(\"load\",()=>window.print());</script></body></html>");
    printWindow.document.close(); printWindow.focus();
  }
  return (
    <DashboardShell title="Transactions">
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      <section data-tour="transactions-search-panel" className="rounded-2xl border border-white/10 bg-[#151515] p-4 sm:p-5">
        <div data-tour="transactions-filters" className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <input
            aria-label="Search transactions"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Search by sale ID or transaction ID"
            className="field"
          />
          <label className="flex flex-col gap-1 text-xs text-white/50">Start date
            <input aria-label="Filter start date" type="date" value={startDate} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} className="field" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/50">End date
            <input aria-label="Filter end date" type="date" value={endDate} min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} className="field" />
          </label>
          <select aria-label="Filter by category" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPage(1); }} className="field">
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select
            aria-label="Filter by payment method"
            value={paymentMethod}
            onChange={(event) => { setPaymentMethod(event.target.value); setPage(1); }}
            className="field"
          >
            <option value="">All payment methods</option>
            <option value="Cash">Cash</option>
            <option value="Transfer">Transfer</option>
            <option value="POS">POS</option>
          </select>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/50">Active filters:</span>
          {activeFilters.length > 0 ? activeFilters.map((filter) => (
            <span key={filter.key} className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs text-orange-200">
              {filter.label}
            </span>
          )) : <span className="text-xs text-white/40">None</span>}
          <button
            type="button"
            onClick={clearFilters}
            disabled={activeFilters.length === 0}
            className="min-w-[112px] rounded-lg border border-white/15 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear Filters
          </button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-xl border border-white/10 p-3">
            <p className="text-xs text-white/45">Matching transactions</p>
            <p className="mt-1 text-lg font-semibold">{visibleRows.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            <p className="text-xs text-white/45">Total sales</p>
            <p className="mt-1 text-lg font-semibold">{money(filteredTotals.sales)}</p>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            <p className="text-xs text-white/45">Amount paid</p>
            <p className="mt-1 text-lg font-semibold">{money(filteredTotals.paid)}</p>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            <p className="text-xs text-white/45">Outstanding balance</p>
            <p className="mt-1 text-lg font-semibold">{money(filteredTotals.balance)}</p>
          </div>
          <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-white/45">Refunded</p><p className="mt-1 text-lg font-semibold">{money(filteredTotals.refunded)}</p></div>
          <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-white/45">Net sales</p><p className="mt-1 text-lg font-semibold">{money(filteredTotals.net)}</p></div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void exportTransactions("pdf")} disabled={exporting !== null || loading || visibleRows.length === 0} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
            {exporting === "pdf" ? "Preparing PDF…" : "Export PDF"}
          </button>
          <button type="button" onClick={() => void exportTransactions("csv")} disabled={exporting !== null || loading || visibleRows.length === 0} className="rounded-lg border border-white/15 px-4 py-2 text-sm disabled:opacity-50">
            {exporting === "csv" ? "Preparing CSV…" : "Export CSV"}
          </button>
          {exporting && <span role="status" className="text-xs text-white/50">Loading all matching transactions…</span>}
        </div>

        <div data-tour="transactions-table" className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="text-xs text-white/40">
              <tr>
                {["DATE", "SALE", "CUSTOMER", "TOTAL", "PAYMENT", "PAID", "BALANCE", "DETAILS"].map((heading) =>
                  <th key={heading} className="px-3 py-3">{heading}</th>,
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-white/40">Loading transactions…</td></tr>
              ) : paginatedRows.map((sale) => (
                <tr key={sale.id} className="border-t border-white/5">
                  <td className="px-3 py-4">{formatNigeriaDateTime(sale.created_at)}</td>
                  <td className="px-3 py-4">
                    <strong>#{sale.id}</strong>
                    {sale.client_transaction_id && <p className="mt-1 text-xs text-white/40">{sale.client_transaction_id}</p>}
                  </td>
                  <td className="px-3 py-4">{customerName(sale.customer_id)}</td>
                  <td className="px-3 py-4">{money(sale.total_amount)}</td>
                  <td className="px-3 py-4">{sale.payment_method}</td>
                  <td className="px-3 py-4">{money(sale.amount_paid)}</td>
                  <td className="px-3 py-4">{money(sale.balance)}</td>
                  <td className="px-3 py-4">
                    <button type="button" onClick={() => { setSelectedSale(sale); setRefundError(""); setRefundSuccessMessage(""); setRefundReceipt(null); setShowRefundForm(false); void showDetails(sale.id); }} className="rounded bg-white/10 px-3 py-2 text-xs">
                      View receipt
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && visibleRows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-white/40">No transactions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {!loading && visibleRows.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-2 text-sm text-white/60">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="px-3 py-1.5 rounded border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span>Page {page}</span>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(p + 1, pageCount))}
              className="px-3 py-1.5 rounded border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </section>

      {detailsLoading && <p role="status" className="mt-4 text-sm text-white/50">Loading sale details…</p>}
      {selectedReceipt && (
        <section className="mt-6 rounded-2xl border border-orange-500/20 bg-[#151515] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">Sale #{selectedReceipt.sale_id}</h2>
              <p className="mt-1 text-sm text-white/50">{formatNigeriaDateTime(selectedReceipt.created_at)}</p>
            </div>
            <button type="button" onClick={() => setSelectedReceipt(null)} className="text-sm text-white/50">Close</button>
          </div>
          {selectedSale && Number(selectedSale.amount_paid || 0) > Number(selectedSale.refunded_amount || 0) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
              <div className="text-sm"><p className="font-medium">Refund eligible</p><p className="text-xs text-white/50">Remaining refundable amount: {money(Math.max(0, Number(selectedSale.amount_paid || 0) - Number(selectedSale.refunded_amount || 0)))}</p></div>
              <button type="button" onClick={openRefundForm} disabled={refundSubmitting} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Refund sale</button>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {selectedReceipt.items.map((item, index) => (
              <div key={`${item.product_id}-${index}`} className="flex justify-between gap-4 border-b border-white/5 py-2 text-sm">
                <span>
                  Product #{item.product_id} · {item.quantity} {item.unit_name ?? ""}
                  <span className="mt-1 block text-xs text-white/45">
                    Unit price at sale: {money(item.price_at_sale ?? (Number(item.total) / Math.max(item.quantity, 1)))}
                  </span>
                </span>
                <span>{money(item.total)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-sm">
            <p>Total: {money(selectedReceipt.total_amount)}</p>
            <p>Paid: {money(selectedReceipt.amount_paid)}</p>
            <p>Balance: {money(selectedReceipt.balance)}</p>
          </div>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-white/60">{selectedReceipt.printable_text}</pre>
        </section>
      )}
      {showRefundForm && selectedSale && selectedReceipt && (
        <section className="mt-4 rounded-2xl border border-orange-500/30 bg-[#151515] p-5" aria-labelledby="refund-title">
          <h2 id="refund-title" className="font-semibold">Confirm refund for sale #{selectedSale.id}</h2>
          <p className="mt-1 text-sm text-white/50">Original transaction: {selectedSale.client_transaction_id || ("Sale #" + selectedSale.id)} · {formatNigeriaDateTime(selectedSale.created_at)} · {selectedSale.payment_method}</p>
          <div className="mt-3 rounded-lg bg-black/20 p-3 text-sm"><p>Original sale total: {money(selectedReceipt.total_amount)}</p><p>Amount paid: {money(selectedReceipt.amount_paid)}</p><p>Outstanding balance: {money(selectedReceipt.balance)}</p><p>Previously refunded: {money(selectedSale.refunded_amount || 0)}</p><p className="font-semibold">Remaining refundable: {money(remainingRefundable)}</p></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-white/60">Refund amount (₦)<input aria-label="Refund amount" type="number" inputMode="decimal" min="0.01" max={remainingRefundable} step="0.01" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} className="field" disabled={refundSubmitting} /></label>
            <label className="flex flex-col gap-1 text-sm text-white/60">Refund payment method<select aria-label="Refund payment method" value={refundPaymentMethod} onChange={(event) => setRefundPaymentMethod(event.target.value as "Cash" | "Transfer" | "POS")} className="field" disabled={refundSubmitting}><option value="Cash">Cash</option><option value="Transfer">Transfer</option><option value="POS">POS</option></select></label>
            <label className="flex flex-col gap-1 text-sm text-white/60 md:col-span-2">Reason for refund<textarea aria-label="Reason for refund" value={refundReason} maxLength={500} onChange={(event) => setRefundReason(event.target.value)} className="field min-h-24" placeholder="Explain why this refund is being issued" disabled={refundSubmitting} /></label>
          </div>
          {refundError && <p role="alert" className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{refundError}</p>}
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void submitRefund()} disabled={refundSubmitting || !refundReason.trim() || !refundAmount} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{refundSubmitting ? "Processing refund…" : "Confirm refund"}</button><button type="button" onClick={() => { setShowRefundForm(false); setRefundError(""); }} disabled={refundSubmitting} className="rounded-lg border border-white/15 px-4 py-2 text-sm disabled:opacity-50">Cancel</button></div>
        </section>
      )}
      {refundSuccessMessage && <p role="status" className="mt-4 rounded-xl bg-green-500/10 p-3 text-sm text-green-300">{refundSuccessMessage}</p>}
      {refundReceipt && (
        <section className="mt-4 rounded-2xl border border-white/10 bg-[#151515] p-5" aria-labelledby="refund-receipt-title">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="refund-receipt-title" className="font-semibold">Refund receipt · {refundReceipt.refund_reference}</h2><p className="mt-1 text-sm text-white/50">Original sale: #{refundReceipt.original_sale_id}{refundReceipt.original_sale_reference ? " · " + refundReceipt.original_sale_reference : ""}</p></div><button type="button" onClick={printRefundReceipt} className="rounded-lg border border-white/15 px-4 py-2 text-sm">Print / Save PDF</button></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm"><div><p className="text-xs text-white/45">Refund amount</p><p className="font-semibold">{money(refundReceipt.amount)}</p></div><div><p className="text-xs text-white/45">Refund date</p><p>{formatNigeriaDateTime(refundReceipt.created_at)}</p></div><div><p className="text-xs text-white/45">Payment method</p><p>{refundReceipt.payment_method}</p></div></div>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-white/70">{refundReceipt.printable_text}</pre>
        </section>
      )}
    </DashboardShell>
  );
}
