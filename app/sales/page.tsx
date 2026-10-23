
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { api, ApiError } from "@/lib/api";
import type { Customer, Product, ProductUnit, Receipt, SaleSummary } from "@/lib/types";

type SalesProduct = Product;
type Unit = ProductUnit;

type CartItem = {
  product: SalesProduct;
  unitId: number;
  quantity: number;
  price: number;
};

type OfflineSaleItem = {
  product_id: number;
  unit_id: number;
  quantity: number;
  unit_price?: number;
  expected_unit_price?: number;
};

type OfflineSalePayload = {
  store_id: number;
  customer_id: number | null;
  client_transaction_id: string;
  payment_method: "Cash" | "Transfer" | "POS";
  amount_paid: number;
  items: OfflineSaleItem[];
};

type PendingSale = {
  id: string;
  createdAt: string;
  total: number;
  customerLabel: string;
  payload: OfflineSalePayload;
  status: "pending" | "syncing" | "failed" | "conflict";
  message?: string;
  code?: string;
  retryable: boolean;
  catalog?: SalesProduct[];
};

type OfflineSnapshot = {
  cart: CartItem[];
  customerId: string;
  paid: string;
  paymentMethod: string;
  transactionId: string;
  pendingSales: PendingSale[];
};

const normalizePhone = (value: string) => value.replace(/\D/g, "");

function checkoutFailureMessage(cause: unknown): string {
  if (!(cause instanceof ApiError)) {
    return "The server could not be reached or the response was interrupted. Your sale details are saved as pending. Do not start a second sale; retry using the same reference.";
  }

  const code = (cause.code ?? "").toUpperCase();
  if (/STALE_PRICE|PRICE_CHANGED|PRICE_MISMATCH/.test(code) || /price.*chang|chang.*price/i.test(cause.message)) {
    return "A product price changed before checkout. No sale was confirmed. Review the updated price and total, then submit the corrected sale as a new attempt.";
  }
  if (/STOCK|INSUFFICIENT_QUANTITY|OUT_OF_STOCK/.test(code) || /stock.*(insufficient|available)|insufficient stock/i.test(cause.message)) {
    return "There is not enough stock for one or more items. Your cart and entered checkout details are still here. Reduce the quantity or refresh stock before trying again.";
  }
  if (/VALIDATION|INVALID|REQUIRED|BAD_REQUEST/.test(code) || cause.status === 400 || cause.status === 422) {
    return `Checkout needs a correction: ${cause.message}. Your cart and entered checkout details have been kept.`;
  }
  if (cause.status === 401 || cause.status === 403) {
    return "Your session or store access could not be verified. Sign in again and check the sale before submitting. Your entered checkout details have been kept.";
  }
  if (code.includes("IDEMPOTENCY_KEY_REUSED")) {
    return "This transaction reference is already associated with different sale details. Do not retry with a new reference blindly. Reconcile the original sale with the server first.";
  }
  if (cause.status === 409) {
    return `The server rejected this checkout because the sale conflicts with current records: ${cause.message}. Review the details before trying again.`;
  }
  if (cause.status >= 500) {
    return "RetailOS encountered a server error while processing checkout. The result may be uncertain, so the sale is kept pending with the same reference for safe recovery.";
  }
  return `Checkout could not be completed: ${cause.message}. Your entered details have been kept.`;
}

