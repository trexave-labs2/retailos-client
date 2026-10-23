import Link from "next/link";
import BrandMark from "@/components/brand/BrandMark";
import LandingPricingSection from "@/components/landing/PricingSection";

const features = [
  {
    number: "01",
    title: "Know your stock",
    description: "Keep product quantities and stock adjustments in one place, so you can make decisions using records instead of guesswork.",
  },
  {
    number: "02",
    title: "Record every sale",
    description: "Use a focused point-of-sale workflow to record transactions and keep your sales history organized.",
  },
  {
    number: "03",
    title: "See the business clearly",
    description: "Review your dashboard, customers, and low-stock alerts without juggling notebooks and scattered spreadsheets.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0b0b0b] text-white">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight" aria-label="TX RetailOS home">
          <BrandMark size={40} />
          TX <span className="text-orange-500">RetailOS</span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-3">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-white/75 transition hover:text-white">
            Sign in
          </Link>
          <Link href="/register" className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400">
            Create account
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-7xl items-center gap-12 px-6 pb-20 pt-16 sm:px-10 md:grid-cols-[1.15fr_0.85fr] md:pb-28 md:pt-24">
        <div>
          <p className="mb-6 inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
            Retail operations, made clearer
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Run your shop with <span className="text-orange-500">less guesswork.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
            TX RetailOS helps provision shops and growing retailers organize products, track stock, record sales, and keep an eye on daily operations from one workspace.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-orange-400">
              Get started <span aria-hidden="true" className="ml-2">→</span>
            </Link>
            <Link href="/demo" className="inline-flex items-center justify-center rounded-xl border border-white/15 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/5">
              Try the demo
            </Link>
          </div>
          <p className="mt-4 text-xs leading-5 text-white/45">
            Try the demo shop without creating an account, or register to set up your real store.
          </p>
        </div>

        <div aria-label="RetailOS operations preview" className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-8 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="relative rounded-2xl border border-white/10 bg-[#141414] p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs text-white/45">YOUR STORE</p>
                <p className="mt-1 text-sm font-semibold">Operations overview</p>
              </div>
              <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-xs text-orange-300">RetailOS</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs text-white/50">Inventory</p>
                <p className="mt-2 text-lg font-semibold">In one place</p>
                <p className="mt-1 text-xs text-white/40">Products and stock</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs text-white/50">Sales</p>
                <p className="mt-2 text-lg font-semibold">Recorded</p>
                <p className="mt-1 text-xs text-white/40">Transactions and history</p>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Daily essentials</p>
                <span className="text-xs text-white/40">Store tools</span>
              </div>
              <div className="mt-4 space-y-3">
                {["Product management", "Point of sale", "Customer records", "Low-stock alerts"].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-white/70">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/15 text-xs text-orange-300" aria-hidden="true">✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-white/35">Illustrative product preview. Available features depend on the current release.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 md:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">Built for everyday retail</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">The essentials, without the clutter.</h2>
            <p className="mt-4 leading-7 text-white/60">Keep core shop operations easier to follow, from the products on your shelves to the sales you make.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.number} className="rounded-2xl border border-white/10 bg-[#111111] p-6">
                <p className="text-sm font-semibold text-orange-400">{feature.number}</p>
                <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/60">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="product-preview-title" className="border-y border-white/10 bg-[#101010]">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 md:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">Product preview</p>
            <h2 id="product-preview-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">The daily essentials, at a glance.</h2>
            <p className="mt-4 leading-7 text-white/65">Explore the demo to see the live interface. These preview panels illustrate key workflows and are not screenshots of live store data.</p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#171717]">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3"><span className="h-2 w-2 rounded-full bg-orange-500" /><span className="text-sm font-medium">Store overview</span></div>
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-white/60">Today’s sales</p><p className="mt-2 text-lg font-semibold">Sales summary</p></div>
                  <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-white/60">Stock status</p><p className="mt-2 text-lg font-semibold">Stock overview</p></div>
                </div>
                <div className="space-y-2 rounded-xl bg-black/20 p-3"><div className="h-2 w-2/3 rounded bg-orange-500/70" /><div className="h-2 w-full rounded bg-white/10" /><div className="h-2 w-4/5 rounded bg-white/10" /></div>
              </div>
            </article>
            <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#171717]">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3"><span className="h-2 w-2 rounded-full bg-orange-500" /><span className="text-sm font-medium">Point of sale</span></div>
              <div className="space-y-3 p-4">
                <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-white/60">Sale items</p><div className="mt-3 flex justify-between text-sm"><span>Selected product</span><span>Qty</span></div><div className="mt-3 h-px bg-white/10" /><div className="mt-3 flex justify-between text-sm text-white/60"><span>Subtotal</span><span>Calculated total</span></div></div>
                <div className="rounded-lg bg-orange-500 px-3 py-2 text-center text-sm font-semibold text-black">Review sale</div>
              </div>
            </article>
            <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#171717]">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3"><span className="h-2 w-2 rounded-full bg-orange-500" /><span className="text-sm font-medium">Stock and alerts</span></div>
              <div className="space-y-3 p-4">
                {["Product records", "Stock adjustments", "Low-stock alerts"].map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 p-3 text-sm"><span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/15 text-orange-300">✓</span>{item}</div>)}
              </div>
            </article>
          </div>
          <div className="mt-7"><Link href="/demo" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold hover:bg-white/5">Explore the demo <span aria-hidden="true" className="ml-2">→</span></Link></div>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-7xl px-6 py-16 sm:px-10 md:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">Questions, answered</p>
          <h2 id="faq-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Frequently asked questions</h2>
        </div>
        <div className="mt-8 max-w-4xl divide-y divide-white/10 border-y border-white/10">
          <details className="py-5"><summary className="cursor-pointer py-2 font-medium">What is TX RetailOS?</summary><p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">A retail operations workspace for managing products, tracking stock, recording sales, keeping customer records, and reviewing low-stock alerts.</p></details>
          <details className="py-5"><summary className="cursor-pointer py-2 font-medium">Can I try it before creating an account?</summary><p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">Yes. Open the demo shop to explore a sample workflow without setting up your own store.</p></details>
          <details className="py-5"><summary className="cursor-pointer py-2 font-medium">Does RetailOS work offline?</summary><p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">No. RetailOS needs an internet connection to load and save store data. If your connection drops, reconnect before continuing and check whether any unfinished action needs to be repeated.</p></details>
          <details className="py-5"><summary className="cursor-pointer py-2 font-medium">Will the guided tour change my store data?</summary><p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">The tour itself does not click controls or submit forms for you. If you choose to use a real store action while following a step, that action may change your data.</p></details>
          <details className="py-5"><summary className="cursor-pointer py-2 font-medium">Where can I get help or report a problem?</summary><p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">Review the demo and FAQs first. You can report a bug or request help through the project’s public issue tracker.</p><a className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-orange-300 underline underline-offset-4" href="https://github.com/ENJ0Y-Labs/retailos-client/issues" target="_blank" rel="noreferrer">RetailOS support and issue tracker <span aria-hidden="true" className="ml-2">↗</span></a></details>
        </div>
      </section>

      <LandingPricingSection />

      <footer className="border-t border-white/10 px-6 py-6 sm:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} TX RetailOS · Built for African businesses.</p>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-white/70">Sign in</Link>
            <Link href="/register" className="hover:text-white/70">Create account</Link>
            <Link href="/privacy" className="hover:text-white/70">Privacy policy</Link>
            <a href="#faq" className="hover:text-white/70">FAQs</a>
            <a href="https://github.com/ENJ0Y-Labs/retailos-client/issues" target="_blank" rel="noreferrer" className="hover:text-white/70">Support</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
