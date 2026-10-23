"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { formatNigeriaDateTime } from "@/lib/nigeria-time";
import DashboardShell from "@/components/layout/DashboardShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import type { Category, InventoryMovement, Product, ProductType } from "@/lib/types";
import CsvImport from "@/components/inventory/CsvImport";

function displayUnit(unit: string): string {
  if (unit === "piece") return "Pieces";
  if (unit === "kg") return "kg";
  if (unit === "bag") return "Bags";
  return unit;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const storeId = user?.store_id ?? null;
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsLoadError, setProductsLoadError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryError, setCategoryError] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [movementProduct, setMovementProduct] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    price: "",
    stock: "0",
    threshold: "",
    productType: "Physical" as ProductType,
    baseUnit: "piece",
  });
  const [customUnit, setCustomUnit] = useState("");
  const isService = form.productType === "Service";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [receivingForm, setReceivingForm] = useState({ productId: "", quantity: "", unitCost: "", receivedAt: new Date().toISOString().slice(0, 10), source: "" });
  const receivingProduct = products.find((product) => String(product.id) === receivingForm.productId);
  const receivingTotal = Number(receivingForm.quantity) * Number(receivingForm.unitCost);
  const receivingMovements = movements.filter((movement) => (movement.reason ?? "").startsWith("Stock received"));
  const filteredProducts = selectedCategoryId === "all"
    ? products
    : products.filter((product) => String(product.category_id ?? "") === selectedCategoryId);
  const actionLock = useRef(false);
  const standardUnits = [{ value: "piece", label: "Pieces" }, { value: "kg", label: "kg" }, { value: "bag", label: "Bags" }];
  const usesCustomUnit = !standardUnits.some((unit) => unit.value === form.baseUnit);

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      setCategoriesLoading(true);
      setCategoryError("");
      try {
        if (!storeId) throw new Error("No store is associated with this account");
        const data = await api<{ categories: Category[] }>("/categories?store_id=" + storeId, { refresh: true });
        if (!active) return;
        setCategories(data.categories);
        const saved = window.sessionStorage.getItem("retailos:inventory:selected-category:" + storeId);
        setSelectedCategoryId(
          saved && (saved === "all" || data.categories.some((category) => String(category.id) === saved))
            ? saved
            : "all",
        );
      } catch (e) {
        if (!active) return;
        setCategories([]);
        setSelectedCategoryId("all");
        setCategoryError(e instanceof Error ? e.message : "Unable to load categories");
      } finally {
        if (active) setCategoriesLoading(false);
      }
    }

    void loadCategories();
    return () => {
      active = false;
    };
  }, [storeId]);

  useEffect(() => {
    async function load() {
      setProductsLoading(true);
      setProductsLoadError("");
      try {
        if (!storeId) throw new Error("No store is associated with this account");
        const data = await api<{ products: Product[] }>("/product/list?store_id=" + storeId);
        setProducts(data.products);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to load inventory";
        setProductsLoadError(message);
        setError(message);
      } finally {
        setProductsLoading(false);
      }
    }

    async function loadMovements() {
      try {
        if (!storeId) throw new Error("No store is associated with this account");
        const data = await api<{ movements: InventoryMovement[] }>("/product/movements?store_id=" + storeId);
        setMovements(data.movements);
        setMovementProduct(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load movements");
      }
    }

    void Promise.all([load(), loadMovements()]);
  }, [storeId]);

  async function loadMovements(productId?: number) {
    try {
      const id = storeId;
      if (!id) throw new Error("No store is associated with this account");
      let path = "/product/movements?store_id=" + id;
      if (productId) path += "&product_id=" + productId;
      const data = await api<{ movements: InventoryMovement[] }>(path);
      setMovements(data.movements);
      setMovementProduct(productId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load movements");
    }
  }

  function reset() {
    setEditing(null);
    setForm({
      name: "",
      price: "",
      stock: "0",
      threshold: "",
      productType: "Physical",
      baseUnit: "piece",
    });
    setCustomUnit("");
  }

  function changeProductType(productType: ProductType) {
    setForm((current) => ({
      ...current,
      productType,
      ...(productType === "Service"
        ? { stock: "0", threshold: "", baseUnit: "piece" }
        : current.productType === "Service"
          ? { stock: "0", threshold: "", baseUnit: "piece" }
          : {}),
    }));
    setError("");
  }

  function beginEdit(product: Product) {
    setEditing(product.id);
    setForm({
      name: product.name,
      price: String(product.price),
      stock: String(product.stock_quantity),
      threshold: product.low_stock_threshold == null ? "" : String(product.low_stock_threshold),
      productType: product.product_type,
      baseUnit: standardUnits.some((unit) => unit.value === product.base_unit) ? product.base_unit : "other",
    });
    setCustomUnit(standardUnits.some((unit) => unit.value === product.base_unit) ? "" : product.base_unit);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionLock.current) return;
    actionLock.current = true;
    setPendingAction("save");
    setError("");
    setMessage("");
    try {
      const id = storeId;
      if (!id) throw new Error("No store is associated with this account");
      if (!isService && usesCustomUnit && !customUnit.trim()) {
        throw new Error("Enter a custom unit name before saving.");
      }
      const commonPayload = {
        store_id: id,
        name: form.name.trim(),
        price: Number(form.price),
        product_type: form.productType,
        // The current create API expects a base_unit; services use a neutral fallback.
        base_unit: isService ? "piece" : (usesCustomUnit ? customUnit.trim() : form.baseUnit.trim()),
      };
      if (editing) {
        await api("/product/update", {
          method: "PATCH",
          json: {
            ...commonPayload,
            id: editing,
            ...(isService ? {} : {
              stock_quantity: Number(form.stock),
              low_stock_threshold: form.threshold === "" ? null : Number(form.threshold),
            }),
          },
        });
        setMessage(isService ? "Service updated." : "Product updated.");
      } else {
        await api("/product/create", {
          method: "POST",
          json: {
            ...commonPayload,
            ...(isService ? {} : {
              opening_stock: Number(form.stock),
              low_stock_threshold: form.threshold === "" ? null : Number(form.threshold),
            }),
          },
        });
        setMessage(isService ? "Service created." : "Product created.");
      }
      reset();
      await loadProducts();
    } catch (e) {
      setMessage("");
      setError(e instanceof Error ? e.message : "Unable to save product");
    } finally {
      actionLock.current = false;
      setPendingAction(null);
    }
  }

  async function loadProducts() {
    setProductsLoading(true);
    setProductsLoadError("");
    try {
      const id = storeId;
      if (!id) throw new Error("No store is associated with this account");
      const data = await api<{ products: Product[] }>("/product/list?store_id=" + id, { refresh: true });
      setProducts(data.products);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to load inventory";
      setProductsLoadError(message);
      setError(message);
    } finally {
      setProductsLoading(false);
    }
  }

  function selectCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
    if (storeId) {
      window.sessionStorage.setItem("retailos:inventory:selected-category:" + storeId, categoryId);
    }
  }

  async function receiveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionLock.current) return;
    const product = receivingProduct;
    const quantity = Number(receivingForm.quantity);
    const unitCost = Number(receivingForm.unitCost);
    if (!product || product.product_type !== "Physical") { setError("Choose a physical product before recording received stock."); return; }
    if (!Number.isSafeInteger(quantity) || quantity <= 0) { setError("Quantity must be a whole number greater than zero."); return; }
    if (!Number.isFinite(unitCost) || unitCost < 0 || receivingForm.unitCost.trim() === "" || Math.abs(unitCost * 100 - Math.round(unitCost * 100)) > 1e-7) {
      setError("Enter a valid unit cost of zero or more, with no more than two decimal places."); return;
    }
    if (!receivingForm.receivedAt) { setError("Choose the date the stock was received."); return; }
    if (!Number.isFinite(receivingTotal) || receivingTotal > Number.MAX_SAFE_INTEGER) { setError("The receiving total is outside the supported amount range."); return; }
    actionLock.current = true;
    setPendingAction("receive");
    setError("");
    setMessage("");
    try {
      const id = storeId;
      if (!id) throw new Error("No store is associated with this account");
      const source = receivingForm.source.trim();
      const reason = [
        "Stock received",
        `Unit cost: ₦${unitCost.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per ${displayUnit(product.base_unit)}`,
        `Unit: ${displayUnit(product.base_unit)}`,
        `Total receiving cost: ₦${receivingTotal.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Received on: ${receivingForm.receivedAt}`,
        source ? `Supplier/source: ${source}` : "",
      ].filter(Boolean).join(" | ");
      await api("/product/adjust", { method: "POST", json: { store_id: id, id: product.id, quantity_change: quantity, reason } });
      setReceivingForm({ productId: "", quantity: "", unitCost: "", receivedAt: new Date().toISOString().slice(0, 10), source: "" });
      setMessage(`Received ${quantity} ${displayUnit(product.base_unit)} of ${product.name}. Total receiving cost: ₦${receivingTotal.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
      await Promise.all([loadProducts(), loadMovements()]);
    } catch (e) {
      setMessage("");
      setError(e instanceof Error ? e.message : "Unable to record stock receiving");
    } finally { actionLock.current = false; setPendingAction(null); }
  }

  async function adjust(product: Product, change: number) {
    if (actionLock.current) return;
    actionLock.current = true;
    setPendingAction("adjust-" + product.id);
    setError("");
    setMessage("");
    try {
      const id = storeId;
      if (!id) throw new Error("No store is associated with this account");
      await api("/product/adjust", { method: "POST", json: { store_id: id, id: product.id, quantity_change: change, reason: "Manual stock adjustment" } });
      setMessage("Stock adjusted for " + product.name + ".");
      await loadProducts();
    } catch (e) {
      setMessage("");
      setError(e instanceof Error ? e.message : "Unable to adjust stock");
    } finally {
      actionLock.current = false;
      setPendingAction(null);
    }
  }

  async function remove(productId: number) {
    if (actionLock.current || !confirm("Delete this product?")) return;
    actionLock.current = true;
    setPendingAction("delete-" + productId);
    setError("");
    setMessage("");
    try {
      const id = storeId;
      if (!id) throw new Error("No store is associated with this account");
      await api("/product/delete", { method: "DELETE", json: { store_id: id, id: productId } });
      setMessage("Product deleted.");
      await loadProducts();
    } catch (e) {
      setMessage("");
      setError(e instanceof Error ? e.message : "Unable to delete product");
    } finally {
      actionLock.current = false;
      setPendingAction(null);
    }
  }

  return (
    <DashboardShell title="Inventory">
      {message && <p role="status" className="mb-4 rounded-xl bg-green-500/10 p-3 text-sm text-green-300">{message}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <form onSubmit={save} data-tour="inventory-form" aria-label={editing ? (isService ? "Edit service" : "Edit product") : (isService ? "Add a service" : "Add a product")} className="grid gap-3 rounded-2xl border border-white/10 bg-[#151515] p-5 md:grid-cols-4">
        <label className="block text-xs text-white/75">Item type<select value={form.productType} onChange={(e) => changeProductType(e.target.value as ProductType)} className="field mt-1 text-sm">
          <option value="Physical">Product</option>
          <option value="Service">Service</option>
        </select></label>
        <label className="block text-xs text-white/75">{isService ? "Service name" : "Product name"}<input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field mt-1 text-sm" placeholder={isService ? "e.g. Delivery service" : "e.g. Rice 50kg"} /></label>
        <label className="block text-xs text-white/75">Price (₦)<input required min="0" step="0.01" type="number" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="field mt-1 text-sm" placeholder="0.00" /></label>
        {!isService && <>
          <label className="block text-xs text-white/75">{editing ? "Stock quantity" : "Opening stock"}<input required min="0" type="number" inputMode="numeric" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="field mt-1 text-sm" placeholder="0" /></label>
          <label className="block text-xs text-white/75">Base unit<select required value={usesCustomUnit ? "other" : form.baseUnit} onChange={(e) => {
            const value = e.target.value;
            if (value === "other") {
              setForm((current) => ({ ...current, baseUnit: "other" }));
              setCustomUnit(usesCustomUnit ? customUnit : "");
            } else {
              setForm((current) => ({ ...current, baseUnit: value }));
              setCustomUnit("");
            }
          }} className="field mt-1 text-sm">
            {standardUnits.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
            <option value="other">Other</option>
          </select></label>
          {usesCustomUnit && <label className="block text-xs text-white/75">Custom unit<input required minLength={1} maxLength={20} value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} className="field mt-1 text-sm" placeholder="Enter unit name" /></label>}
          <label className="block text-xs text-white/75">Low-stock threshold (optional)<input min="0" type="number" inputMode="numeric" step="1" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} className="field mt-1 text-sm" placeholder="Alert me at or below…" /></label>
        </>}
        <div className="flex gap-2 md:col-span-4">
          <button disabled={pendingAction !== null} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">{pendingAction === "save" ? "Saving..." : editing ? "Save changes" : isService ? "Add service" : "Add product"}</button>
          {editing && <button type="button" disabled={pendingAction !== null} onClick={reset} className="rounded-xl bg-white/10 px-4 py-3 text-sm disabled:opacity-50">Cancel</button>}
        </div>
      </form>
      <section data-tour="inventory-receiving" className="mt-6 rounded-2xl border border-white/10 bg-[#151515] p-5">
        <div className="mb-4"><h2 className="font-semibold">Receive stock</h2><p className="mt-1 text-xs text-white/45">Record incoming stock and its cost. Quantity is entered in the product&apos;s configured base unit.</p></div>
        <form onSubmit={receiveStock} aria-label="Receive stock form" className="grid gap-3 md:grid-cols-3">
          <label className="block text-xs text-white/75">Product<select required value={receivingForm.productId} onChange={(e) => setReceivingForm({ ...receivingForm, productId: e.target.value })} className="field mt-1 text-sm"><option value="">Choose a product</option>{products.filter((product) => product.product_type === "Physical").map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label className="block text-xs text-white/75">Quantity received<input required min="1" step="1" type="number" inputMode="numeric" value={receivingForm.quantity} onChange={(e) => setReceivingForm({ ...receivingForm, quantity: e.target.value })} className="field mt-1 text-sm" placeholder="e.g. 10" /></label>
          <label className="block text-xs text-white/75">Unit<input readOnly value={receivingProduct?.base_unit ?? ""} className="field mt-1 text-sm" placeholder="Select a product first" aria-label="Receiving unit (product base unit)" /></label>
          <label className="block text-xs text-white/75">Cost per unit (₦)<input required min="0" step="0.01" type="number" inputMode="decimal" value={receivingForm.unitCost} onChange={(e) => setReceivingForm({ ...receivingForm, unitCost: e.target.value })} className="field mt-1 text-sm" placeholder="e.g. 5000" /></label>
          <label className="block text-xs text-white/75">Receiving date<input required type="date" value={receivingForm.receivedAt} onChange={(e) => setReceivingForm({ ...receivingForm, receivedAt: e.target.value })} className="field mt-1 text-sm" /></label>
          <label className="block text-xs text-white/75">Supplier or source (optional)<input maxLength={120} value={receivingForm.source} onChange={(e) => setReceivingForm({ ...receivingForm, source: e.target.value })} className="field mt-1 text-sm" placeholder="e.g. Main distributor" /></label>
          <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-3 md:col-span-3"><p className="text-xs text-white/60">Total receiving cost</p><p className="mt-1 text-xl font-semibold text-orange-300">₦{Number.isFinite(receivingTotal) && receivingForm.quantity !== "" && receivingForm.unitCost !== "" ? receivingTotal.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</p><p className="mt-1 text-xs text-white/40">Quantity × cost per unit. This is separate from the product&apos;s selling price.</p></div>
          <div className="md:col-span-3"><button disabled={pendingAction !== null || !products.some((product) => product.product_type === "Physical")} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">{pendingAction === "receive" ? "Recording receipt..." : "Record stock received"}</button></div>
        </form>
      </section>
      <div data-tour="inventory-import"><CsvImport storeId={storeId} onImported={loadProducts} /></div>
      <section data-tour="inventory-table" className="mt-6 rounded-2xl border border-white/10 bg-[#151515] p-4 sm:p-5">
        <div className="mb-4">
          <div role="tablist" aria-label="Filter inventory by category" className="flex max-w-full gap-2 overflow-x-auto pb-2">
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategoryId === "all"}
              onClick={() => selectCategory("all")}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${selectedCategoryId === "all" ? "bg-orange-500 text-black" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
            >
              All
            </button>
            {categories.map((category) => {
              const duplicateName = categories.some(
                (other) => other.id !== category.id && other.name.toLocaleLowerCase() === category.name.toLocaleLowerCase(),
              );
              const label = duplicateName
                ? category.name + (category.item_type === "Physical" ? " · Products" : " · Services")
                : category.name;
              const selected = selectedCategoryId === String(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => selectCategory(String(category.id))}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${selected ? "bg-orange-500 text-black" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {categoriesLoading && <p role="status" className="mt-2 text-xs text-white/50">Loading categories…</p>}
          {!categoriesLoading && categoryError && (
            <p role="alert" className="mt-2 text-xs text-red-300">
              Categories could not be loaded: {categoryError}. The All tab remains available.
            </p>
          )}
          {!categoriesLoading && !categoryError && categories.length === 0 && (
            <p className="mt-2 text-xs text-white/45">No categories yet. Items without a category remain available under All.</p>
          )}
        </div>
        <div className="overflow-x-auto">
        <table className="min-w-[880px] w-full text-left text-sm">
          <thead className="text-xs text-white/40"><tr><th className="px-3 py-3">NAME</th><th className="px-3 py-3">TYPE</th><th className="px-3 py-3">BASE UNIT</th><th className="px-3 py-3">SELLING UNITS</th><th className="px-3 py-3">PRICE</th><th className="px-3 py-3">STOCK</th><th className="px-3 py-3">THRESHOLD</th><th className="px-3 py-3">ACTIONS</th></tr></thead>
          <tbody>
            {productsLoading ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-white/50">Loading inventory…</td></tr>
            ) : productsLoadError ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-red-300">
                  Inventory could not be loaded. <button type="button" onClick={() => void loadProducts()} className="ml-1 underline underline-offset-2">Retry</button>
                </td>
              </tr>
            ) : filteredProducts.map((product) => (
              <tr key={product.id} className="border-t border-white/5">
                <td className="px-3 py-4">{product.name}</td>
                <td className="px-3 py-4">{product.product_type}</td>
                <td className="px-3 py-4">{product.product_type === "Service" ? "—" : displayUnit(product.base_unit)}</td>
                <td className="px-3 py-4">
                  {product.product_type === "Service" ? <span className="text-white/30">Not applicable</span> : <div className="space-y-1">
                    {(product.units ?? []).map((unit) => (
                      <p key={unit.id} className="whitespace-nowrap text-xs text-white/60">
                        {unit.name}: {Number.isFinite(Number(unit.base_quantity)) && Number(unit.base_quantity) > 0 ? `${unit.base_quantity} ${displayUnit(product.base_unit)}` : "Conversion unavailable"} · ₦{Number(unit.price).toLocaleString("en-NG")}
                      </p>
                    ))}
                    {!product.units?.length && <span className="text-white/30">No units configured</span>}
                  </div>}
                </td>
                <td className="px-3 py-4">₦{Number(product.price).toLocaleString()}</td>
                <td className="px-3 py-4">{product.product_type === "Service" ? "—" : `${product.stock_quantity} ${displayUnit(product.base_unit)}`}</td>
                <td className="px-3 py-4">{product.product_type === "Service" ? "—" : product.low_stock_threshold ?? "—"}</td>
                <td className="px-3 py-4"><div className="flex flex-wrap gap-2">
                  <button disabled={pendingAction !== null} onClick={() => adjust(product, 1)} className="rounded bg-white/10 px-2 py-1 text-xs disabled:opacity-40">{pendingAction === "adjust-" + product.id ? "Updating..." : "+1"}</button>
                  <button disabled={pendingAction !== null || product.stock_quantity <= 0} onClick={() => adjust(product, -1)} className="rounded bg-white/10 px-2 py-1 text-xs disabled:opacity-30">-1</button>
                  <button disabled={pendingAction !== null} onClick={() => beginEdit(product)} className="rounded bg-white/10 px-2 py-1 text-xs disabled:opacity-40">Edit</button>
                  <button disabled={pendingAction !== null} onClick={() => remove(product.id)} className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-300 disabled:opacity-40">{pendingAction === "delete-" + product.id ? "Deleting..." : "Delete"}</button>
                  <button onClick={() => loadMovements(product.id)} className="rounded bg-orange-500/10 px-2 py-1 text-xs text-orange-300">Movements</button>
                </div></td>
              </tr>
            ))}
            {!productsLoading && !productsLoadError && filteredProducts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-white/70">
                  {selectedCategoryId === "all"
                    ? "No products or services yet. Fill in the form above or import a CSV file."
                    : "No products or services are assigned to this category yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </section>
      <section className="mt-6 rounded-2xl border border-white/10 bg-[#151515] p-5">
        <div><h2 className="font-semibold">Stock receiving history</h2><p className="mt-1 text-xs text-white/35">Previous receiving entries are shown from the server&apos;s inventory movement history.</p></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-white/40"><tr><th className="px-3 py-3">RECORDED</th><th className="px-3 py-3">PRODUCT ID</th><th className="px-3 py-3">QUANTITY ADDED</th><th className="px-3 py-3">RECEIVING DETAILS</th></tr></thead><tbody>
          {receivingMovements.map((movement) => <tr key={movement.id} className="border-t border-white/5"><td className="px-3 py-3">{formatNigeriaDateTime(movement.created_at)}</td><td className="px-3 py-3">#{movement.product_id}</td><td className="px-3 py-3">+{movement.quantity_change} {movement.reason?.match(/(?:^| \| )Unit: ([^|]+)/)?.[1]?.trim() ? displayUnit(movement.reason.match(/(?:^| \| )Unit: ([^|]+)/)?.[1]?.trim() ?? "") : "unit not recorded"}</td><td className="px-3 py-3">{movement.reason}</td></tr>)}
          {!receivingMovements.length && <tr><td colSpan={4} className="px-3 py-10 text-center text-white/30">No stock receiving records yet.</td></tr>}
        </tbody></table></div>
      </section>
      <section data-tour="inventory-movements" className="mt-6 rounded-2xl border border-white/10 bg-[#151515] p-5">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-semibold">Inventory movements</h2><p className="mt-1 text-xs text-white/35">{movementProduct ? "Product #" + movementProduct : "All store movements"}</p></div>
          <button onClick={() => loadMovements()} className="rounded-lg bg-white/10 px-3 py-2 text-sm">Refresh all</button>
        </div>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="text-xs text-white/40"><tr><th className="px-3 py-3">DATE</th><th className="px-3 py-3">PRODUCT</th><th className="px-3 py-3">CHANGE</th><th className="px-3 py-3">NEW STOCK</th><th className="px-3 py-3">REASON</th></tr></thead>
          <tbody>
            {movements.map((m) => <tr key={m.id} className="border-t border-white/5"><td className="px-3 py-3">{formatNigeriaDateTime(m.created_at)}</td><td className="px-3 py-3">#{m.product_id}</td><td className="px-3 py-3">{m.quantity_change > 0 ? "+" + m.quantity_change : m.quantity_change}</td><td className="px-3 py-3">{m.new_quantity}</td><td className="px-3 py-3">{m.reason || "—"}</td></tr>)}
            {!movements.length && <tr><td colSpan={5} className="px-3 py-10 text-center text-white/30">No movements yet.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </DashboardShell>
  );
}
