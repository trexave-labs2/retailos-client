"use client";

import { ChangeEvent, useState } from "react";
import { ApiError, api } from "@/lib/api";

type ImportError = { row: number; field?: string; message?: string };
type ImportResult = {
  created_count: number;
  failed_count: number;
  created: Array<{ id?: number; name?: string; product_type?: string }>;
  errors: ImportError[];
};

const TEMPLATE =
  "name,price,product_type,category_id,base_unit,opening_stock,low_stock_threshold,sku,barcode,cost_price\n" +
  "Bottled Water 75cl,350,Physical,,piece,30,3,SKU-001,,220\n" +
  "Instant Noodles,450,Physical,,piece,40,5,SKU-002,,300\n" +
  "Home delivery,1500,Service,,service,0,,,,";

function downloadTemplate() {
  const blob = new Blob(["\uFEFF", TEMPLATE, "\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "retailos-item-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const details = Object.entries(error.fields ?? {}).map(
      ([field, message]) => field.replace(/_/g, " ") + ": " + message,
    );
    return [error.message, error.code ? "(" + error.code + ")" : "", ...details]
      .filter(Boolean)
      .join(" ");
  }
  return error instanceof Error ? error.message : "The server could not complete the import.";
}

export default function CsvImport({
  storeId,
  onImported,
}: {
  storeId: number | null;
  onImported: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [rowErrors, setRowErrors] = useState<ImportError[]>([]);
  const [busy, setBusy] = useState(false);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setError("");
    setSummary("");
    setRowErrors([]);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!selected.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Choose a .csv file.");
      event.target.value = "";
      return;
    }
    if (selected.size > 2 * 1024 * 1024) {
      setFile(null);
      setError("CSV must be 2 MiB or smaller.");
      event.target.value = "";
      return;
    }
    setFile(selected);
  }

  async function importFile() {
    if (!file || !storeId || busy) return;
    setBusy(true);
    setError("");
    setSummary("");
    setRowErrors([]);
    try {
      const form = new FormData();
      form.append("store_id", String(storeId));
      form.append("file", file);
      const result = await api<ImportResult>("/product/import", {
        method: "POST",
        body: form,
      });
      setRowErrors(result.errors ?? []);
      setSummary(
        "Import complete: " +
          result.created_count +
          " item(s) created and " +
          result.failed_count +
          " row(s) rejected. The server processes valid rows independently.",
      );
      if (result.created_count > 0) await onImported();
      if (result.failed_count === 0) {
        setFile(null);
        const input = document.getElementById("csv-import-file");
        if (input instanceof HTMLInputElement) input.value = "";
      }
    } catch (cause) {
      setError(
        formatApiError(cause) +
          " If the connection failed during import, refresh inventory before retrying because the server may already have created valid rows.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-[#151515] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Import products and services from CSV</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/55">
            Download the server-compatible template, then upload it. RetailOS validates each row and reports which items were created or rejected.
          </p>
        </div>
        <button type="button" onClick={downloadTemplate} className="rounded-lg border border-white/20 px-3 py-2 text-sm">
          Download CSV template
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          id="csv-import-file"
          type="file"
          accept=".csv,text/csv"
          onChange={chooseFile}
          aria-label="Choose product and service CSV file"
          disabled={busy}
          className="block max-w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
        />
        <button
          type="button"
          onClick={() => void importFile()}
          disabled={!file || !storeId || busy}
          className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Importing…" : "Import CSV"}
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-white/45">
        Supported columns: name and price are required. Optional columns are product_type (Physical or Service), category_id, base_unit, opening_stock, low_stock_threshold, sku, barcode, and cost_price. Use category IDs belonging to this store and matching the item type. Leave optional values blank when they do not apply. The server accepts UTF-8 CSV files up to 2 MiB and 1,000 data rows.
      </p>

      {error && <p role="alert" className="mt-4 whitespace-pre-line rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {summary && <p role="status" className={`mt-4 rounded-lg p-3 text-sm ${rowErrors.length ? "bg-amber-500/10 text-amber-300" : "bg-green-500/10 text-green-300"}`}>{summary}</p>}
      {rowErrors.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-500/20 p-3">
          <h3 className="text-sm font-semibold">Rows rejected by the server</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-300">
            {rowErrors.map((item, index) => (
              <li key={item.row + "-" + (item.field ?? "") + "-" + index}>
                Row {item.row}{item.field ? " · " + item.field.replace(/_/g, " ") : ""}: {item.message ?? "The row was rejected by server validation."}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
