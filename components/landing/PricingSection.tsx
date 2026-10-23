"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

type PlanCatalogResponse = { plans: Plan[] };

const LIMIT_LABELS: Record<string, string> = {
  products: "Products",
  customers: "Customers",
  sales_per_month: "Sales per month",
  staff_accounts: "Additional staff accounts",
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

function money(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function limitValue(value: number | null | undefined) {
  return value === null || value === undefined ? "Unlimited" : value.toLocaleString("en-NG");
}

function billingLabel(interval: BillingInterval) {
  if (interval === "quarter") return "quarter";
  if (interval === "year") return "year";
  return "month";
}

export default function LandingPricingSection() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    api<PlanCatalogResponse>("/subscriptions/plans")
      .then((catalog) => {
        if (active) setPlans(Array.isArray(catalog.plans) ? catalog.plans : []);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof ApiError
            ? reason.message
            : "Pricing is temporarily unavailable. Please try again later.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const freePlan = plans.find((plan) => plan.id === "free");
  const proPlan = plans.find((plan) => plan.id === "pro");
  const proPrice = proPlan?.billing_options.find((option) => option.interval === interval)
    ?? proPlan?.price;

  return (
    <section id="pricing" className="border-y border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">Clear plans, clear limits</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Start free. Upgrade when your shop needs more.</h2>
          <p className="mt-4 leading-7 text-white/60">
            Prices, usage limits, and feature availability are loaded from RetailOS&apos;s published plan catalog.
          </p>
        </div>

        {loading && (
          <p role="status" className="mt-8 rounded-xl border border-white/10 bg-[#151515] p-5 text-center text-sm text-white/60">
            Loading current plans and prices…
          </p>
        )}
        {!loading && error && (
          <div role="alert" className="mt-8 rounded-xl border border-amber-400/25 bg-amber-400/5 p-5 text-center">
            <p className="text-sm text-white/75">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError("");
                api<PlanCatalogResponse>("/subscriptions/plans", { refresh: true })
                  .then((catalog) => setPlans(Array.isArray(catalog.plans) ? catalog.plans : []))
                  .catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : "Pricing is temporarily unavailable. Please try again later."))
                  .finally(() => setLoading(false));
              }}
              className="mt-3 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/5"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && freePlan && proPlan && (
          <>
            <div className="mt-10 flex flex-col items-center justify-between gap-4 sm:flex-row">
              <p className="text-sm text-white/50">Compare the included tools and usage limits.</p>
              <label className="text-sm text-white/70">
                Pro billing
                <select
                  value={interval}
                  onChange={(event) => setInterval(event.target.value as BillingInterval)}
                  className="ml-3 rounded-lg border border-white/15 bg-[#151515] px-3 py-2.5 text-white"
                >
                  {proPlan.billing_options.map((option) => (
                    <option key={option.interval} value={option.interval}>
                      {option.interval === "month" ? "Monthly" : option.interval === "quarter" ? "Quarterly" : "Yearly"} · {money(option.amount, option.currency)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {[freePlan, proPlan].map((plan) => {
                const isPro = plan.id === "pro";
                const price = isPro ? proPrice : plan.price;
                return (
                  <article key={plan.id} className={`rounded-2xl border ${isPro ? "border-orange-500/50 bg-orange-500/[0.06]" : "border-white/10 bg-[#111111]"} p-6 sm:p-8`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold">{plan.name}</h3>
                        <p className="mt-2 text-sm text-white/55">
                          {isPro ? "For growing shops that need more control and reporting." : "For shops getting their records organized."}
                        </p>
                      </div>
                      {isPro && <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-300">Pro</span>}
                    </div>
                    <p className="mt-6 text-4xl font-semibold tracking-tight">
                      {money(price?.amount ?? 0, price?.currency ?? "NGN")}
                      <span className="ml-2 text-sm font-normal text-white/45">/{billingLabel(isPro ? interval : "month")}</span>
                    </p>
                    {isPro && (
                      <p className="mt-2 text-xs leading-5 text-white/45">
                        Quarterly and yearly options are available. Paid billing is not yet configured, so selecting Pro does not activate a paid subscription.
                      </p>
                    )}

                    <div className="mt-6 border-t border-white/10 pt-5">
                      <h4 className="text-sm font-semibold">Usage limits</h4>
                      <dl className="mt-3 space-y-3">
                        {Object.entries(LIMIT_LABELS).map(([key, label]) => (
                          <div key={key} className="flex items-center justify-between gap-4 text-sm">
                            <dt className="text-white/60">{label}</dt>
                            <dd className="font-medium">{limitValue(plan.limits[key])}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    <div className="mt-6 border-t border-white/10 pt-5">
                      <h4 className="text-sm font-semibold">Included features</h4>
                      <ul className="mt-3 space-y-3">
                        {FEATURE_ROWS.map((feature) => {
                          const included = Boolean(plan[feature.group]?.[feature.key]);
                          return (
                            <li key={feature.key} className="flex items-start gap-3 text-sm">
                              <span aria-hidden="true" className={included ? "text-orange-400" : "text-white/25"}>{included ? "✓" : "—"}</span>
                              <span className={included ? "text-white/80" : "text-white/40"}>{feature.label}</span>
                              <span className="sr-only">{included ? "Included" : "Not included"}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <p className="mt-5 text-sm text-white/60">
                      Support: {plan.support === "priority_whatsapp" ? "Priority WhatsApp" : "Standard"}
                    </p>
                    {plan.trial?.pro_trial_available_once && (
                      <p className="mt-2 text-xs text-white/45">{plan.trial.duration_days}-day Pro trial available once per store.</p>
                    )}
                    {plan.fair_use && <p className="mt-2 text-xs leading-5 text-white/45">{plan.fair_use}</p>}

                    <Link
                      href="/register"
                      className={`mt-7 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${isPro ? "bg-orange-500 text-black hover:bg-orange-400" : "border border-white/15 text-white hover:bg-white/5"}`}
                    >
                      {isPro ? "Get started with Pro" : "Start for free"}
                    </Link>
                  </article>
                );
              })}
            </div>
            <p className="mt-5 text-xs leading-5 text-white/40">
              Unlimited usage is subject to fair-use review at exceptionally high volumes. Plan features reflect the current published catalog; availability may depend on the current release.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
