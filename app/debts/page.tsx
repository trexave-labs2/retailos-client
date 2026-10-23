"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import { formatNigeriaDateTime } from "@/lib/nigeria-time";
import type { Receipt } from "@/lib/types";

type OwingCustomer = {
  id: number;
  name: string;
  contact: string | null;
  outstanding_balance: string;
};

type OutstandingSale = {
  id: number;
  customer_id: number | null;
  total_amount: string;
  amount_paid: string;
  balance: string;
  payment_method: "Cash" | "Transfer" | "POS";
  created_at: string;
};

type RecordedPayment = {
  id: number;
  amount: string;
  payment_method: "Cash" | "Transfer" | "POS";
  created_at: string;
};

type PaymentHistory = {
  sale_id: number;
  total_amount: string;
  amount_paid: string;
  balance: string;
  payments: RecordedPayment[];
};

type PendingPayment = {
  clientTransactionId: string;
  amount: string;
  paymentMethod: "Cash" | "Transfer" | "POS";
};

const money = (value: string | number) =>
  "₦" + Number(value).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function DebtsPage() {
  const { user } = useAuth();
  const storeId = user?.store_id ?? null;
  const [customers, setCustomers] = useState<OwingCustomer[]>([]);
  const [sales, setSales] = useState<OutstandingSale[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState("0.00");
  const [selectedSale, setSelectedSale] = useState<OutstandingSale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Transfer" | "POS">("Cash");
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [updatedReceipt, setUpdatedReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const paymentLock = useRef(false);

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const load = useCallback(async () => {
    if (!storeId) {
      setCustomers([]);
      setSales([]);
      setError("No store is associated with this account.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [owingData, salesData] = await Promise.all([
        api<{ customers: OwingCustomer[]; total_outstanding: string }>(
          `/customers/owes?store_id=${encodeURIComponent(String(storeId))}`,
        ),
        api<{ sales: OutstandingSale[] }>(
          `/sales?store_id=${encodeURIComponent(String(storeId))}`,
        ),
      ]);
      const owingCustomers = Array.isArray(owingData.customers) ? owingData.customers : [];
      const owingCustomerIds = new Set(owingCustomers.map((customer) => customer.id));
      const outstandingSales = (Array.isArray(salesData.sales) ? salesData.sales : [])
        .filter((sale) => Number(sale.balance) > 0 && sale.customer_id !== null && owingCustomerIds.has(sale.customer_id));
      setCustomers(owingCustomers);
      setSales(outstandingSales);
      setTotalOutstanding(owingData.total_outstanding ?? "0.00");
      setSelectedSale((current) => current ? outstandingSales.find((sale) => sale.id === current.id) ?? current : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load outstanding balances.");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  async function openPayment(sale: OutstandingSale) {
    setSelectedSale(sale);
    setPaymentAmount("");
    setPaymentMethod("Cash");
    setPendingPayment(null);
    setPaymentHistory(null);
    setHistoryError("");
    setUpdatedReceipt(null);
    setError("");
    setMessage("");
    if (!storeId) return;

    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ store_id: String(storeId), sale_id: String(sale.id) });
      const data = await api<PaymentHistory>(`/sales/payments?${params.toString()}`, { refresh: true });
      setPaymentHistory(data);
      setHistoryError("");
    } catch (cause) {
      const status = typeof cause === "object" && cause !== null && "status" in cause ? Number((cause as { status?: unknown }).status) : 0;
      const reason = status === 404
        ? "The connected server does not expose the payment-history endpoint. Deploy the latest retailos-server version, then refresh this sale."
        : cause instanceof Error ? cause.message : "Unable to load payment history.";
      setHistoryError(reason);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeId || !selectedSale || paymentLock.current || savingPayment) return;

    const amount = Number(paymentAmount);
    const remaining = Number(selectedSale.balance);
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(paymentAmount.trim())) {
      setError("Enter a payment amount greater than zero with no more than two decimal places.");
      return;
    }
    if (amount > remaining) {
      setError(`Payment cannot exceed the remaining balance of ${money(remaining)}.`);
      return;
    }

    // Keep the same key and exact payload when retrying an uncertain request.
    // The server uses this key to prevent duplicate collections.
    const request = pendingPayment ?? {
      clientTransactionId: crypto.randomUUID(),
      amount: paymentAmount.trim(),
      paymentMethod,
    };
    if (pendingPayment && (pendingPayment.amount !== paymentAmount.trim() || pendingPayment.paymentMethod !== paymentMethod)) {
      setError("A previous payment attempt may have reached the server. Retry its original amount and method, or explicitly start a new attempt only after checking payment history.");
      return;
    }

    paymentLock.current = true;
    setSavingPayment(true);
    setError("");
    setMessage("");
    setPendingPayment(request);

    try {
      await api("/sales/payments", {
        method: "POST",
        json: {
          store_id: storeId,
          sale_id: selectedSale.id,
          amount: request.amount,
          payment_method: request.paymentMethod,
          client_transaction_id: request.clientTransactionId,
        },
      });

      // The server accepted this transaction ID. Never leave it in retry state
      // merely because a follow-up history or receipt request fails.
      setPendingPayment(null);
      setPaymentAmount("");
      setMessage(`Payment of ${money(request.amount)} was accepted for sale #${selectedSale.id}. Refreshing the balance and receipt…`);

      const params = new URLSearchParams({ store_id: String(storeId), sale_id: String(selectedSale.id) });
      let historyData: PaymentHistory | null = null;
      try {
        historyData = await api<PaymentHistory>(`/sales/payments?${params.toString()}`, { refresh: true });
        setPaymentHistory(historyData);
        setHistoryError("");
        setSelectedSale((current) => current ? { ...current, total_amount: historyData!.total_amount, amount_paid: historyData!.amount_paid, balance: historyData!.balance } : current);
        setSales((current) => Number(historyData!.balance) > 0
          ? current.map((sale) => sale.id === selectedSale.id ? { ...sale, total_amount: historyData!.total_amount, amount_paid: historyData!.amount_paid, balance: historyData!.balance } : sale)
          : current.filter((sale) => sale.id !== selectedSale.id));
        // Derive the collected delta from authoritative sale totals. This avoids
        // subtracting the same amount twice if the server returns an idempotent replay.
        const newlyCollected = Math.max(0, Number(historyData!.amount_paid) - Number(selectedSale.amount_paid));
        setCustomers((current) => current.map((customer) => customer.id === selectedSale.customer_id
          ? { ...customer, outstanding_balance: Math.max(0, Number(customer.outstanding_balance) - newlyCollected).toFixed(2) }
          : customer));
        setTotalOutstanding((current) => Math.max(0, Number(current) - newlyCollected).toFixed(2));
        setMessage(`Payment of ${money(request.amount)} recorded against sale #${selectedSale.id}. Remaining balance: ${money(historyData!.balance)}.`);
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : "Payment was accepted, but the updated payment history could not be loaded.";
        setHistoryError(reason);
        setError(`Payment was accepted by the server, but payment history refresh failed: ${reason}. Do not submit another payment. Refresh this sale to verify the balance.`);
      }

      try {
        const receiptData = await api<{ receipt: Receipt }>("/sales/receipt", {
          method: "POST",
          json: { store_id: storeId, id: selectedSale.id },
        });
        setUpdatedReceipt(receiptData.receipt);
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : "Receipt refresh failed.";
        setError((current) => current ? `${current} Receipt refresh also failed: ${reason}.` : `Payment was recorded, but the receipt could not be refreshed: ${reason}.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment outcome is uncertain. Retry only with the same transaction ID and exact amount/method.");
    } finally {
      paymentLock.current = false;
      setSavingPayment(false);
    }
  }

  function startNewAttempt() {
    setPendingPayment(null);
    setPaymentAmount("");
    setPaymentMethod("Cash");
    setError("");
  }

  return (
    <DashboardShell title="Who Owes Me">
      <style jsx global>{`@media print { body * { visibility: hidden !important; } .payment-receipt, .payment-receipt * { visibility: visible !important; } .payment-receipt { position: absolute; inset: 0; width: 100%; color: #111 !important; background: #fff !important; border: 0 !important; } .payment-receipt pre { color: #111 !important; } }`}</style>
      {message && <p role="status" className="mb-4 rounded-xl bg-green-500/10 p-3 text-sm text-green-300">{message}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      <section data-tour="debts-total" aria-label="Total outstanding" className="mb-5 rounded-2xl border border-orange-500/20 bg-[#151515] p-5">
        <p className="text-sm text-white/50">Total outstanding</p>
        <p className="mt-2 text-2xl font-semibold text-orange-400">{money(totalOutstanding)}</p>
      </section>

      <section data-tour="debts-sales-table" className="rounded-2xl border border-white/10 bg-[#151515] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Outstanding sales</h2>
            <p className="mt-1 text-sm text-white/50">Each balance stays attached to its original sale. Payments are saved as separate transactions.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50">
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[680px] w-full text-left text-sm">
            <thead className="text-xs text-white/40">
              <tr>{["CUSTOMER", "SALE", "SALE DATE", "ORIGINAL TOTAL", "PAID", "REMAINING", "ACTION"].map((heading) =>
                <th key={heading} className="px-3 py-3">{heading}</th>,
              )}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-white/40">Loading outstanding sales…</td></tr>
              ) : sales.map((sale) => {
                const customer = sale.customer_id === null ? undefined : customerById.get(sale.customer_id);
                return (
                  <tr key={sale.id} className="border-t border-white/5">
                    <td className="px-3 py-4">
                      <strong>{customer?.name ?? "Unknown customer"}</strong>
                      <p className="mt-1 text-xs text-white/40">{customer?.contact || "No contact recorded"}</p>
                    </td>
                    <td className="px-3 py-4">#{sale.id}</td>
                    <td className="px-3 py-4 whitespace-nowrap">{formatNigeriaDateTime(sale.created_at)}</td>
                    <td className="px-3 py-4 whitespace-nowrap">{money(sale.total_amount)}</td>
                    <td className="px-3 py-4 whitespace-nowrap">{money(sale.amount_paid)}</td>
                    <td className="px-3 py-4 whitespace-nowrap font-semibold text-orange-300">{money(sale.balance)}</td>
                    <td className="px-3 py-4">
                      <button type="button" onClick={() => void openPayment(sale)} className="whitespace-nowrap rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-black hover:bg-orange-400">
                        Record payment
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && sales.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-white/40">{error ? "Outstanding sales could not be loaded." : "No outstanding sales. All customer balances are settled."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedSale && (
        <section className="mt-5 rounded-2xl border border-orange-500/20 bg-[#151515] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Sale #{selectedSale.id}</h2>
              <p className="mt-1 text-sm text-white/50">{customerById.get(selectedSale.customer_id ?? -1)?.name ?? "Customer"} · {formatNigeriaDateTime(selectedSale.created_at)}</p>
            </div>
            <button type="button" onClick={() => { setSelectedSale(null); setPendingPayment(null); setPaymentHistory(null); setUpdatedReceipt(null); }} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60 hover:bg-white/5">
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-black/20 p-3"><p className="text-xs text-white/40">Original total</p><p className="mt-1 font-semibold">{money(paymentHistory?.total_amount ?? selectedSale.total_amount)}</p></div>
            <div className="rounded-lg bg-black/20 p-3"><p className="text-xs text-white/40">Amount paid</p><p className="mt-1 font-semibold">{money(paymentHistory?.amount_paid ?? selectedSale.amount_paid)}</p></div>
            <div className="rounded-lg bg-black/20 p-3"><p className="text-xs text-white/40">Remaining balance</p><p className="mt-1 font-semibold text-orange-300">{money(paymentHistory?.balance ?? selectedSale.balance)}</p></div>
          </div>

          <form onSubmit={(event) => void recordPayment(event)} className="mt-5 grid gap-3 rounded-xl border border-white/10 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block text-sm text-white/70">
              Amount received (₦)
              <input
                aria-label="Amount received"
                type="number"
                inputMode="decimal"
                min="0.01"
                max={paymentHistory?.balance ?? selectedSale.balance}
                step="0.01"
                required
                value={paymentAmount}
                disabled={savingPayment || Boolean(pendingPayment)}
                onChange={(event) => setPaymentAmount(event.target.value)}
                className="field mt-1"
                placeholder="3000.00"
              />
            </label>
            <label className="block text-sm text-white/70">
              Payment method
              <select aria-label="Payment method" value={paymentMethod} disabled={savingPayment || Boolean(pendingPayment)} onChange={(event) => setPaymentMethod(event.target.value as "Cash" | "Transfer" | "POS")} className="field mt-1">
                <option value="Cash">Cash</option>
                <option value="Transfer">Transfer</option>
                <option value="POS">POS</option>
              </select>
            </label>
            <button type="submit" disabled={savingPayment || Number(paymentHistory?.balance ?? selectedSale.balance) <= 0} className="rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">
              {savingPayment ? "Saving payment…" : pendingPayment ? "Retry payment" : "Confirm payment"}
            </button>
            {pendingPayment && !savingPayment && (
              <div className="sm:col-span-3">
                <p className="text-xs text-amber-200/80">Retry uses the same payment ID to prevent duplicate collection. Check payment history before starting a different attempt.</p>
                <button type="button" onClick={startNewAttempt} className="mt-2 text-xs text-white/60 underline underline-offset-4">Start a new attempt</button>
              </div>
            )}
          </form>

          <div className="mt-5">
            <h3 className="font-semibold">Payment history</h3>
            {historyLoading ? (
              <p role="status" className="mt-2 text-sm text-white/40">Loading payment history…</p>
            ) : historyError ? (
              <p role="alert" className="mt-2 text-sm text-red-300">Payment history could not be verified: {historyError}. Do not start another payment attempt.</p>
            ) : paymentHistory && paymentHistory.payments.length > 0 ? (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-white/40"><tr><th className="px-3 py-2">DATE</th><th className="px-3 py-2">METHOD</th><th className="px-3 py-2">AMOUNT RECEIVED</th></tr></thead>
                  <tbody>{paymentHistory.payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-white/5">
                      <td className="px-3 py-3">{formatNigeriaDateTime(payment.created_at)}</td>
                      <td className="px-3 py-3">{payment.payment_method}</td>
                      <td className="px-3 py-3">{money(payment.amount)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-sm text-white/40">{historyLoading ? "" : "No additional collections have been recorded for this sale yet."}</p>
            )}
          </div>

          {updatedReceipt && (
            <section className="payment-receipt mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">Updated receipt · Sale #{updatedReceipt.sale_id}</h3>
                <button type="button" onClick={() => window.print()} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5">Print receipt</button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap text-xs text-white/70">{updatedReceipt.printable_text}</pre>
              <p className="mt-3 text-sm">Remaining balance: <strong>{money(updatedReceipt.balance)}</strong></p>
            </section>
          )}
        </section>
      )}
    </DashboardShell>
  );
}