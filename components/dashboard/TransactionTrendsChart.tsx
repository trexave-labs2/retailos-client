"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import type { Product, ProductType } from "@/lib/types";

type TrendSale = {
  id: number;
  created_at: string;
  items: Array<{
    product_id: number;
    product_name: string;
    line_total: string | number;
  }>;
};

type TrendSeries = {
  id: number;
  name: string;
  type: ProductType;
  color: string;
  values: number[];
  total: number;
};

const COLORS = ["#fb923c", "#60a5fa", "#34d399", "#c084fc", "#f87171", "#facc15", "#2dd4bf", "#a3e635"];
const RANGE_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

export default function TransactionTrendsChart() {
  const { user } = useAuth();
  const storeId = user?.store_id ?? null;
  const [range, setRange] = useState<"7" | "30" | "90">("7");
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<TrendSale[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const today = getTodayLagosDate();
  const startDate = shiftDate(today, -(Number(range) - 1));

  useEffect(() => {
    let cancelled = false;

    async function loadTrends() {
      if (!storeId) {
        setError("No store is associated with this account.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          store_id: String(storeId),
          start_date: startDate,
          end_date: today,
        });
        const [salesResult, productResult] = await Promise.all([
          api<{ sales: TrendSale[] }>(`/sales?${params.toString()}`, { refresh: true }),
          api<{ products: Product[] }>(`/product/list?store_id=${encodeURIComponent(String(storeId))}`, { refresh: true }),
        ]);
        if (cancelled) return;
        setSales(salesResult.sales ?? []);
        setProducts(productResult.products ?? []);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load transaction trends.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTrends();
    return () => { cancelled = true; };
  }, [storeId, startDate, today, retryCount]);

  const chart = useMemo(() => {
    const days = Array.from({ length: Number(range) }, (_, index) => shiftDate(startDate, index));
    const productById = new Map(products.map((product) => [product.id, product]));
    const totalsByItemAndDay = new Map<number, Map<string, number>>();

    for (const sale of sales) {
      const day = getLagosDate(sale.created_at);
      if (!days.includes(day)) continue;
      for (const item of sale.items ?? []) {
        const product = productById.get(item.product_id);
        if (!product) continue;
        const byDay = totalsByItemAndDay.get(product.id) ?? new Map<string, number>();
        byDay.set(day, (byDay.get(day) ?? 0) + Number(item.line_total || 0));
        totalsByItemAndDay.set(product.id, byDay);
      }
    }

    const series: TrendSeries[] = [...totalsByItemAndDay.entries()]
      .map(([id, byDay]) => {
        const product = productById.get(id);
        if (!product) return null;
        const values = days.map((day) => byDay.get(day) ?? 0);
        return {
          id,
          name: product.name,
          type: product.product_type,
          color: COLORS[0],
          values,
          total: values.reduce((sum, value) => sum + value, 0),
        };
      })
      .filter((item): item is TrendSeries => item !== null)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map((item, index) => ({ ...item, color: COLORS[index % COLORS.length] }));

    return { days, series };
  }, [products, sales, range, startDate]);

  const visibleSeries = selectedIds === null
    ? chart.series.slice(0, 4)
    : chart.series.filter((series) => selectedIds.includes(series.id));
  const maxValue = Math.max(1, ...visibleSeries.flatMap((series) => series.values));
  const plot = { left: 70, top: 18, width: 880, height: 230 };
  const x = (index: number) => plot.left + (chart.days.length <= 1 ? 0 : (index / (chart.days.length - 1)) * plot.width);
  const y = (value: number) => plot.top + plot.height - (value / maxValue) * plot.height;
  const moneyLabel = (value: number) => value >= 1000000
    ? `₦${(value / 1000000).toFixed(1)}m`
    : value >= 1000 ? `₦${(value / 1000).toFixed(1)}k` : `₦${Math.round(value)}`;
  const labelIndexes = [...new Set([0, Math.floor((chart.days.length - 1) / 4), Math.floor((chart.days.length - 1) / 2), Math.floor(((chart.days.length - 1) * 3) / 4), chart.days.length - 1])];

  return (
    <section aria-labelledby="transaction-trends-title" className="mt-5 min-w-0 rounded-2xl border border-white/10 bg-[#151515] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="transaction-trends-title" className="font-semibold">Transaction trends</h2>
          <p className="mt-1 text-xs leading-5 text-white/45">Daily sales value by product and service, using recorded sale line totals.</p>
        </div>
        <label className="shrink-0 text-xs text-white/60">
          Time range
          <select aria-label="Transaction trends time range" value={range} onChange={(event) => { setRange(event.target.value as "7" | "30" | "90"); setSelectedIds(null); }} className="mt-1 block w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white">
            {RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <div role="status" aria-live="polite" className="mt-5 rounded-xl bg-white/[0.03] p-5 text-sm text-white/55">Loading transaction trends…</div>
      ) : error ? (
        <div role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-200">Transaction trends could not be loaded: {error}</p>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-3 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-black">Retry chart</button>
        </div>
      ) : chart.series.length === 0 ? (
        <p className="mt-4 rounded-xl bg-white/[0.03] p-4 text-sm text-white/55">No product or service sales were recorded during this period.</p>
      ) : (
        <>
          <fieldset className="mt-4">
            <legend className="text-xs font-medium text-white/60">Show series (up to 8 highest-selling items)</legend>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {chart.series.map((series) => (
                <label key={series.id} className="flex min-w-0 cursor-pointer items-center gap-2 text-xs text-white/75">
                  <input type="checkbox" checked={selectedIds === null ? chart.series.slice(0, 4).some((item) => item.id === series.id) : selectedIds.includes(series.id)} onChange={(event) => setSelectedIds((current) => { const selected = current ?? chart.series.slice(0, 4).map((item) => item.id); return event.target.checked ? [...new Set([...selected, series.id])] : selected.filter((id) => id !== series.id); })} className="accent-orange-400" />
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: series.color }} />
                  <span className="max-w-44 break-words">{series.name}</span>
                  <span className="text-white/35">{series.type === "Service" ? "Service" : "Product"}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 min-w-0 overflow-hidden rounded-xl border border-white/5 bg-black/20 p-2 sm:p-3">
            {visibleSeries.length === 0 ? (
              <p className="p-6 text-center text-sm text-white/55">Select at least one product or service to display the chart.</p>
            ) : (
              <svg role="img" aria-label={`Daily transaction value for ${visibleSeries.map((series) => series.name).join(", ")} from ${startDate} to ${today}`} viewBox="0 0 1000 300" className="block h-auto w-full" preserveAspectRatio="xMidYMid meet">
                {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                  const value = maxValue * fraction;
                  const gridY = y(value);
                  return (
                    <g key={fraction}>
                      <line x1={plot.left} x2={plot.left + plot.width} y1={gridY} y2={gridY} stroke="rgba(255,255,255,0.10)" strokeDasharray="3 5" />
                      <text x={plot.left - 10} y={gridY + 4} fill="rgba(255,255,255,0.55)" fontSize="11" textAnchor="end">{moneyLabel(value)}</text>
                    </g>
                  );
                })}
                {labelIndexes.map((index) => (
                  <text key={chart.days[index]} x={x(index)} y={plot.top + plot.height + 24} fill="rgba(255,255,255,0.55)" fontSize="11" textAnchor={index === 0 ? "start" : index === chart.days.length - 1 ? "end" : "middle"}>{chart.days[index].slice(5)}</text>
                ))}
                {visibleSeries.map((series) => (
                  <g key={series.id}>
                    <polyline fill="none" stroke={series.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={series.values.map((value, index) => `${x(index)},${y(value)}`).join(" ")} />
                    {series.values.map((value, index) => (
                      <circle key={chart.days[index]} cx={x(index)} cy={y(value)} r={chart.days.length <= 7 ? 3 : 1.8} fill={series.color}>
                        <title>{`${series.name} · ${chart.days[index]} · ₦${value.toLocaleString("en-NG")}`}</title>
                      </circle>
                    ))}
                  </g>
                ))}
              </svg>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-1 text-xs text-white/40 sm:flex-row sm:justify-between">
            <span>Dates use the Africa/Lagos business calendar.</span>
            <span>{startDate} to {today}</span>
          </div>
        </>
      )}
    </section>
  );
}

function getTodayLagosDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function getLagosDate(timestamp: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