const money = (value: number) =>
  "₦" +
  value.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function SalesPage() {
  const { user } = useAuth();
  const storeId = user?.store_id ?? null;
  const accountStorageKey = user && storeId
    ? `retailos:offline-checkout:v1:user:${user.id}:store:${storeId}`
    : null;

  const [products, setProducts] = useState<SalesProduct[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [query, setQuery] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerContact, setNewCustomerContact] = useState("");
  const [allowDuplicateContact, setAllowDuplicateContact] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paid, setPaid] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState("");
  const [storageReadFailed, setStorageReadFailed] = useState(false);
  const syncingIds = useRef(new Set<string>());

  const checkoutLock = useRef(false);
  const accountReady = Boolean(accountStorageKey && hydratedKey === accountStorageKey && !storageReadFailed);

  useEffect(() => {
    let cancelled = false;
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    void Promise.resolve().then(() => {
      if (!cancelled) updateOnlineStatus();
    });
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      cancelled = true;
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (!accountStorageKey) {
        setHydratedKey(null);
        setCart([]);
        setPendingSales([]);
        setCustomerId("");
        setPaid("");
        setTransactionId("");
        return;
      }

      setStorageReadFailed(false);
      try {
        const raw = localStorage.getItem(accountStorageKey);
        const saved = raw ? JSON.parse(raw) as Partial<OfflineSnapshot> : {};
        setCart(Array.isArray(saved.cart) ? saved.cart : []);
        setCustomerId(typeof saved.customerId === "string" ? saved.customerId : "");
        setPaid(typeof saved.paid === "string" ? saved.paid : "");
        setPaymentMethod(typeof saved.paymentMethod === "string" ? saved.paymentMethod : "CASH");
        setTransactionId(typeof saved.transactionId === "string" ? saved.transactionId : "");
        setPendingSales(Array.isArray(saved.pendingSales)
          ? saved.pendingSales.map((sale) => ({
              ...sale,
              status: sale.status === "syncing" ? "pending" : sale.status,
            }))
          : []);
        setStorageWarning("");
      } catch {
        setStorageReadFailed(true);
        setStorageWarning("RetailOS could not read saved checkout data. Do not clear browser storage or close this tab until you have recovered the saved data.");
        setCart([]);
        setPendingSales([]);
        setCustomerId("");
        setPaid("");
        setTransactionId("");
      }
      setHydratedKey(accountStorageKey);
    });
    return () => { cancelled = true; };
  }, [accountStorageKey]);

  useEffect(() => {
    if (!accountStorageKey || hydratedKey !== accountStorageKey || storageReadFailed) return;
    try {
      const snapshot: OfflineSnapshot = { cart, customerId, paid, paymentMethod, transactionId, pendingSales };
      localStorage.setItem(accountStorageKey, JSON.stringify(snapshot));
    } catch {
      void Promise.resolve().then(() => {
        setStorageWarning("Browser storage is unavailable or full. Checkout data may be lost on refresh. Do not queue an offline sale until storage works again.");
      });
    }
  }, [accountStorageKey, hydratedKey, storageReadFailed, cart, customerId, paid, paymentMethod, transactionId, pendingSales]);

  useEffect(() => {
    if (!accountReady) return;
    const hasUnsyncedData = cart.length > 0 || pendingSales.length > 0;
    if (!hasUnsyncedData) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [accountReady, cart.length, pendingSales]);

  const load = useCallback(async () => {
    if (!storeId) {
      setError("No store is associated with this account.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [productData, customerData, salesData] = await Promise.all([
        api<{ products: SalesProduct[] }>(
          `/product/list?store_id=${encodeURIComponent(String(storeId))}`,
          { refresh: true },
        ),
        api<{ customers: Customer[] }>(
          `/customers?store_id=${encodeURIComponent(String(storeId))}`,
        ),
        api<{ sales: SaleSummary[] }>(
          `/sales?store_id=${encodeURIComponent(String(storeId))}`,
        ),
      ]);

      setProducts(productData.products ?? []);
      setCustomers(customerData.customers ?? []);
      setSales(salesData.sales ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load sales.");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const syncPendingSale = useCallback(async (sale: PendingSale) => {
    if (!navigator.onLine || syncingIds.current.has(sale.id)) return;
    syncingIds.current.add(sale.id);
    setPendingSales((current) => current.map((item) =>
      item.id === sale.id ? { ...item, status: "syncing", message: "Sending this sale to the server…" } : item,
    ));

    try {
      const result = await api<{
        sync_status?: "accepted" | "already_processed" | "rejected";
        receipt?: Receipt;
        sale?: { id: number };
      }>("/sales/sync", { method: "POST", json: sale.payload });

      if (result.sync_status === "accepted" || result.sync_status === "already_processed") {
        setPendingSales((current) => current.filter((item) => item.id !== sale.id));
        setMessage(result.sync_status === "already_processed"
          ? `Sale ${sale.id} was already accepted by the server. No duplicate sale was created.`
          : `Sale ${sale.id} was accepted by the server.`);
        setError("");
        void load();
      } else {
        setPendingSales((current) => current.map((item) => item.id === sale.id
          ? { ...item, status: "conflict", retryable: false, message: "The server did not confirm this sale. Review the server response before creating another attempt." }
          : item));
      }
    } catch (cause) {
      const messageText = checkoutFailureMessage(cause);
      const permanent = cause instanceof ApiError && cause.status >= 400 && cause.status < 500;
      const code = cause instanceof ApiError ? cause.code : undefined;
      setPendingSales((current) => current.map((item) => item.id === sale.id
        ? {
            ...item,
            status: permanent ? "conflict" : "failed",
            retryable: !permanent,
            message: messageText,
            code,
          }
        : item));
    } finally {
      syncingIds.current.delete(sale.id);
    }
  }, [load]);

  useEffect(() => {
    if (!accountReady || !isOnline) return;
    pendingSales
      .filter((sale) => sale.status === "pending")
      .forEach((sale) => {
        void Promise.resolve().then(() => syncPendingSale(sale));
      });
  }, [accountReady, isOnline, pendingSales, syncPendingSale]);

  function buildSalePayload(saleTransactionId: string, includeExpectedPrice = false): OfflineSalePayload {
    return {
      store_id: Number(storeId),
      customer_id: customerId ? Number(customerId) : null,
      client_transaction_id: saleTransactionId,
      payment_method: paymentMethod === "CASH" ? "Cash" : paymentMethod === "TRANSFER" ? "Transfer" : "POS",
      amount_paid: amountPaid,
      items: cart.map((item) => ({
        product_id: item.product.id,
        unit_id: item.unitId,
        quantity: item.quantity,
        ...(isServiceProduct(item.product) ? { unit_price: item.price } : {}),
        ...(includeExpectedPrice ? {
          expected_unit_price: Number(unitsFor(item.product).find((unit) => unit.id === item.unitId)?.price ?? item.price),
        } : {}),
      })),
    };
  }

  function savePendingSale(payload: OfflineSalePayload, saleTotal: number, customerLabel: string, recoveryMessage?: string): boolean {
    if (!accountStorageKey || !accountReady || storageReadFailed) {
      setError("Checkout data is still being restored for this account. Wait a moment and try again.");
      return false;
    }
    const pending: PendingSale = {
      id: payload.client_transaction_id,
      createdAt: new Date().toISOString(),
      total: saleTotal,
      customerLabel,
      payload,
      status: "pending",
      retryable: true,
      message: recoveryMessage ?? "Saved on this device. This is not a confirmed sale yet.",
    };
    const nextPending = [...pendingSales.filter((sale) => sale.id !== pending.id), pending];
    const snapshot: OfflineSnapshot = {
      cart: [],
      customerId: "",
      paid: "",
      paymentMethod,
      transactionId: "",
      pendingSales: nextPending,
    };
    try {
      localStorage.setItem(accountStorageKey, JSON.stringify(snapshot));
    } catch {
      setStorageWarning("Browser storage is unavailable or full. The sale was not queued and your cart has been kept on screen.");
      setError("Unable to save this sale locally. Your cart has not been cleared. Check browser storage before retrying.");
      return false;
    }
    setPendingSales(nextPending);
    setCart([]);
    setCustomerId("");
    setCustomerQuery("");
    setPaid("");
    setTransactionId("");
    setReceipt(null);
    setMessage(`Sale saved locally with reference ${pending.id}. It is pending synchronization and is NOT confirmed.`);
    setError("");
    setStorageWarning("");
    return true;
  }

  async function refreshPendingCatalog(saleId: string) {
    if (!storeId || !navigator.onLine) {
      setError("Reconnect to refresh current prices and stock before resolving this conflict.");
      return;
    }
    try {
      const data = await api<{ products: SalesProduct[] }>(
        `/product/list?store_id=${encodeURIComponent(String(storeId))}`,
        { refresh: true },
      );
      setPendingSales((current) => current.map((sale) => sale.id === saleId
        ? { ...sale, catalog: data.products ?? [], message: "Current catalog loaded. Review prices and available stock before confirming a revised attempt." }
        : sale));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not refresh current prices and stock.");
    }
  }

  function pendingReviewTotal(sale: PendingSale): number | null {
    if (!sale.catalog) return null;
    return sale.payload.items.reduce((sum, item) => {
      const product = sale.catalog?.find((entry) => entry.id === item.product_id);
      const unit = product?.units?.find((entry) => entry.id === item.unit_id);
      if (!product || !unit) return sum;
      const price = product.product_type.toLowerCase() === "service"
        ? Number(item.unit_price ?? unit.price)
        : Number(unit.price);
      return sum + price * item.quantity;
    }, 0);
  }

  function updatePendingAmountPaid(saleId: string, amount: number) {
    if (!Number.isFinite(amount) || amount < 0) return;
    setPendingSales((current) => current.map((sale) => sale.id !== saleId ? sale : {
      ...sale,
      payload: { ...sale.payload, amount_paid: amount },
    }));
  }

  function updatePendingQuantity(saleId: string, productId: number, unitId: number, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) return;
    setPendingSales((current) => current.map((sale) => sale.id !== saleId ? sale : {
      ...sale,
      payload: {
        ...sale.payload,
        items: sale.payload.items.map((item) =>
          item.product_id === productId && item.unit_id === unitId ? { ...item, quantity } : item,
        ),
      },
    }));
  }

  function confirmRevisedPendingSale(sale: PendingSale) {
    if (!sale.catalog || !accountStorageKey) return;
    if (sale.code === "IDEMPOTENCY_KEY_REUSED") {
      setError("This transaction reference was reused with different data. Do not retry it with a new reference; reconcile the original sale with the server first.");
      return;
    }

    const currentById = new Map(sale.catalog.map((product) => [product.id, product]));
    const revisedItems: OfflineSaleItem[] = [];
    let issue = "";
    for (const item of sale.payload.items) {
      const product = currentById.get(item.product_id);
      const unit = product?.units?.find((candidate) => candidate.id === item.unit_id);
      if (!product || !unit) {
        issue = `The selected product or selling unit for item #${item.product_id} no longer exists. Remove this item or reconcile it manually before retrying.`;
        break;
      }
      revisedItems.push({
        ...item,
        expected_unit_price: Number(unit.price),
        ...(product.product_type.toLowerCase() === "service" ? { unit_price: item.unit_price ?? Number(unit.price) } : { unit_price: undefined }),
      });
    }
    if (issue) { setError(issue); return; }

    const baseTotals = new Map<number, number>();
    for (const item of revisedItems) {
      const product = currentById.get(item.product_id)!;
      const unit = product.units.find((candidate) => candidate.id === item.unit_id)!;
      if (product.product_type.toLowerCase() !== "service") {
        baseTotals.set(product.id, (baseTotals.get(product.id) ?? 0) + item.quantity * Number(unit.base_quantity));
      }
    }
    for (const [productId, quantity] of baseTotals) {
      const product = currentById.get(productId)!;
      if (quantity > Number(product.stock_quantity ?? 0)) {
        setError(`Current stock for ${product.name} is still insufficient. Reduce the quantity before confirming the revised attempt.`);
        return;
      }
    }

    const revisedTotal = revisedItems.reduce((sum, item) => {
      const product = currentById.get(item.product_id)!;
      const unit = product.units.find((candidate) => candidate.id === item.unit_id)!;
      const unitPrice = product.product_type.toLowerCase() === "service" ? Number(item.unit_price ?? unit.price) : Number(unit.price);
      return sum + unitPrice * item.quantity;
    }, 0);
    const revisedAmountPaid = sale.payload.amount_paid >= sale.total
      ? revisedTotal
      : sale.payload.amount_paid;
    if (revisedAmountPaid > revisedTotal) {
      setError("The previous amount paid is greater than the revised total. Adjust the amount paid before retrying.");
      return;
    }
    const newId = crypto.randomUUID();
    const revisedPayload: OfflineSalePayload = {
      ...sale.payload,
      client_transaction_id: newId,
      amount_paid: revisedAmountPaid,
      items: revisedItems,
    };
    const revised: PendingSale = {
      ...sale,
      id: newId,
      createdAt: new Date().toISOString(),
      total: revisedTotal,
      payload: revisedPayload,
      status: "pending",
      retryable: true,
      message: "Revised sale created after explicit review. Waiting for server acceptance.",
      catalog: undefined,
      code: undefined,
    };
    const nextPending = [...pendingSales.filter((item) => item.id !== sale.id), revised];
    const snapshot: OfflineSnapshot = { cart, customerId, paid, paymentMethod, transactionId, pendingSales: nextPending };
    try {
      localStorage.setItem(accountStorageKey, JSON.stringify(snapshot));
    } catch {
      setStorageWarning("Browser storage is unavailable or full. The revised attempt was not created.");
      setError("Could not save the revised sale locally. No new attempt was submitted.");
      return;
    }
    setPendingSales(nextPending);
    setMessage(`Created revised attempt ${newId} after your confirmation. The rejected payload was replaced with the reviewed version.`);
    setError("");
  }


  const filteredCustomers = useMemo(() => {
    const term = customerQuery.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) => customer.name.toLowerCase().includes(term) || (customer.contact ?? "").toLowerCase().includes(term));
  }, [customers, customerQuery]);

  const duplicateContactCustomers = useMemo(() => {
    const normalized = normalizePhone(newCustomerContact);
    if (normalized.length < 7) return [];
    return customers.filter((customer) => normalizePhone(customer.contact ?? "") === normalized);
  }, [customers, newCustomerContact]);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        product.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [products, query],
  );

  const total = useMemo(
    () =>
      Math.round(
        cart.reduce((sum, item) => sum + item.price * item.quantity, 0) *
          100,
      ) / 100,
    [cart],
  );

  const amountPaid = paid.trim() === "" ? total : Number(paid);
  const balance = Math.round((total - amountPaid) * 100) / 100;

  function stockFor(product: SalesProduct) {
    return Number(product.stock_quantity ?? 0);
  }

  function unitsFor(product: SalesProduct): Unit[] {
    return Array.isArray(product.units) ? product.units : [];
  }

  function isServiceProduct(product: SalesProduct) {
    return product.product_type.toLowerCase() === "service";
  }

  function addProduct(product: SalesProduct) {
    const unit = unitsFor(product)[0];
    if (!unit) {
      setError(`No selling unit is configured for ${product.name}. Configure a unit before selling this product.`);
      return;
    }

    const isService = isServiceProduct(product);
    const stock = stockFor(product);
    setError("");

    setCart((items) => {
      const index = items.findIndex(
        (item) => item.product.id === product.id && item.unitId === unit.id,
      );
      const nextQuantity = (index >= 0 ? items[index].quantity : 0) + 1;
      const reservedBaseQuantity = items
        .filter((item) => item.product.id === product.id)
        .reduce((sum, item) => {
          const selected = unitsFor(item.product).find((candidate) => candidate.id === item.unitId);
          return sum + item.quantity * Number(selected?.base_quantity ?? 0);
        }, 0);

      if (!isService && reservedBaseQuantity + Number(unit.base_quantity) > stock) {
        setError(`Insufficient stock for ${product.name}.`);
        return items;
      }

      if (index < 0) {
        return [...items, { product, unitId: unit.id, quantity: 1, price: Number(unit.price) }];
      }
      return items.map((item, i) =>
        i === index ? { ...item, quantity: nextQuantity } : item,
      );
    });
  }

  function updateCartItem(index: number, patch: Partial<CartItem>) {
    setCart((items) => {
      const current = items[index];
      if (!current) return items;

      const updated = { ...current, ...patch };
      if (!Number.isInteger(updated.quantity) || updated.quantity < 1) return items;
      if (!Number.isFinite(updated.price) || updated.price < 0) return items;

      const selectedUnit = unitsFor(updated.product).find((unit) => unit.id === updated.unitId);
      if (!selectedUnit) {
        setError(`The selected selling unit is no longer available for ${updated.product.name}.`);
        return items;
      }

      if (!isServiceProduct(updated.product)) {
        const reservedBaseQuantity = items.reduce((sum, item, itemIndex) => {
          if (item.product.id !== updated.product.id) return sum;
          const line = itemIndex === index ? updated : item;
          const unit = unitsFor(line.product).find((candidate) => candidate.id === line.unitId);
          return sum + line.quantity * Number(unit?.base_quantity ?? 0);
        }, 0);

        if (reservedBaseQuantity > stockFor(updated.product)) {
          setError(`Insufficient stock for ${updated.product.name}.`);
          return items;
        }
      }

      setError("");
      return items.map((item, itemIndex) => itemIndex === index ? updated : item);
    });
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeId || creatingCustomer) return;
    if (duplicateContactCustomers.length > 0 && !allowDuplicateContact) {
      setError("This phone number already belongs to a customer. Select the matching customer or confirm that this is a separate person.");
      return;
    }
    setCreatingCustomer(true);
    setError("");
    try {
      const data = await api<{ customer: Customer }>("/customers", { method: "POST", json: { store_id: storeId, name: newCustomerName.trim(), contact: newCustomerContact.trim() || null } });
      setCustomers((current) => [...current, data.customer].sort((a, b) => a.name.localeCompare(b.name)));
      setCustomerId(String(data.customer.id));
      setCustomerQuery(data.customer.name);
      setCustomerModalOpen(false);
      setNewCustomerName("");
      setNewCustomerContact("");
      setAllowDuplicateContact(false);
      setMessage(`Customer ${data.customer.name} created and selected for this sale.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create customer.");
    } finally { setCreatingCustomer(false); }
  }

  async function createSale() {
    if (checkoutLock.current || submitting) return;

    if (!storeId || cart.length === 0) {
      setError("Add at least one item before completing the sale.");
      return;
    }

    if (
      !Number.isFinite(amountPaid) ||
      amountPaid < 0 ||
      amountPaid > total
    ) {
      setError("Enter a valid payment amount between zero and the total.");
      return;
    }

    if (balance > 0 && !customerId) {
      setError("Select a customer before recording an unpaid balance.");
      return;
    }

    if (!accountReady) {
      setError("Checkout data is still being restored. Wait a moment before completing a sale.");
      return;
    }

    checkoutLock.current = true;
    setSubmitting(true);
    setError("");
    setMessage("");

    if (!navigator.onLine) {
      const offlineId = transactionId || crypto.randomUUID();
      const payload = buildSalePayload(offlineId, true);
      savePendingSale(payload, total, customerId
        ? customers.find((customer) => String(customer.id) === customerId)?.name ?? `Customer #${customerId}`
        : "Walk-in");
      checkoutLock.current = false;
      setSubmitting(false);
      return;
    }

    // Re-read authoritative product data immediately before checkout because an open cart may contain stale prices.
    try {
      const latest = await api<{ products: SalesProduct[] }>(
        `/product/list?store_id=${encodeURIComponent(String(storeId))}`,
        { refresh: true },
      );
      const latestById = new Map((latest.products ?? []).map((product) => [product.id, product]));
      let priceChanged = false;
      const refreshedCart = cart.map((item) => {
        const currentProduct = latestById.get(item.product.id);
        const currentUnit = currentProduct?.units?.find((unit) => unit.id === item.unitId);
        if (!currentProduct || !currentUnit) { priceChanged = true; return item; }
        const currentPrice = Number(currentUnit.price);
        // Service prices may be intentionally overridden for an individual sale.
        const nextPrice = isServiceProduct(currentProduct) ? item.price : currentPrice;
        if (!isServiceProduct(currentProduct) && currentPrice !== item.price) priceChanged = true;
        return { ...item, product: currentProduct, price: nextPrice };
      });
      setProducts(latest.products ?? []);
      if (priceChanged) {
        setCart(refreshedCart);
        setMessage("Product prices or selling units changed while this cart was open. The cart has been refreshed and the total recalculated. Review the updated total before completing the sale.");
        checkoutLock.current = false;
        setSubmitting(false);
        return;
      }
      setCart(refreshedCart);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status >= 500 || !navigator.onLine) {
        const offlineId = transactionId || crypto.randomUUID();
        const payload = buildSalePayload(offlineId, true);
        savePendingSale(payload, total, customerId
          ? customers.find((customer) => String(customer.id) === customerId)?.name ?? `Customer #${customerId}`
          : "Walk-in");
      } else {
        setError(`Could not verify current prices and stock. ${checkoutFailureMessage(e)}`);
      }
      checkoutLock.current = false;
      setSubmitting(false);
      return;
    }

    const saleTransactionId = transactionId || crypto.randomUUID();
    setTransactionId(saleTransactionId);
    const salePayload = buildSalePayload(saleTransactionId);

    try {
      const data = await api<{ receipt: Receipt }>("/sales", {
        method: "POST",
        json: salePayload,
      });

      setReceipt(data.receipt);
      setMessage(`Sale #${data.receipt.sale_id} completed.`);
      setCart([]);
      setPaid("");
      setCustomerId("");
      setCustomerQuery("");
      setTransactionId("");

      setPendingSales((current) => current.filter((sale) => sale.id !== saleTransactionId));
      await load();
    } catch (e) {
      // A lost response is ambiguous. Keep the exact identifier and payload so
      // the idempotent sync endpoint can safely determine whether it was accepted.
      if (!(e instanceof ApiError) || e.status >= 500 || !navigator.onLine) {
        savePendingSale(salePayload, total, customerId
          ? customers.find((customer) => String(customer.id) === customerId)?.name ?? `Customer #${customerId}`
          : "Walk-in", checkoutFailureMessage(e));
      } else {
        // A definite rejection means this identifier can no longer be reused
        // for a corrected payload. Keep the cart and entered fields intact.
        setTransactionId("");
        setReceipt(null);
        setError(checkoutFailureMessage(e));
      }
    } finally {
      checkoutLock.current = false;
      setSubmitting(false);
    }
  }

  async function showSaleDetails(id: number) {
    if (!storeId) return;

    try {
      setError("");

      const data = await api<{ receipt: Receipt }>(
        `/sales/get?id=${encodeURIComponent(String(id))}&store_id=${encodeURIComponent(String(storeId))}`,
      );

      setReceipt(data.receipt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load sale details.");
    }
  }

  async function generateReceipt(id: number) {
    if (!storeId) return;

    try {
      setError("");

      const data = await api<{ receipt: Receipt }>("/sales/receipt", {
        method: "POST",
        json: { id, store_id: storeId },
      });

      setReceipt(data.receipt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to generate receipt.");
    }
  }

  return (
    <DashboardShell title="Sales">
      <style jsx global>{`@media print { body * { visibility: hidden !important; } .sale-receipt-print, .sale-receipt-print * { visibility: visible !important; } .sale-receipt-print { position: absolute; inset: 0; width: 100%; color: #111 !important; background: #fff !important; border: 0 !important; } .sale-receipt-print pre { color: #111 !important; background: #fff !important; } }`}</style>
      {message && (
        <p role="status" className="mb-4 rounded-xl bg-green-500/10 p-3 text-sm text-green-300">
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <section aria-live="polite" className="mb-5 rounded-xl border border-white/10 bg-[#151515] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Connection and offline checkout</h2>
            <p className={`mt-1 text-sm ${isOnline ? "text-green-300" : "text-amber-300"}`}>
              {isOnline ? "Online · pending sales can synchronize" : "Offline · new sales will be saved locally, not confirmed"}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isOnline ? "bg-green-500/10 text-green-300" : "bg-amber-500/10 text-amber-300"}`}>
            {isOnline ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
        <p className="mt-3 text-xs text-white/50">Checkout data is saved in this browser for this signed-in account and store. Clearing browser data, using private browsing, or losing access to this device can destroy unsynchronized sales. Keep this device&apos;s browser storage intact until every sale is confirmed.</p>
        {storageWarning && <p role="alert" className="mt-3 text-sm text-amber-200">{storageWarning}</p>}
      </section>

      {accountReady && pendingSales.length > 0 && (
        <section className="mb-6 rounded-2xl border border-amber-500/30 bg-[#151515] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Pending sales ({pendingSales.length})</h2>
              <p className="mt-1 text-sm text-white/55">These sales are separate from confirmed server sales. A local save is never a receipt or proof of payment.</p>
            </div>
            <button type="button" disabled={!isOnline} onClick={() => pendingSales.filter((sale) => sale.status === "failed" && sale.retryable).forEach((sale) => void syncPendingSale(sale))} className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-black disabled:opacity-40">Retry failed syncs</button>
          </div>
          <div className="mt-4 space-y-3">
            {pendingSales.map((sale) => (
              <article key={sale.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{sale.customerLabel} · {money(sale.total)}</p>
                    <p className="mt-1 break-all text-xs text-white/45">Reference: {sale.id}</p>
                    <p className="mt-1 text-xs text-white/45">Saved {new Date(sale.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs ${sale.status === "conflict" ? "bg-red-500/10 text-red-300" : sale.status === "failed" ? "bg-amber-500/10 text-amber-200" : sale.status === "syncing" ? "bg-blue-500/10 text-blue-200" : "bg-white/10 text-white/70"}`}>
                    {sale.status === "conflict" ? "Needs review" : sale.status === "failed" ? "Sync failed" : sale.status === "syncing" ? "Synchronizing" : "Pending"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/70">{sale.message ?? "Waiting to synchronize."}</p>
                {sale.code && <p className="mt-1 text-xs text-red-200">Server error: {sale.code}</p>}
                <div className="mt-3 space-y-2">
                  {sale.payload.items.map((item) => {
                    const product = sale.catalog?.find((entry) => entry.id === item.product_id);
                    const unit = product?.units?.find((entry) => entry.id === item.unit_id);
                    return (
                      <div key={`${item.product_id}-${item.unit_id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/5 p-3 text-sm">
                        <div>
                          <p>{product?.name ?? `Product #${item.product_id}`} · {unit?.name ?? `Unit #${item.unit_id}`}</p>
                          {sale.catalog && product && unit && (
                            <p className="mt-1 text-xs text-white/50">Current price: {money(Number(unit.price))} · Available stock: {product.product_type.toLowerCase() === "service" ? "Not tracked" : `${product.stock_quantity} ${product.base_unit}`}</p>
                          )}
                        </div>
                        {sale.status === "conflict" && sale.catalog && (
                          <label className="text-xs text-white/60">Quantity
                            <input type="number" inputMode="numeric" min="1" step="1" value={item.quantity} onChange={(event) => updatePendingQuantity(sale.id, item.product_id, item.unit_id, Number(event.target.value))} className="field ml-2 w-20" />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
                {sale.status === "conflict" && sale.catalog && (
                  <p className="mt-3 rounded-lg bg-orange-500/10 p-3 text-sm text-orange-100">
                    Revised total at current prices: <strong>{money(pendingReviewTotal(sale) ?? sale.total)}</strong>
                    {" · "}Amount paid: {money(sale.payload.amount_paid)}
                    {" · "}Remaining: {money(Math.max(0, (pendingReviewTotal(sale) ?? sale.total) - sale.payload.amount_paid))}
                  </p>
                )}
                {sale.status === "conflict" && sale.catalog && (
                  <label className="mt-3 block max-w-xs text-xs text-white/60">
                    Amount paid
                    <input type="number" inputMode="decimal" min="0" step="0.01" value={sale.payload.amount_paid} onChange={(event) => updatePendingAmountPaid(sale.id, Number(event.target.value))} className="field mt-1 w-full" />
                  </label>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(sale.status === "pending" || (sale.status === "failed" && sale.retryable)) && (
                    <button type="button" disabled={!isOnline} onClick={() => void syncPendingSale(sale)} className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-black disabled:opacity-40">Retry with same reference</button>
                  )}
                  {sale.status === "conflict" && sale.code !== "IDEMPOTENCY_KEY_REUSED" && (
                    <>
                      <button type="button" disabled={!isOnline} onClick={() => void refreshPendingCatalog(sale.id)} className="rounded-lg bg-white/10 px-3 py-2 text-sm disabled:opacity-40">Refresh prices and stock</button>
                      {sale.catalog && <button type="button" onClick={() => confirmRevisedPendingSale(sale)} className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-black">Confirm revised sale and retry</button>}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!accountReady && <p role={storageReadFailed ? "alert" : "status"} className="mb-5 text-sm text-white/50">{storageReadFailed ? "Checkout is disabled because saved browser data could not be read. Do not clear browser storage; recover the saved data before continuing." : "Restoring checkout data for the signed-in account…"}</p>}

      {accountReady && <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <section className="rounded-2xl border border-white/10 bg-[#151515] p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold">Products and services</h2>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="field max-w-sm"
              aria-label="Search products or services"
              data-tour="sales-search"
              placeholder="Search products or services..."
            />
          </div>

          {loading ? (
            <p role="status" className="py-12 text-center text-white/70">Loading products…</p>
          ) : filteredProducts.length === 0 ? (
            <p className="py-12 text-center text-white/70">
              {query ? (
                "No matching products or services."
              ) : (
                <>
                  Nothing to sell yet. <Link href="/inventory" className="text-orange-300 underline underline-offset-4">Add a product or service</Link> first.
                </>
              )}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product, productIndex) => {
                const isService = isServiceProduct(product);
                const stock = stockFor(product);
                const firstUnit = unitsFor(product)[0];

                return (
                  <article
                    key={product.id}
                    className="rounded-xl border border-white/10 bg-[#101010] p-4"
                  >
                    <p className="text-xs text-white/35">#{product.id}</p>
                    <h3 className="mt-1 font-medium">{product.name}</h3>

                    <p className="mt-2 text-xs text-white/50">
                      {isService ? "Service" : `${stock} ${product.base_unit} in stock`}
                    </p>

                    <p className="mt-2 text-orange-400">
                      {money(Number(firstUnit?.price ?? product.price))}
                    </p>

                    <button
                      disabled={!isService && stock <= 0}
                      data-tour={productIndex === 0 ? "sales-add" : undefined}
                      onClick={() => addProduct(product)}
                      className="mt-4 w-full rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-black disabled:bg-white/10 disabled:text-white/30"
                    >
                      {isService
                        ? "Add service"
                        : stock > 0
                          ? "Add to cart"
                          : "Out of stock"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside data-tour="sales-cart" className="min-w-0 h-fit rounded-2xl border border-white/10 bg-[#151515] p-5 lg:sticky lg:top-20">
          <h2 className="text-lg font-semibold">Checkout</h2>

          <div className="mt-5 space-y-3">
            {cart.map((item, index) => {
              const units = unitsFor(item.product);
              const selectedUnit = units.find((unit) => unit.id === item.unitId);
              const baseQuantity =
                Number(selectedUnit?.base_quantity ?? 1) * item.quantity;

              return (
                <div
                  key={`${item.product.id}-${item.unitId}`}
                  className="rounded-lg bg-white/5 p-3 text-sm"
                >
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{item.product.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setCart((items) =>
                          items.filter((_, i) => i !== index),
                        )
                      }
                      className="text-red-300"
                    >
                      Remove
                    </button>
                  </div>

                  <label className="mt-3 block text-xs text-white/50">
                    Selling unit
                    <select
                      value={String(item.unitId)}
                      onChange={(event) => {
                        const unit = units.find(
                          (candidate) => candidate.id === Number(event.target.value),
                        );
                        if (unit) {
                          updateCartItem(index, { unitId: unit.id, price: Number(unit.price) });
                        }
                      }}
                      className="field mt-1 w-full"
                    >
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name} · {unit.base_quantity} {item.product.base_unit} · ₦{Number(unit.price).toLocaleString("en-NG")}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateCartItem(index, {
                          quantity: Math.max(1, item.quantity - 1),
                        })
                      }
                      className="rounded bg-white/10 px-3 py-1"
                      aria-label={`Decrease ${item.product.name} quantity`}
                    >
                      −
                    </button>

                    <input
                      aria-label={`Quantity of ${item.product.name}`}
                      className="field w-20"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(event) =>
                        updateCartItem(index, {
                          quantity: Number(event.target.value),
                        })
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        updateCartItem(index, {
                          quantity: item.quantity + 1,
                        })
                      }
                      className="rounded bg-white/10 px-3 py-1"
                      aria-label={`Increase ${item.product.name} quantity`}
                    >
                      +
                    </button>
                  </div>

                  <label className="mt-3 block text-xs text-white/50">
                    Unit price
                    <input
                      aria-label={`Unit price for ${item.product.name}`}
                      className="field mt-1 w-full"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={item.price}
                      disabled={!isServiceProduct(item.product)}
                      onChange={(event) =>
                        updateCartItem(index, {
                          price: Number(event.target.value),
                        })
                      }
                    />
                  </label>

                  <p className="mt-2 text-xs text-white/50">
                    Conversion: {item.quantity} {selectedUnit?.name ?? "unit"} = {baseQuantity} {item.product.base_unit}
                  </p>

                  <p className="mt-1">
                    Line total: {money(item.price * item.quantity)}
                  </p>
                </div>
              );
            })}

            {cart.length === 0 && (
              <p className="py-8 text-center text-sm text-white/70">
                Cart is empty. Press “Add to cart” on a product to start a sale.
              </p>
            )}
          </div>

          <div className="my-5 flex justify-between border-t border-white/10 pt-4">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>

          <div data-tour="sales-payment">
          <label className="block text-sm">
            Amount paid
            <input
              className="field mt-2 w-full"
              type="number"
              inputMode="decimal"
              min="0"
              max={total}
              step="0.01"
              value={paid}
              placeholder={String(total)}
              onChange={(event) => setPaid(event.target.value)}
            />
          </label>

          <p className="my-3 text-sm">
            Outstanding balance:{" "}
            <strong className={balance > 0 ? "text-orange-300" : ""}>
              {money(balance)}
            </strong>
          </p>

          <div className="my-4">
            <p className="mb-1 text-xs text-white/50">Payment method</p>
            <p className="mb-2 text-xs text-white/35">Record how the customer paid. No payment gateway is required; Cash is selected by default.</p>

            <div className="flex flex-wrap gap-2">
              {["CASH", "TRANSFER", "POS"].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(method);
                  }}
                  className={`rounded px-3 py-2 text-sm ${
                    paymentMethod === method
                      ? "bg-orange-500 text-black"
                      : "bg-white/10"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          </div>

          <label className="block text-sm">
            Search customers {balance > 0 ? "(required for credit)" : "(optional)"}
            <input className="field mt-2 w-full" placeholder="Search by name or phone..." value={customerQuery}
              aria-label="Search customers by name or phone"
              onChange={(event) => { setCustomerQuery(event.target.value); setCustomerId(""); }} />
          </label>
          <div className="mt-2 space-y-2" aria-label="Customer search results">
            <button type="button" onClick={() => { setCustomerId(""); setCustomerQuery(""); }}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${!customerId ? "border-orange-500/50 bg-orange-500/10" : "border-white/10 bg-white/5"}`}>Walk-in customer</button>
            {filteredCustomers.map((customer) => (
              <button type="button" key={customer.id} onClick={() => { setCustomerId(String(customer.id)); setCustomerQuery(customer.name); }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${customerId === String(customer.id) ? "border-orange-500/50 bg-orange-500/10" : "border-white/10 bg-white/5"}`}>
                <span className="block font-medium">{customer.name}</span><span className="block text-xs text-white/45">{customer.contact || "No phone number"}</span>
              </button>
            ))}
            {customerQuery.trim() && filteredCustomers.length === 0 && <p className="rounded-lg bg-white/5 p-3 text-sm text-white/60">No matching customer found.</p>}
            {customerQuery.trim() && filteredCustomers.length === 0 && (
              <button type="button" onClick={() => { setNewCustomerName(customerQuery.trim()); setNewCustomerContact(""); setAllowDuplicateContact(false); setError(""); setCustomerModalOpen(true); }}
                className="w-full rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-3 text-left text-sm text-orange-200">
                Create new customer: <strong>{customerQuery.trim()}</strong>
              </button>
            )}
            {customerId && <p className="text-xs text-green-300" role="status">Selected: {customers.find((customer) => String(customer.id) === customerId)?.name ?? "Customer"}</p>}
          </div>

          <button
            type="button"
            disabled={
              loading ||
              submitting ||
              cart.length === 0 ||
              !Number.isFinite(amountPaid) ||
              amountPaid < 0 ||
              amountPaid > total ||
              (balance > 0 && !customerId)
            }
            onClick={createSale}
            data-tour="sales-complete"
            className="mt-4 w-full rounded-xl bg-orange-500 py-3 font-semibold text-black disabled:bg-white/10 disabled:text-white/30"
          >
            {submitting ? "Processing checkout..." : "Complete sale"}
          </button>
        </aside>
      </div>}

      {accountReady && <section className="mt-6 rounded-2xl border border-white/10 bg-[#151515] p-5">
        <h2 className="font-semibold">Sales history</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-white/40">
              <tr>
                <th className="px-3 py-3">DATE</th>
                <th className="px-3 py-3">SALE</th>
                <th className="px-3 py-3">CUSTOMER</th>
                <th className="px-3 py-3">TOTAL</th>
                <th className="px-3 py-3">PAID</th>
                <th className="px-3 py-3">BALANCE</th>
                <th className="px-3 py-3">ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-t border-white/5">
                  <td className="px-3 py-3">
                    {new Date(sale.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">#{sale.id}</td>
                  <td className="px-3 py-3">
                    {sale.customer_id ? `#${sale.customer_id}` : "Walk-in"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {money(Number(sale.total_amount))}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{money(Number(sale.amount_paid))}</td>
                  <td className={`px-3 py-3 whitespace-nowrap ${Number(sale.balance) > 0 ? "text-orange-300" : "text-white/50"}`}>{money(Number(sale.balance))}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void showSaleDetails(sale.id)}
                        className="rounded bg-white/10 px-2 py-1 text-xs"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => void generateReceipt(sale.id)}
                        className="rounded bg-orange-500/10 px-2 py-1 text-xs text-orange-300"
                      >
                        Receipt
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && sales.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-10 text-center text-white/30"
                  >
                    No sales yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>}

      {accountReady && customerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !creatingCustomer) setCustomerModalOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="create-customer-title" className="w-full max-w-md rounded-2xl border border-white/10 bg-[#151515] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 id="create-customer-title" className="text-lg font-semibold">Create customer</h2><p className="mt-1 text-sm text-white/55">The current sale will stay as it is.</p></div>
              <button type="button" disabled={creatingCustomer} onClick={() => setCustomerModalOpen(false)} className="text-sm text-white/50 disabled:opacity-40">Close</button></div>
            <form onSubmit={createCustomer} className="mt-5 space-y-4">
              <label className="block text-sm">Customer name<input required minLength={2} autoFocus className="field mt-2 w-full" value={newCustomerName} onChange={(event) => setNewCustomerName(event.target.value)} placeholder="e.g. Mrs Adeyemi" /></label>
              <label className="block text-sm">Phone number <span className="text-white/40">(optional)</span><input type="tel" className="field mt-2 w-full" value={newCustomerContact} onChange={(event) => { setNewCustomerContact(event.target.value); setAllowDuplicateContact(false); }} placeholder="e.g. 0803 000 0000" /></label>
              {duplicateContactCustomers.length > 0 && <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
                <p className="text-sm font-medium text-amber-200">This phone number is already in use.</p><p className="mt-1 text-xs text-white/60">Check whether this is the same customer before creating another record.</p>
                <div className="mt-3 space-y-2">{duplicateContactCustomers.map((customer) => <button type="button" key={customer.id} onClick={() => { setCustomerId(String(customer.id)); setCustomerQuery(customer.name); setCustomerModalOpen(false); setNewCustomerName(""); setNewCustomerContact(""); setAllowDuplicateContact(false); }} className="w-full rounded-lg bg-white/10 px-3 py-2 text-left text-sm">Use existing customer: <strong>{customer.name}</strong><span className="block text-xs text-white/50">{customer.contact}</span></button>)}</div>
                <label className="mt-3 flex items-start gap-2 text-xs text-white/75"><input type="checkbox" checked={allowDuplicateContact} onChange={(event) => setAllowDuplicateContact(event.target.checked)} className="mt-0.5" />I verified this is a different person. Create a separate customer record.</label>
              </div>}
              <div className="flex gap-3 pt-1"><button type="button" disabled={creatingCustomer} onClick={() => setCustomerModalOpen(false)} className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm">Cancel</button>
                <button type="submit" disabled={creatingCustomer || (duplicateContactCustomers.length > 0 && !allowDuplicateContact)} className="flex-1 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-40">{creatingCustomer ? "Creating..." : "Create and select"}</button></div>
            </form>
          </section>
        </div>
      )}

      {accountReady && receipt && (
        <section className="sale-receipt-print mt-6 rounded-2xl border border-orange-500/20 bg-[#151515] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              Receipt #{receipt.sale_id}
            </h2>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => window.print()} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5">Print receipt</button>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="text-sm text-white/40"
              >
                Close
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat
              label="Total"
              value={money(Number(receipt.total_amount))}
            />
            <Stat
              label="Customer"
              value={receipt.customer_id ? (customers.find((customer) => customer.id === receipt.customer_id)?.name ?? `#${receipt.customer_id}`) : "Walk-in"}
            />
            <Stat label="Amount paid" value={money(Number(receipt.amount_paid))} />
            <Stat label="Outstanding balance" value={money(Number(receipt.balance))} />
            <Stat label="Payment status" value={Number(receipt.balance) <= 0 ? "Paid" : Number(receipt.amount_paid) <= 0 ? "Unpaid" : "Partially paid"} />
            <Stat
              label="Date"
              value={new Date(receipt.created_at).toLocaleString()}
            />
          </div>

          <div className="receipt-document mt-4 rounded-xl bg-black/40 p-5 text-sm">
            <header className="receipt-header border-b border-white/15 pb-4 text-center">
              <p className="text-lg font-bold tracking-wide">{user?.store_name || "RetailOS"}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/60">Sales receipt</p>
              <p className="mt-2 font-semibold">Receipt #{receipt.sale_id}</p>
            </header>

            <dl className="receipt-meta grid grid-cols-1 gap-x-6 gap-y-2 border-b border-white/15 py-4 sm:grid-cols-2">
              <div className="flex justify-between gap-3"><dt className="text-white/50">Date</dt><dd className="text-right">{new Date(receipt.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-white/50">Customer</dt><dd className="text-right">{receipt.customer_id ? (customers.find((customer) => customer.id === receipt.customer_id)?.name ?? `Customer #${receipt.customer_id}`) : "Walk-in customer"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-white/50">Payment method</dt><dd className="text-right">{sales.find((sale) => sale.id === receipt.sale_id)?.payment_method ?? "See payment record"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-white/50">Status</dt><dd className="text-right font-medium">{Number(receipt.balance) <= 0 ? "Paid" : Number(receipt.amount_paid) <= 0 ? "Unpaid" : "Partially paid"}</dd></div>
            </dl>

            <div className="receipt-items py-4">
              <h3 className="mb-3 font-semibold">Items purchased</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left">
                  <thead className="border-b border-white/15 text-xs text-white/50">
                    <tr><th className="pb-2 pr-3 font-medium">Item</th><th className="pb-2 px-2 text-right font-medium">Qty</th><th className="pb-2 px-2 text-right font-medium">Unit price</th><th className="pb-2 pl-2 text-right font-medium">Subtotal</th></tr>
                  </thead>
                  <tbody>
                    {receipt.items.map((item, index) => {
                      const productName = products.find((product) => product.id === item.product_id)?.name ?? `Product #${item.product_id}`;
                      const quantityLabel = `${item.quantity}${item.unit_name ? ` ${item.unit_name}` : ""}`;
                      const unitPrice = item.price_at_sale != null ? Number(item.price_at_sale) : Number(item.total) / Math.max(Number(item.quantity), 1);
                      return <tr key={`${item.product_id}-${index}`} className="border-b border-white/5">
                        <td className="py-3 pr-3"><span className="font-medium">{productName}</span>{item.base_quantity_deducted != null && item.base_unit ? <span className="mt-1 block text-xs text-white/45">Stock deducted: {item.base_quantity_deducted} {item.base_unit}</span> : null}</td>
                        <td className="px-2 py-3 text-right whitespace-nowrap">{quantityLabel}</td>
                        <td className="px-2 py-3 text-right whitespace-nowrap">{money(unitPrice)}</td>
                        <td className="py-3 pl-2 text-right whitespace-nowrap">{money(Number(item.total))}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="receipt-totals ml-auto max-w-sm space-y-2 border-t border-white/15 pt-4">
              <div className="flex justify-between gap-4"><span className="text-white/60">Total</span><strong>{money(Number(receipt.total_amount))}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-white/60">Amount paid</span><span>{money(Number(receipt.amount_paid))}</span></div>
              <div className="flex justify-between gap-4"><span className="text-white/60">Outstanding balance</span><strong className={Number(receipt.balance) > 0 ? "text-orange-300" : ""}>{money(Number(receipt.balance))}</strong></div>
            </div>

            <footer className="receipt-footer mt-5 border-t border-white/15 pt-4 text-center text-xs text-white/50">
              <p>Thank you for your purchase.</p>
              <p className="mt-1">Please keep this receipt for your records.</p>
            </footer>
          </div>
        </section>
      )}
    </DashboardShell>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-white/5 p-3">
      <p className="text-xs text-white/40">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
