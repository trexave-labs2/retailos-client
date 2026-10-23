"use client";

import { ChangeEvent, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { Product, ProductType } from "@/lib/types";

type CsvRow = {
  rowNumber: number;
  name: string;
  productType: ProductType;
  price: number | null;
  stock: number | null;
  sku: string;
  category: string;
  costPrice: string;
  errors: string[];
};
type ParsedCsv = { headers: string[]; rows: CsvRow[]; unsupportedColumns: string[] };

const TEMPLATE = "Item type,Product name,Selling price,Opening stock,SKU or barcode,Category,Cost price\nProduct,Bottled Water 75cl,350,30,SKU-001,Drinks,220\nProduct,Instant Noodles,450,40,SKU-002,Food,300\nService,Home delivery,1500,,,,\n";

function parseRecords(input: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") { row.push(field.trim()); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field.trim()); field = "";
      if (row.some((cell) => cell !== "")) records.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field.trim());
  if (row.some((cell) => cell !== "")) records.push(row);
  return records;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
const HEADER_ALIASES: Record<string, string> = {
  "item type": "productType", type: "productType", "product type": "productType",
  "product name": "name", "service name": "name", name: "name",
  "selling price": "price", price: "price",
  "opening stock": "stock", stock: "stock", quantity: "stock",
  sku: "sku", barcode: "sku", "sku or barcode": "sku", category: "category",
  "cost price": "costPrice", cost: "costPrice",
};

function parseProductType(value: string | undefined): ProductType | null {
  const normalized = (value ?? "").trim().toLocaleLowerCase();
  if (!normalized || ["product", "physical", "goods"].includes(normalized)) return "Physical";
  if (["service", "services"].includes(normalized)) return "Service";
  return null;
}

function parseCsv(input: string, existing: Product[]): ParsedCsv {
  const records = parseRecords(input.replace(/^\uFEFF/, ""));
  if (records.length < 2) throw new Error("Add a header row and at least one item row.");
  const originalHeaders = records[0];
  const mapped = originalHeaders.map((header) => HEADER_ALIASES[normalizeHeader(header)] ?? "");
  const required = ["name", "price"];
  const missing = required.filter((field) => !mapped.includes(field));
  if (missing.length) throw new Error("Missing required column(s): " + missing.map((x) => x === "name" ? "Product name" : "Selling price").join(", ") + ".");
  const supported = new Set(["productType", "name", "price", "stock", "sku", "category", "costPrice"]);
  const unsupportedColumns = originalHeaders.filter((_, index) => !supported.has(mapped[index]));
  const usedNames = new Set<string>();
  const usedIdentifiers = new Set<string>();
  const existingNames = new Set(existing.map((product) => product.name.trim().toLocaleLowerCase()));
  const rows: CsvRow[] = records.slice(1).map((cells, index) => {
    const values: Record<string, string> = {};
    mapped.forEach((key, column) => { if (key && values[key] === undefined) values[key] = cells[column] ?? ""; });
    const name = values.name ?? "";
    const priceText = values.price ?? "";
    const typeValue = values.productType;
    const productType = parseProductType(typeValue);
    const priceNumber = priceText === "" ? NaN : Number(priceText);
    const stockText = values.stock ?? "";
    const stockNumber = stockText === "" ? (productType === "Service" ? 0 : NaN) : Number(stockText);
    const errors: string[] = [];
    if (!name) errors.push("Item name is required.");
    else {
      const normalized = name.toLocaleLowerCase();
      if (usedNames.has(normalized)) errors.push("Duplicate item name in this CSV.");
      else if (existingNames.has(normalized)) errors.push("An item with this name already exists in your store.");
      usedNames.add(normalized);
    }
    if (typeValue && !productType) errors.push('Item type must be "Product" or "Service".');
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) errors.push("Selling price must be a number greater than 0.");
    if (productType === "Physical" && (!Number.isInteger(stockNumber) || stockNumber < 0)) {
      errors.push("Opening stock for a product must be a whole number that is 0 or greater.");
    }
    if (productType === "Service" && stockText !== "" && stockText !== "0") {
      errors.push("Services do not track stock. Leave Opening stock blank or enter 0.");
    }
    const identifier = (values.sku ?? "").trim().toLocaleLowerCase();
    if (identifier) {
      if (usedIdentifiers.has(identifier)) errors.push("Duplicate SKU/barcode in this CSV.");
      usedIdentifiers.add(identifier);
    }
    return {
      rowNumber: index + 2,
      name,
      productType: productType ?? "Physical",
      price: Number.isFinite(priceNumber) ? priceNumber : null,
      stock: productType === "Service" ? 0 : Number.isInteger(stockNumber) && stockNumber >= 0 ? stockNumber : null,
      sku: values.sku ?? "",
      category: values.category ?? "",
      costPrice: values.costPrice ?? "",
      errors,
    };
  });
  return { headers: originalHeaders, rows, unsupportedColumns };
}

function serverErrorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    const details = Object.entries(cause.fields ?? {}).map(([field, message]) => field.replace(/_/g, " ") + ": " + message);
    return [cause.message, cause.code ? "(" + cause.code + ")" : "", ...details].filter(Boolean).join(" ");
  }
  return cause instanceof Error ? cause.message : "The server rejected this row for an unknown reason.";
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "retailos-item-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function CsvImport({ storeId, onImported }: { storeId: number | null; onImported: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestCounter = useRef(0);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  async function fetchCatalogue(): Promise<{ products: Product[] }> {
    requestCounter.current += 1;
    return api<{ products: Product[] }>(
      "/product/list?store_id=" + storeId + "&_import_check=" + requestCounter.current,
      { refresh: true },
    );
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setParsed(null); setError(""); setSummary(""); setProgress("");
    if (!file) return;
    setFileName(file.name);
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Choose a .csv file."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("CSV must be 2 MB or smaller."); return; }
    try {
      if (!storeId) throw new Error("Your account has no store attached.");
      const existingData = await fetchCatalogue();
      setParsed(parseCsv(await file.text(), existingData.products));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to read this CSV.");
    }
  }

  async function importRows() {
    if (!parsed || !storeId || busy) return;
    const validRows = parsed.rows.filter((row) => row.errors.length === 0);
    if (!validRows.length) { setError("There are no valid rows to import. Correct the errors and upload the CSV again."); return; }
    setBusy(true); setError(""); setSummary(""); setProgress("");
    let importedProducts = 0;
    let importedServices = 0;
    let skipped = parsed.rows.length - validRows.length;
    const failures: string[] = [];
    try {
      for (let index = 0; index < validRows.length; index++) {
        const row = validRows[index];
        setProgress("Importing " + (index + 1) + " of " + validRows.length + ": " + row.name);
        try {
          const current = await fetchCatalogue();
          if (current.products.some((product) => product.name.trim().toLocaleLowerCase() === row.name.trim().toLocaleLowerCase())) {
            skipped++;
            continue;
          }
          await api("/product/create", {
            method: "POST",
            json: {
              store_id: storeId,
              name: row.name.trim(),
              product_type: row.productType,
              base_unit: "piece",
              price: row.price,
              ...(row.productType === "Physical" ? { opening_stock: row.stock, low_stock_threshold: 0 } : {}),
            },
          });
          if (row.productType === "Service") importedServices++;
          else importedProducts++;
        } catch (e) {
          // The response can be lost after the server commits. Verify the catalogue before calling it a failure.
          try {
            const after = await fetchCatalogue();
            if (after.products.some((product) => product.name.trim().toLocaleLowerCase() === row.name.trim().toLocaleLowerCase())) {
              skipped++;
              continue;
            }
          } catch { /* Keep the original server error. */ }
          failures.push("Row " + row.rowNumber + " (" + row.name + "): " + serverErrorMessage(e));
        }
      }
      await onImported();
      const totalImported = importedProducts + importedServices;
      const notes = [
        totalImported + " item(s) imported: " + importedProducts + " product(s), " + importedServices + " service(s).",
        skipped + " row(s) skipped (invalid, duplicate, or already present).",
        failures.length ? failures.length + " row(s) rejected or failed by the server." : "The server accepted all attempted rows.",
        parsed.rows.some((row) => row.sku || row.category || row.costPrice)
          ? "SKU/barcode, category, and cost price are shown in the preview only because the current product-create API does not persist those fields."
          : "",
      ].filter(Boolean);
      setSummary(notes.join(" "));
      if (failures.length) setError(failures.join("\n"));
      const latest = await fetchCatalogue();
      setParsed((current) => current ? {
        ...current,
        rows: current.rows.map((row) => {
          if (row.errors.length) return row;
          if (latest.products.some((product) => product.name.trim().toLocaleLowerCase() === row.name.trim().toLocaleLowerCase())) {
            return { ...row, errors: ["Already present in your store; will not be imported again."] };
          }
          return row;
        }),
      } : current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import stopped unexpectedly. Reload the preview before retrying.");
    } finally {
      setBusy(false); setProgress("");
    }
  }

  const validCount = parsed?.rows.filter((row) => row.errors.length === 0).length ?? 0;
  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-[#151515] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Import products and services from CSV</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-white/55">Download the template, preview every row, and import valid products or services. Services do not affect stock.</p></div>
        <button type="button" onClick={downloadTemplate} className="rounded-lg border border-white/20 px-3 py-2 text-sm">Download CSV template</button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={chooseFile} aria-label="Choose product and service CSV file" className="block max-w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white" />
        {fileName && <span className="text-xs text-white/45">{fileName}</span>}
      </div>
      <p className="mt-3 text-xs leading-5 text-white/40">Required: Product name and Selling price. Item type is optional and defaults to Product. Physical products also require Opening stock; leave it blank for services. Optional columns: SKU or barcode, Category, Cost price. Those optional metadata fields are not persisted by the current server API.</p>
      {error && <p role="alert" className="mt-4 whitespace-pre-line rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {summary && <p role="status" className="mt-4 rounded-lg bg-green-500/10 p-3 text-sm text-green-300">{summary}</p>}
      {progress && <p role="status" className="mt-3 text-sm text-orange-300">{progress}</p>}
      {parsed && <>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-medium">Preview: {parsed.rows.length} row(s)</h3><p className="mt-1 text-sm text-white/55">{validCount} valid · {parsed.rows.length - validCount} with errors</p></div>
          <button type="button" disabled={busy || validCount === 0} onClick={importRows} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Importing…" : "Import valid rows"}</button>
        </div>
        {parsed.unsupportedColumns.length > 0 && <p className="mt-3 text-sm text-amber-300">Unrecognized columns (ignored): {parsed.unsupportedColumns.join(", ")}</p>}
        <div className="mt-4 max-h-96 overflow-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#202020] text-xs text-white/50"><tr><th className="px-3 py-3">ROW</th><th className="px-3 py-3">TYPE</th><th className="px-3 py-3">ITEM</th><th className="px-3 py-3">PRICE</th><th className="px-3 py-3">OPENING STOCK</th><th className="px-3 py-3">SKU / BARCODE</th><th className="px-3 py-3">VALIDATION</th></tr></thead>
            <tbody>{parsed.rows.map((row) => <tr key={row.rowNumber} className="border-t border-white/5 align-top">
              <td className="px-3 py-3 text-white/45">{row.rowNumber}</td><td className="px-3 py-3">{row.productType === "Service" ? "Service" : "Product"}</td><td className="px-3 py-3">{row.name || "—"}</td><td className="px-3 py-3">{row.price == null ? "—" : "₦" + row.price.toLocaleString("en-NG")}</td><td className="px-3 py-3">{row.productType === "Service" ? "Not applicable" : row.stock ?? "—"}</td><td className="px-3 py-3">{row.sku || "—"}</td><td className="px-3 py-3">{row.errors.length ? <ul className="list-disc space-y-1 pl-4 text-red-300">{row.errors.map((message) => <li key={message}>{message}</li>)}</ul> : <span className="text-green-300">Valid</span>}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {parsed.rows.some((row) => row.errors.length > 0) && <p className="mt-3 text-xs leading-5 text-white/45">Correct invalid rows in the CSV and upload it again. Rows accepted by the server are detected before future writes to reduce accidental duplicates.</p>}
      </>}
    </section>
  );
}
