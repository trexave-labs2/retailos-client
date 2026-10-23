"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import Link from "next/link";
import { useTour } from "@/components/tour/TourProvider";
import { chapterForPath, getChapter } from "@/lib/tour-core.mjs";

/** "Learn the app" menu: replay, resume, or pick a single feature walkthrough. */
export function HelpMenu() {
  const tour = useTour();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pathname = usePathname();
  const pageChapter = chapterForPath(pathname);
  const resumeChapter = tour.resumePoint ? getChapter(tour.resumePoint.chapterId) : null;
  const running = tour.state.status !== "idle";

  return (
    <div ref={rootRef} className="relative" data-tour="help-menu">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
      >
        <span aria-hidden="true">?</span>
        <span className="hidden sm:inline">Learn the app</span>
        <span className="sm:hidden">Help</span>
      </button>
      {open && (
        <div
          id={menuId}
          role="region"
          aria-label="Learn the app"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#171717] p-3 shadow-2xl"
        >
          {resumeChapter && tour.resumePoint && !running && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                tour.resumeSaved();
              }}
              className="mb-2 w-full rounded-xl bg-orange-500 px-3 py-2 text-left text-sm font-semibold text-black"
            >
              Resume “{resumeChapter.title}” (step {tour.resumePoint.stepIndex + 1} of {resumeChapter.steps.length})
            </button>
          )}
          {pageChapter && !running && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                tour.startChapter(pageChapter.id);
              }}
              className="mb-2 w-full rounded-xl border border-orange-500/40 px-3 py-2 text-left text-sm text-orange-200 hover:bg-orange-500/10"
            >
              Tour this page: {pageChapter.title}
            </button>
          )}
          <p className="px-2 pb-1 pt-1 text-xs uppercase tracking-wide text-white/65">Short tours</p>
          <ul className="space-y-1">
            {tour.chapters.map((chapter) => {
              const done = tour.progress.completed[chapter.id] === true;
              return (
                <li key={chapter.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      tour.startChapter(chapter.id);
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10"
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-medium">
                      {chapter.title}
                      {done && <span className="text-xs text-green-300">✓ Done · Replay</span>}
                    </span>
                    <span className="block text-xs text-white/65">{chapter.summary}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-2 pt-3 text-xs leading-5 text-white/65">Tours guide you through the interface. They never submit forms or perform actions for you.</p>
          <Link href="/#faq" onClick={() => setOpen(false)} className="mt-1 block rounded-xl px-3 py-2 text-left text-xs font-medium text-orange-300 hover:bg-white/10">Read FAQs and support options</Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              tour.openWelcome();
            }}
            className="mt-2 w-full rounded-xl px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10"
          >
            Show the welcome screen again
          </button>
        </div>
      )}
    </div>
  );
}

/** Contextual entry point: shown only where a walkthrough exists for the current page. */
export function TourPageButton() {
  const tour = useTour();
  const pathname = usePathname();
  const chapter = chapterForPath(pathname);
  if (!chapter || tour.state.status === "running") return null;
  return (
    <button
      type="button"
      onClick={() => tour.startChapter(chapter.id)}
      className="hidden rounded-lg px-3 py-2 text-sm text-orange-300 underline-offset-4 hover:underline sm:block"
    >
      Tour this page
    </button>
  );
}
