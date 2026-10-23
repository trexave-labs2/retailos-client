"use client";

import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

import { useTour } from "@/components/tour/TourProvider";

export default function WelcomeDialog() {
  const { welcomeOpen } = useTour();
  if (!welcomeOpen) return null;
  return <WelcomeCard />;
}

function WelcomeCard() {
  const { startFromWelcome, dismissWelcome } = useTour();
  const ref = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    startRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      dismissWelcome();
      return;
    }
    if (event.key !== "Tab" || !ref.current) return;
    const focusable = ref.current.querySelectorAll<HTMLElement>("button, [href]");
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        aria-describedby="welcome-body"
        onKeyDown={onKeyDown}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#151515] p-6 shadow-2xl"
      >
        <p className="text-xs font-medium uppercase tracking-widest text-orange-300">Welcome to TX RetailOS</p>
        <h2 id="welcome-title" className="mt-2 text-xl font-semibold">
          Run your shop from one place
        </h2>
        <div id="welcome-body" className="mt-3 space-y-3 text-sm text-white/80">
          <p>Add your products, record sales, keep track of stock and see who owes you.</p>
          <p>Take a quick tour (about a minute) and we&apos;ll point out the parts you&apos;ll use every day. The tour never clicks controls or submits forms for you. If you choose to use a real store action while following a step, that action may change your data.</p>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={dismissWelcome} className="rounded-xl bg-white/10 px-4 py-3 text-sm">
            Skip for now
          </button>
          <button ref={startRef} type="button" onClick={startFromWelcome} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black">
            Start the tour
          </button>
        </div>
        <p className="mt-4 text-xs text-white/65">Changed your mind? Open “Learn the app” at the top of any page to start later.</p>
      </div>
    </div>
  );
}
