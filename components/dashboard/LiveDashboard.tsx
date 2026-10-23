"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import DashboardShell from "@/components/layout/DashboardShell";
import TransactionTrendsChart from "@/components/dashboard/TransactionTrendsChart";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import type { DailyBrief, DashboardRankings, DashboardStats, SaleSummary } from "@/lib/types";
import { formatNigeriaDate, formatNigeriaDateTime } from "@/lib/nigeria-time";

export default function LiveDashboard() {
  const { user } = useAuth();
  const storeId = user?.store_id ?? null;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [periodStart, setPeriodStart] = useState(getTodayLagosDate);
  const [periodEnd, setPeriodEnd] = useState(getTodayLagosDate);
  const [rankings, setRankings] = useState<DashboardRankings | null>(null);
  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [rankingsError, setRankingsError] = useState<string | null>(null);
  const [rankingsRetryCount, setRankingsRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        if (!storeId) throw new Error("No store is associated with this account.");

        const query = "?store_id=" + encodeURIComponent(String(storeId));
        // The daily brief is supplementary dashboard content. A brief API failure
        // must not take down the entire dashboard.
        const [dashboardResult, briefResult, salesResult] = await Promise.allSettled([
          api<DashboardStats>("/dashboard" + query),
          api<DailyBrief>("/dashboard/daily-brief" + query),
          api<{ sales: SaleSummary[] }>("/sales" + query),
        ]);

        if (cancelled) return;
        if (dashboardResult.status === "rejected") throw dashboardResult.reason;

        setStats(dashboardResult.value);
        if (briefResult.status === "fulfilled") {
          setBrief(briefResult.value);
          setBriefError(null);
        } else {
          setBrief(null);
          setBriefError(briefResult.reason instanceof Error
            ? briefResult.reason.message
            : "Unable to load the daily business brief.");
        }
        setSales(salesResult.status === "fulfilled" ? (salesResult.value.sales ?? []) : []);
        setError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();
    return () => { cancelled = true; };
  }, [storeId, retryCount]);

  useEffect(() => {
    if (!storeId) return;

    let cancelled = false;

    async function refreshBrief() {
      try {
        const params = new URLSearchParams({ store_id: String(storeId) });
        const latest = await api<DailyBrief>(`/dashboard/daily-brief?${params.toString()}`, { refresh: true });
        if (!cancelled) {
          setBrief(latest);
          setBriefError(null);
        }
      } catch (err: unknown) {
        // Preserve the last good brief during a background refresh failure.
        if (!cancelled) {
          setBriefError(err instanceof Error ? err.message : "Unable to refresh the daily business brief.");
        }
      }
    }

    const handleInventoryChanged = () => { void refreshBrief(); };
    const handleFocus = () => {
      if (document.visibilityState === "visible") void refreshBrief();
    };

    window.addEventListener("retailos:inventory-changed", handleInventoryChanged);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("retailos:inventory-changed", handleInventoryChanged);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [storeId]);

  useEffect(() => {
    let cancelled = false;

    async function loadRankings() {
      if (!storeId) {
        setRankingsError("No store is associated with this account.");
        setRankingsLoading(false);
        return;
      }
      if (!periodStart || !periodEnd) return;
      if (periodStart > periodEnd) {
        setRankings(null);
        setRankingsError("Start date must be on or before end date.");
        setRankingsLoading(false);
        return;
      }

      setRankingsLoading(true);
      setRankingsError(null);
      setRankings(null);

      try {
        const params = new URLSearchParams({
          store_id: String(storeId),
          start_date: periodStart,
          end_date: periodEnd,
        });
        const result = await api<DashboardRankings>(`/dashboard/rankings?${params.toString()}`, { refresh: true });
        if (cancelled) return;
        setRankings(result);
      } catch (err: unknown) {
        if (cancelled) return;
        setRankingsError(err instanceof Error ? err.message : "Unable to load dashboard rankings.");
      } finally {
        if (!cancelled) setRankingsLoading(false);
      }
    }

    void loadRankings();
    return () => { cancelled = true; };
  }, [storeId, periodStart, periodEnd, rankingsRetryCount]);

  // The shell (sidebar, title, sign out) is always rendered so the layout never
  // jumps. Only the content area changes between loading, error, and loaded.
  return (
    <DashboardShell title="Dashboard">
      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <section role="alert" className="rounded-2xl border border-red-500/20 bg-[#151515] p-6">
          <h2 className="font-semibold">Dashboard unavailable</h2>
          <p className="mt-2 text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); setRetryCount((count) => count + 1); }}
            className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black"
          >
            Try again
          </button>
        </section>
      ) : !stats ? (
        <p className="text-sm text-white/60">Dashboard data is unavailable.</p>
      ) : (
        <DashboardContent user={user?.username} stats={stats} brief={brief} briefError={briefError} onRetryBrief={() => setRetryCount((count) => count + 1)} sales={sales} rankings={rankings} rankingsLoading={rankingsLoading} rankingsError={rankingsError} periodStart={periodStart} periodEnd={periodEnd} onPeriodStartChange={setPeriodStart} onPeriodEndChange={setPeriodEnd} onRetryRankings={() => setRankingsRetryCount((count) => count + 1)} />
      )}
    </DashboardShell>
  );
}

