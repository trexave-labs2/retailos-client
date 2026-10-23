"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import type { Alert } from "@/lib/types";

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
}

export default function NotificationBell() {
  const { user } = useAuth();
  const storeId = user?.store_id ?? null;
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async (background = false) => {
    if (!storeId) {
      setAlerts([]);
      setError("No store is associated with this account.");
      setLoading(false);
      return;
    }

    if (background) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ store_id: String(storeId) });
      const result = await api<{ alerts?: Alert[] }>(
        `/alerts?${params.toString()}`,
        { refresh: true },
      );
      setAlerts(Array.isArray(result.alerts) ? result.alerts : []);
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => {
    // Defer the initial request until after the effect body to avoid a synchronous
    // state update during effect execution under React's set-state-in-effect rule.
    void Promise.resolve().then(() => loadAlerts());

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadAlerts(true);
    };
    const refreshOnFocus = () => void loadAlerts(true);
    const refreshAfterInventoryChange = () => void loadAlerts(true);

    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("retailos:inventory-changed", refreshAfterInventoryChange);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("retailos:inventory-changed", refreshAfterInventoryChange);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadAlerts]);

  const openCount = alerts.length;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={openCount > 0 ? `Notifications, ${openCount} open alerts` : "Notifications"}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) void loadAlerts(true);
        }}
        className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/75 transition hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {openCount > 0 && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#0b0b0b] bg-orange-500 px-1 text-[10px] font-bold leading-none text-black">
            {openCount > 99 ? "99+" : openCount}
          </span>
        )}
      </button>

      {open && (
        <section
          id="notification-panel"
          aria-label="Notifications"
          className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#151515] shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="font-semibold">Notifications</h2>
              <p className="mt-0.5 text-xs text-white/45">{openCount} open alert{openCount === 1 ? "" : "s"}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadAlerts(true)}
              disabled={refreshing}
              className="rounded-lg px-2 py-1.5 text-xs text-orange-300 hover:bg-white/5 disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {loading ? (
            <p role="status" className="p-5 text-sm text-white/60">Loading notifications…</p>
          ) : error ? (
            <div className="p-4">
              <p role="alert" className="text-sm text-red-300">{error}</p>
              <button type="button" onClick={() => void loadAlerts()} className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15">Try again</button>
            </div>
          ) : alerts.length ? (
            <ul className="max-h-96 overflow-y-auto divide-y divide-white/5">
              {alerts.slice(0, 10).map((alert) => (
                <li key={alert.id}>
                  <Link
                    href="/alerts"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 transition hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-orange-400"
                  >
                    <span className="flex items-start gap-2">
                      <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-orange-300">{alert.type.replaceAll("_", " ")}</span>
                        <span className="mt-1 block break-words text-sm text-white/90">{alert.message}</span>
                        <span className="mt-1 block text-xs text-white/40">{formatTimestamp(alert.created_at)}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-white/55">You have no open alerts.</p>
          )}

          <div className="border-t border-white/10 p-3">
            <Link href="/alerts" onClick={() => setOpen(false)} className="block rounded-lg bg-white/[0.04] px-3 py-2 text-center text-sm font-medium text-orange-300 hover:bg-white/[0.08]">
              View all alerts
            </Link>
          </div>
          <p className="px-4 pb-3 text-[11px] leading-4 text-white/35">The server currently provides open alerts, not read/unread status. The badge counts open alerts.</p>
        </section>
      )}
    </div>
  );
}
