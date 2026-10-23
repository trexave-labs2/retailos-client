"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { HelpMenu, TourPageButton } from "@/components/tour/HelpMenu";
import { useOptionalTour } from "@/components/tour/TourProvider";
import type { User } from "@/lib/types";
import { ThemeToggle } from "@/components/theme/ThemeProvider";
import NotificationBell from "@/components/notifications/NotificationBell";

type DashboardShellProps = {
  children: ReactNode;
  title: string;
  role?: string;
  user?: User | null;
};

type NavItem = {
  label: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Sales", href: "/sales" },
  { label: "Products & Inventory", href: "/inventory" },
  { label: "Transactions", href: "/transactions" },
  { label: "Audit history", href: "/audit" },
  { label: "Customers", href: "/customers" },
  { label: "Who Owes Me", href: "/debts" },
  { label: "Alerts", href: "/alerts" },
  { label: "Feedback", href: "/feedback" },
  { label: "Plans & subscription", href: "/plans" },
  { label: "Settings", href: "/settings" },
];

export default function DashboardShell({ children, title }: DashboardShellProps) {
  const { user } = useAuth();
  const tour = useOptionalTour();
  const pathname = usePathname();
  const storeName = user?.store_name ?? "Store";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // The tour points at the menu on phones, where it is a drawer: open it for that step.
  const tourNeedsMenu = tour?.state.status === "running" && tour.step?.target === "nav";
  const drawerOpen = menuOpen || tourNeedsMenu;

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-lg focus:bg-orange-500 focus:px-4 focus:py-2 focus:font-semibold focus:text-black"
      >
        Skip to main content
      </a>

      {drawerOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      <nav
        id="primary-nav"
        aria-label="Main"
        data-tour="nav"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-white/10 bg-[#121212] p-4 transition-transform duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:visible ${
          drawerOpen ? "translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <div className="mb-6">
          <p className="mb-2 text-xs uppercase tracking-widest text-white/65">TX RetailOS</p>
          <p className="truncate text-sm font-medium" title={storeName}>{storeName}</p>
        </div>
        <ul className="flex-1 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`block rounded-md px-3 py-2.5 text-sm transition-colors ${
                    active ? "bg-orange-500 font-semibold text-black" : "text-white/75 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-w-0 items-center gap-2 border-b border-white/10 bg-[#0b0b0b]/95 px-3 py-3 backdrop-blur sm:gap-3 sm:px-8">
          <button
            ref={menuButtonRef}
            type="button"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="primary-nav"
            onClick={() => setMenuOpen((value) => !value)}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm lg:hidden"
          >
            <span aria-hidden="true">☰</span>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{title}</h1>
          <NotificationBell />
          <ThemeToggle compact />
          <TourPageButton />
          <HelpMenu />
        </header>
        <main id="main-content" tabIndex={-1} className="px-4 py-6 outline-none sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