function DashboardContent({
  user,
  stats,
  brief,
  briefError,
  onRetryBrief,
  sales,
  rankings,
  rankingsLoading,
  rankingsError,
  periodStart,
  periodEnd,
  onPeriodStartChange,
  onPeriodEndChange,
  onRetryRankings,
}: {
  user?: string;
  stats: DashboardStats;
  brief: DailyBrief | null;
  briefError: string | null;
  onRetryBrief: () => void;
  sales: SaleSummary[];
  rankings: DashboardRankings | null;
  rankingsLoading: boolean;
  rankingsError: string | null;
  periodStart: string;
  periodEnd: string;
  onPeriodStartChange: (value: string) => void;
  onPeriodEndChange: (value: string) => void;
  onRetryRankings: () => void;
}) {
  const restockRecommendations = (brief?.insights?.restock_recommendations ?? []).filter((item) =>
    Number.isSafeInteger(item.product_id) &&
    item.product_id > 0 &&
    typeof item.product_name === "string" &&
    item.product_name.trim().length > 0 &&
    Number.isFinite(item.stock_quantity) &&
    item.stock_quantity >= 0 &&
    item.low_stock_threshold !== null &&
    Number.isFinite(item.low_stock_threshold) &&
    item.low_stock_threshold >= 0 &&
    item.stock_quantity <= item.low_stock_threshold
  );

  return (
    <>
      <header><h2 className="text-lg font-semibold">Welcome{user ? `, ${user}` : ""}.</h2></header>

      <section aria-labelledby="dashboard-summary" data-tour="dashboard-summary" className="mt-5 rounded-2xl border border-white/10 bg-[#151515] p-5">
        <h2 id="dashboard-summary" className="font-semibold">Business summary</h2>
        <p className="mt-1 text-xs text-white/45">Daily sales reporting date (Africa/Lagos): {brief?.date ? formatNigeriaDate(brief.date + "T12:00:00+01:00") : "Date not provided by the server"}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardMetric label="Products" value={stats.products_count} href="/inventory" />
          <DashboardMetric label="Low-stock products" value={stats.low_stock_count} href="/inventory" />
          <DashboardMetric label="Open alerts" value={stats.open_alerts_count} href="/alerts" />
          <DashboardMetric label="Sales in reporting period" value={stats.today_sales_count} />
          <DashboardMetric label="Sales total in reporting period" value={"₦" + Number(stats.today_sales_total).toLocaleString("en-NG")} />
        </div>
      </section>

      <section aria-labelledby="daily-brief" data-tour="dashboard-brief" className="mt-5 min-w-0 rounded-2xl border border-white/10 bg-[#151515] p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="daily-brief" className="font-semibold">Daily Business Brief</h2>
            <p className="mt-1 text-xs text-white/45">A quick view of today&apos;s performance and actions needing attention.</p>
          </div>
          {brief?.date ? <p className="text-xs text-white/45">{formatNigeriaDate(brief.date + "T12:00:00+01:00")}</p> : null}
        </div>

        {brief ? (
          <div className="mt-4 min-w-0 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="min-w-0 rounded-xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-xs text-white/55">Today&apos;s sales</p>
                <p className="mt-2 break-words text-xl font-semibold tabular-nums">₦{Number(brief.sales.today_total).toLocaleString("en-NG")}</p>
                <p className="mt-1 text-xs text-white/45">Current reporting day</p>
              </div>
              <div className="min-w-0 rounded-xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-xs text-white/55">Yesterday&apos;s sales</p>
                <p className="mt-2 break-words text-xl font-semibold tabular-nums">₦{Number(brief.sales.yesterday_total).toLocaleString("en-NG")}</p>
                <p className="mt-1 text-xs text-white/45">Previous reporting day</p>
              </div>
              <div className="min-w-0 rounded-xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-xs text-white/55">Daily change</p>
                <p className="mt-2 text-xl font-semibold">{brief.sales.change_percent != null ? `${brief.sales.change_percent}%` : "N/A"}</p>
                <p className="mt-1 text-xs text-white/45">
                  {brief.sales.change_percent == null
                    ? "No previous-day comparison available"
                    : brief.sales.status === "UP" ? "Sales increased" : brief.sales.status === "DOWN" ? "Sales decreased" : "Sales remained steady"}
                </p>
              </div>
            </div>

            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              <div className="min-w-0 rounded-xl border border-white/5 bg-black/20 p-4">
                <h3 className="font-medium">Alerts requiring attention</h3>
                {brief.alerts.length ? (
                  <ul className="mt-3 space-y-2">
                    {brief.alerts.map((alert) => (
                      <li key={alert.id} className="break-words rounded-lg border border-amber-400/10 bg-amber-400/[0.04] p-3 text-sm">
                        {alert.message}
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-sm text-white/55">No open alerts.</p>}
              </div>

              <div className="min-w-0 rounded-xl border border-white/5 bg-black/20 p-4">
                <h3 className="font-medium">Restock recommendations</h3>
                <p className="mt-1 text-xs leading-5 text-white/45">Physical products only. Quantities use each product&apos;s configured base unit.</p>
                {restockRecommendations.length ? (
                  <ul className="mt-3 space-y-2">
                    {restockRecommendations.map((item) => (
                      <li key={item.product_id} className="min-w-0 rounded-lg bg-white/[0.03] p-3">
                        <p className="break-words font-medium">{item.product_name}</p>
                        <p className="mt-1 text-xs text-white/60">
                          {item.stock_quantity} in stock · Reorder threshold: {item.low_stock_threshold}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 rounded-lg bg-white/[0.03] p-3 text-sm text-white/55">No physical products currently meet a valid reorder threshold.</p>}
              </div>

              <div className="min-w-0 rounded-xl border border-white/5 bg-black/20 p-4">
                <h3 className="font-medium">Top-selling product</h3>
                {brief.insights.high_performer ? (
                  <div className="mt-3 rounded-lg bg-white/[0.03] p-3">
                    <p className="break-words font-medium">{brief.insights.high_performer.product_name}</p>
                    <p className="mt-1 text-sm text-white/55">{brief.insights.high_performer.units_sold} units sold today</p>
                  </div>
                ) : <p className="mt-3 text-sm text-white/55">No sales recorded today yet.</p>}
              </div>

              {brief.insights.declining_product ? (
                <div className="min-w-0 rounded-xl border border-white/5 bg-black/20 p-4">
                  <h3 className="font-medium">Sales to watch</h3>
                  <p className="mt-3 break-words text-sm">
                    <span className="font-medium">{brief.insights.declining_product.product_name}</span>
                    <span className="text-white/55"> recorded </span>
                    {brief.insights.declining_product.yesterday_units_sold} units yesterday and {brief.insights.declining_product.today_units_sold} today.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : briefError ? (
          <div role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm text-red-200">The daily business brief could not be loaded.</p>
            <p className="mt-1 break-words text-xs text-red-200/70">{briefError}</p>
            <button type="button" onClick={onRetryBrief} className="mt-3 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-black">Retry brief</button>
          </div>
        ) : (
          <div role="status" aria-live="polite" className="mt-4 rounded-xl bg-white/[0.03] p-4 text-sm text-white/55">
            The daily business brief is not available yet.
          </div>
        )}
      </section>

      <TransactionTrendsChart />

      <DashboardRankingsSection
        rankings={rankings}
        loading={rankingsLoading}
        error={rankingsError}
        periodStart={periodStart}
        periodEnd={periodEnd}
        onPeriodStartChange={onPeriodStartChange}
        onPeriodEndChange={onPeriodEndChange}
        onRetry={onRetryRankings}
      />

      <section aria-labelledby="recent-sales" className="mt-5 rounded-2xl border border-white/10 bg-[#151515] p-5">
        <h2 id="recent-sales" className="font-semibold">Recent sales</h2>
        <p className="mt-1 text-xs text-white/45">Timestamps are displayed in Africa/Lagos time (WAT, UTC+01:00).</p>
        {sales.length > 0 ? (
          <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="text-xs text-white/40"><tr><th className="px-3 py-2">DATE &amp; TIME (WAT)</th><th className="px-3 py-2">SALE</th><th className="px-3 py-2">TOTAL</th></tr></thead>
            <tbody>{sales.slice(0, 10).map((sale) => <tr key={sale.id} className="border-t border-white/5"><td className="px-3 py-3">{formatNigeriaDateTime(sale.created_at)}</td><td className="px-3 py-3">#{sale.id}</td><td className="px-3 py-3">₦{Number(sale.total_amount).toLocaleString("en-NG")}</td></tr>)}</tbody>
          </table></div>
        ) : (
          <p className="mt-3 text-sm text-white/70">
            No sales have been recorded yet. <Link href="/sales" className="text-orange-300 underline underline-offset-4">Record your first sale</Link>.
          </p>
        )}
      </section>
    </>
  );
}

function DashboardMetric({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const content = (
    <>
      <p className="text-xs text-white/65">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </>
  );
  if (!href) return <div className="rounded-xl bg-white/5 p-4">{content}</div>;
  return (
    <Link href={href} className="block rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10">
      {content}
    </Link>
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

function DashboardRankingsSection({
  rankings,
  loading,
  error,
  periodStart,
  periodEnd,
  onPeriodStartChange,
  onPeriodEndChange,
  onRetry,
}: {
  rankings: DashboardRankings | null;
  loading: boolean;
  error: string | null;
  periodStart: string;
  periodEnd: string;
  onPeriodStartChange: (value: string) => void;
  onPeriodEndChange: (value: string) => void;
  onRetry: () => void;
}) {
  const reportedPeriod = rankings?.period;
  const periodLabel = reportedPeriod
    ? reportedPeriod.start_date === reportedPeriod.end_date
      ? `${reportedPeriod.start_date} (${reportedPeriod.timezone})`
      : `${reportedPeriod.start_date} to ${reportedPeriod.end_date} (${reportedPeriod.timezone})`
    : "Selected date range";

  return (
    <section aria-labelledby="dashboard-rankings" className="mt-5 rounded-2xl border border-white/10 bg-[#151515] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="dashboard-rankings" className="font-semibold">Product and service rankings</h2>
          <p className="mt-1 text-xs text-white/45">Rankings use the server-reported Africa/Lagos reporting period.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-white/60">
            Start date
            <input aria-label="Ranking start date" type="date" value={periodStart} max={periodEnd || undefined} onChange={(event) => onPeriodStartChange(event.target.value)} className="mt-1 block rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-white/60">
            End date
            <input aria-label="Ranking end date" type="date" value={periodEnd} min={periodStart || undefined} onChange={(event) => onPeriodEndChange(event.target.value)} className="mt-1 block rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white" />
          </label>
        </div>
      </div>
      <p className="mt-3 text-xs text-white/45">Reporting period: {periodLabel}</p>

      {loading ? (
        <div role="status" aria-live="polite" className="mt-4 space-y-3">
          <span className="text-sm text-white/60">Loading product and service rankings…</span>
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1].map((section) => <div key={section} className="rounded-xl bg-white/[0.03] p-4"><div className="h-4 w-36 animate-pulse rounded bg-white/10" /><div className="mt-4 h-8 animate-pulse rounded bg-white/5" /><div className="mt-2 h-8 animate-pulse rounded bg-white/5" /></div>)}
          </div>
        </div>
      ) : error ? (
        <div role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-300">Rankings could not be loaded: {error}</p>
          <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-black">Retry rankings</button>
        </div>
      ) : rankings ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <RankingList
            title="Top-selling products"
            description="Physical products ranked by net base units sold after recorded returns."
            emptyMessage="No physical product units were sold in this reporting period."
            rows={rankings.top_selling_products.map((item) => ({ id: item.product_id, name: item.product_name, measure: item.units_sold, unit: item.unit, measureLabel: "units sold" }))}
          />
          <RankingList
            title="Top services"
            description="Services ranked by distinct qualifying sales containing the service. Each sale counts once per service."
            emptyMessage="No qualifying service orders were recorded in this reporting period."
            rows={rankings.top_services.map((item) => ({ id: item.service_id, name: item.service_name, measure: item.completed_orders, unit: "orders", measureLabel: "service orders" }))}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/60">Rankings are unavailable for this reporting period.</p>
      )}
    </section>
  );
}

function RankingList({
  title,
  description,
  emptyMessage,
  rows,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  rows: Array<{ id: number; name: string; measure: number; unit: string; measureLabel: string }>;
}) {
  return (
    <section aria-label={title} className="rounded-xl border border-white/10 bg-black/20 p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-white/45">{description}</p>
      {rows.length ? (
        <ol className="mt-3 divide-y divide-white/5">
          {rows.map((row, index) => (
            <li key={row.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <span aria-label={`Rank ${index + 1}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-xs text-white/55">{index + 1}</span>
                <span className="min-w-0 break-words text-sm">{row.name}</span>
              </div>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold tabular-nums">{row.measure.toLocaleString("en-NG")} {row.unit}</span>
                <span className="block text-[11px] text-white/45">{row.measureLabel}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 rounded-lg bg-white/[0.03] p-3 text-sm text-white/60">{emptyMessage}</p>
      )}
    </section>
  );
}

/* ---------- Loading skeleton (matches the real layout so nothing jumps) ---------- */

function Bar({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded bg-white/10 motion-safe:animate-pulse ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading dashboard…</span>

      <Bar className="h-6 w-40" />

      <section className="mt-5 rounded-2xl border border-white/10 bg-[#151515] p-5">
        <Bar className="h-5 w-36" />
        <Bar className="mt-2 h-3 w-64 max-w-full" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white/5 p-4">
              <Bar className="h-3 w-24" />
              <Bar className="mt-3 h-6 w-16" />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-white/10 bg-[#151515] p-5">
        <Bar className="h-5 w-44" />
        <div className="mt-4 space-y-3">
          <Bar className="h-4 w-48" />
          <Bar className="h-4 w-40" />
          <Bar className="h-4 w-72 max-w-full" />
          <Bar className="h-4 w-56 max-w-full" />
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-white/10 bg-[#151515] p-5">
        <Bar className="h-5 w-32" />
        <div className="mt-4 space-y-3">
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-3/4" />
        </div>
      </section>
    </div>
  );
}