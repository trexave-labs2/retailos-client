"use client";

import { useCallback, useEffect, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { api, ApiError } from "@/lib/api";

type BillingInterval = "month" | "quarter" | "year";

type Plan = {
  id: string;
  name: string;
  price: { amount: number; currency: string; interval: string };
  billing_options: Array<{ interval: BillingInterval; amount: number; currency: string }>;
  limits: Record<string, number | null>;
  features: Record<string, boolean>;
  reporting: Record<string, boolean>;
  support: string;
  trial?: { pro_trial_available_once: boolean; duration_days: number };
  fair_use?: string;
};

type Usage = Record<string, { current: number; limit: number | null; warning_at: number | null; warning: boolean }>;

type Subscription = {
  store_id: number;
  plan: Plan;
  subscription_status: string;
  current_period_end: string | null;
  trial_used: boolean;
  usage: Usage;
  pending_change: null | {
    id: number;
    target_plan: string;
    status: string;
    created_at: string;
    payment_required: boolean;
  };
};

type PlanCatalogResponse = { plans: Plan[] };
type SubscriptionResponse = { subscription: Subscription };
type PlanChangeResponse = {
  change?: { id: number; target_plan: string; status: string; payment_required: boolean; activation: string };
  billing?: { status: string; message: string };
};

const FEATURE_ROWS: Array<{ label: string; group: "features" | "reporting"; key: string }> = [
  { label: "Inventory management", group: "features", key: "inventory" },
  { label: "Sales and checkout", group: "features", key: "sales_and_checkout" },
  { label: "Dashboard", group: "features", key: "dashboard" },
  { label: "Advanced reporting", group: "features", key: "advanced_reporting" },
  { label: "Data export", group: "features", key: "data_export" },
  { label: "Today's and monthly sales", group: "reporting", key: "today_and_month_sales" },
  { label: "Current stock levels", group: "reporting", key: "current_stock_levels" },
  { label: "Profit per product", group: "reporting", key: "profit_per_product" },
  { label: "Top and slow sellers", group: "reporting", key: "top_and_slow_sellers" },
  { label: "Custom date ranges", group: "reporting", key: "custom_date_ranges" },
  { label: "Low-stock reporting", group: "reporting", key: "low_stock_alerts" },
  { label: "Staff sales performance", group: "reporting", key: "staff_sales_performance" },
];

const LIMIT_LABELS: Record<string, string> = {
  products: "Products",
  customers: "Customers",
  sales_per_month: "Sales per month",
  staff_accounts: "Staff accounts",
};

function messageFor(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function money(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function readableStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function PlansPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [action, setAction] = useState<"trial" | "change" | "cancel" | null>(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!user?.store_id) {
      setPlans([]);
      setSubscription(null);
      setLoadError("This account does not have a store assigned. Subscription details are unavailable.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");
    try {
      const [catalog, current] = await Promise.all([
        api<PlanCatalogResponse>("/subscriptions/plans", { refresh: true }),
        api<SubscriptionResponse>(`/subscriptions?store_id=${user.store_id}`, { refresh: true }),
      ]);
      setPlans(Array.isArray(catalog.plans) ? catalog.plans : []);
      setSubscription(current.subscription);
    } catch (error) {
      setLoadError(messageFor(error, "RetailOS could not retrieve plan information. Check your connection and retry."));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) await load();
    })();
    return () => { cancelled = true; };
  }, [load]);

  async function requestChange(plan: Plan) {
    if (!user?.store_id || action) return;
    setAction("change");
    setActionError("");
    setNotice("");
    try {
      const result = await api<PlanChangeResponse>("/subscriptions/change", {
        method: "POST",
        json: {
          store_id: user.store_id,
          plan: plan.id,
          billing_interval: plan.id === "pro" ? billingInterval : "month",
        },
      });
      await load();
      setNotice(
        result.change?.activation === "not_activated"
          ? `Your request to change to ${plan.name} is pending. The server has not activated this plan. Paid billing is not configured yet.`
          : "The plan-change request was recorded. The current plan remains authoritative until the server confirms a change.",
      );
    } catch (error) {
      setActionError(messageFor(error, "The plan-change request failed. Your current plan has not been changed by this screen."));
    } finally {
      setAction(null);
    }
  }

  async function startTrial() {
    if (!user?.store_id || action) return;
    setAction("trial");
    setActionError("");
    setNotice("");
    try {
      const result = await api<{ subscription: Subscription; trial: { duration_days: number; ends_at: string } }>(
        "/subscriptions/trial",
        { method: "POST", json: { store_id: user.store_id } },
      );
      await load();
      setNotice(`The server confirmed your ${result.trial.duration_days}-day Pro trial. Your subscription status is being refreshed from the server.`);
    } catch (error) {
      setActionError(messageFor(error, "RetailOS could not start the trial. Your current plan remains unchanged."));
    } finally {
      setAction(null);
    }
  }

  async function cancelPending() {
    if (!user?.store_id || !subscription?.pending_change || action) return;
    setAction("cancel");
    setActionError("");
    setNotice("");
    try {
      await api("/subscriptions/change/cancel", {
        method: "POST",
        json: { store_id: user.store_id, change_id: subscription.pending_change.id },
      });
      await load();
      setNotice("The server accepted the cancellation request. The current plan is shown separately from pending changes.");
    } catch (error) {
      setActionError(messageFor(error, "Could not cancel the pending plan request. Refresh and try again."));
    } finally {
      setAction(null);
    }
  }

  const currentPlan = subscription?.plan;
  const proPlan = plans.find((plan) => plan.id === "pro");
  const trialAvailable = Boolean(
    proPlan?.trial?.pro_trial_available_once &&
    !subscription?.trial_used &&
    currentPlan?.id !== "pro" &&
    !subscription?.pending_change
  );

  return (
    <DashboardShell title="Plans & subscription">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-white/10 bg-[#151515] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">Your subscription</p>
              <h2 className="mt-2 text-2xl font-semibold">{currentPlan?.name ?? "Current plan"}</h2>
              <p className="mt-2 text-sm text-white/60">
                {subscription
                  ? `Status: ${readableStatus(subscription.subscription_status)}`
                  : "The current plan will appear when subscription details load."}
              </p>
              {subscription?.current_period_end && (
                <p className="mt-1 text-sm text-white/50">
                  {subscription.subscription_status === "trial" ? "Trial ends" : "Current period ends"}:{" "}
                  <time dateTime={subscription.current_period_end}>
                    {new Date(subscription.current_period_end).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || Boolean(action)}
              className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh plan status"}
            </button>
          </div>

          {subscription && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(subscription.usage).map(([key, usage]) => (
                <div key={key} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm text-white/60">{LIMIT_LABELS[key] ?? readableStatus(key)}</p>
                  <p className="mt-2 text-lg font-semibold">
                    {usage.current.toLocaleString("en-NG")} / {usage.limit === null ? "Unlimited" : usage.limit.toLocaleString("en-NG")}
                  </p>
                  {usage.warning && (
                    <p className="mt-1 text-xs text-orange-300">
                      Approaching the current plan limit{usage.warning_at ? ` (${usage.warning_at.toLocaleString("en-NG")} triggers a warning)` : ""}.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {subscription?.pending_change && (
            <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4" role="status">
              <p className="font-semibold">Plan change pending</p>
              <p className="mt-1 text-sm text-white/70">
                Requested plan: {plans.find((plan) => plan.id === subscription.pending_change?.target_plan)?.name ?? subscription.pending_change.target_plan}.
                {" "}This request has not activated the target plan.
              </p>
              {subscription.pending_change.payment_required && (
                <p className="mt-1 text-sm text-white/60">Paid billing is not configured. Do not treat this request as a completed purchase.</p>
              )}
              <button
                type="button"
                onClick={() => void cancelPending()}
                disabled={Boolean(action)}
                className="mt-3 rounded-lg border border-amber-300/40 px-3 py-2 text-sm font-semibold hover:bg-amber-300/10 disabled:opacity-50"
              >
                {action === "cancel" ? "Cancelling request…" : "Cancel pending request"}
              </button>
            </div>
          )}
        </section>

        {notice && <p role="status" className="rounded-xl border border-green-500/25 bg-green-500/10 p-4 text-sm text-green-200">{notice}</p>}
        {actionError && <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">{actionError}</p>}

        {loading && (
          <div role="status" aria-live="polite" className="rounded-xl border border-white/10 bg-[#151515] p-6 text-sm text-white/60">
            Loading plan catalog and current subscription…
          </div>
        )}
        {!loading && loadError && (
          <section className="rounded-xl border border-red-500/25 bg-red-500/10 p-5" role="alert">
            <h2 className="font-semibold">Plan information unavailable</h2>
            <p className="mt-2 text-sm">{loadError}</p>
            <button type="button" onClick={() => void load()} className="mt-4 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black">
              Retry loading plans
            </button>
          </section>
        )}

        {!loading && !loadError && plans.length > 0 && (
          <>
            <section>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Available plans</h2>
                  <p className="mt-1 text-sm text-white/55">Names, prices, limits, and entitlements come from the server&apos;s plan catalog.</p>
                </div>
                {proPlan && (
                  <label className="text-sm text-white/70">
                    Pro billing period
                    <select
                      value={billingInterval}
                      onChange={(event) => setBillingInterval(event.target.value as BillingInterval)}
                      disabled={Boolean(action) || currentPlan?.id === "pro" || Boolean(subscription?.pending_change)}
                      className="mt-1 block w-full rounded-lg border border-white/15 bg-[#151515] px-3 py-2.5 text-white sm:min-w-48"
                    >
                      {proPlan.billing_options.map((option) => (
                        <option key={option.interval} value={option.interval}>
                          {option.interval === "month" ? "Monthly" : option.interval === "quarter" ? "Quarterly" : "Yearly"} · {money(option.amount, option.currency)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {plans.map((plan) => {
                  const isCurrent = currentPlan?.id === plan.id && !(plan.id === "pro" && subscription?.subscription_status === "trial");
                  const selectedPrice = plan.billing_options.find((option) => option.interval === (plan.id === "pro" ? billingInterval : "month")) ?? plan.price;
                  return (
                    <article key={plan.id} className={`rounded-2xl border p-5 sm:p-6 ${isCurrent ? "border-orange-500/70 bg-orange-500/5" : "border-white/10 bg-[#151515]"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold">{plan.name}</h3>
                          <p className="mt-2 text-3xl font-bold">{money(selectedPrice.amount, selectedPrice.currency)}</p>
                          <p className="mt-1 text-sm text-white/50">
                            {plan.id === "free" ? "No subscription fee" : selectedPrice.interval === "month" ? "per month" : selectedPrice.interval === "quarter" ? "per quarter" : "per year"}
                          </p>
                        </div>
                        {isCurrent && <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-300">Current plan</span>}
                      </div>

                      <dl className="mt-5 space-y-2 text-sm">
                        {Object.entries(plan.limits).map(([key, limit]) => (
                          <div key={key} className="flex justify-between gap-4 border-b border-white/5 pb-2">
                            <dt className="text-white/60">{LIMIT_LABELS[key] ?? readableStatus(key)}</dt>
                            <dd className="text-right font-medium">{limit === null ? "Unlimited" : limit.toLocaleString("en-NG")}</dd>
                          </div>
                        ))}
                        <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                          <dt className="text-white/60">Support</dt>
                          <dd className="text-right font-medium">{readableStatus(plan.support)}</dd>
                        </div>
                      </dl>

                      {plan.trial?.pro_trial_available_once && (
                        <p className="mt-4 text-sm text-white/60">
                          {plan.trial.duration_days}-day Pro trial available once per store, subject to server eligibility.
                        </p>
                      )}
                      {plan.fair_use && <p className="mt-3 text-xs text-white/45">{plan.fair_use}</p>}

                      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => void requestChange(plan)}
                          disabled={Boolean(action) || isCurrent || Boolean(subscription?.pending_change)}
                          className="flex-1 rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {action === "change" && !isCurrent ? "Submitting request…" : isCurrent ? "Current plan" : plan.id === "pro" ? "Request Pro upgrade" : "Request Free plan"}
                        </button>
                        {plan.id === "free" && trialAvailable && (
                          <button
                            type="button"
                            onClick={() => void startTrial()}
                            disabled={Boolean(action) || Boolean(subscription?.pending_change)}
                            className="flex-1 rounded-lg border border-orange-500/50 px-4 py-3 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {action === "trial" ? "Starting trial…" : `Start ${proPlan?.trial?.duration_days ?? 14}-day Pro trial`}
                          </button>
                        )}
                      </div>
                      {plan.id === "pro" && (
                        <p className="mt-3 text-xs leading-5 text-white/45">
                          Paid upgrades remain pending until billing is configured and the server confirms payment. Requesting a plan is not a purchase.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#151515] p-5 sm:p-6">
              <h2 className="text-xl font-semibold">Feature comparison</h2>
              <p className="mt-1 text-sm text-white/55">This table reflects the feature metadata currently published by the server.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/15">
                      <th scope="col" className="px-3 py-3 font-semibold">Feature</th>
                      {plans.map((plan) => <th scope="col" key={plan.id} className="px-3 py-3 font-semibold">{plan.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {FEATURE_ROWS.map((feature) => (
                      <tr key={feature.key} className="border-b border-white/5">
                        <th scope="row" className="px-3 py-3 font-normal text-white/70">{feature.label}</th>
                        {plans.map((plan) => {
                          const enabled = Boolean(plan[feature.group]?.[feature.key]);
                          return <td key={plan.id} className="px-3 py-3">{enabled ? <span className="text-green-300">Included</span> : <span className="text-white/45">Not included</span>}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
