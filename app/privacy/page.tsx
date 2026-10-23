"use client";

import Link from "next/link";

const sections = [
  {
    title: "What information RetailOS uses",
    body: [
      "RetailOS uses information needed to run your store account. This can include your name or username, email address, store details, products and stock levels, sales and payment records, refunds, customer names and contact details, and low-stock alerts.",
      "If you send feedback, we also receive the message and category you choose. Your name and email address are optional on the feedback form.",
    ],
  },
  {
    title: "How we use it",
    body: [
      "We use this information to sign you in, manage your store's products and stock, record sales and payments, keep customer purchase history, show alerts, and prepare dashboard summaries and audit history.",
      "RetailOS checks that a signed-in account is allowed to access the requested store's protected records. Information you enter for one store should not be treated as information for another store.",
    ],
  },
  {
    title: "Sign-in and cookies",
    body: [
      "RetailOS uses a sign-in session. After you log in, your browser keeps a session cookie so the server can recognize your signed-in session. The production setup is designed to use an HttpOnly cookie over HTTPS.",
      "The app also saves progress through the optional welcome tour in your browser's local storage. That progress contains tour chapter and step information, is kept separately for each account in that browser, and is not synced to your other devices.",
      "Logging out ends your session. Do not share your account or leave a signed-in session open on a shared computer.",
    ],
  },
  {
    title: "Where records are stored",
    body: [
      "RetailOS's server stores store and business records in its database. These records support features such as inventory, sales, payments, refunds, customer history, alerts, and audit history.",
      "The server documentation does not specify a fixed retention period for every record. It also does not document a self-service tool to export or delete an entire account. If you have a request about your information, contact support so it can be reviewed.",
    ],
  },
  {
    title: "Feedback and email delivery",
    body: [
      "When you submit feedback, RetailOS records the message, its category, the submission status, and any optional contact details you provide. The server sends accepted feedback through the email service configured for the application.",
      "Do not include passwords, payment card details, or other sensitive information in feedback messages.",
    ],
  },
  {
    title: "What we do not claim",
    body: [
      "This page describes behavior documented in the current RetailOS server and client work. It does not promise a particular retention period, legal compliance certification, or that every possible third-party service is absent. We will update this page when those details are verified.",
    ],
  },
];

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <Link href="/" className="text-sm text-orange-300 underline underline-offset-4">
          Back to RetailOS
        </Link>
        <header className="mt-8 border-b border-white/10 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-white/65">
            This page explains in plain language what information TX RetailOS uses
            and why. It is based on the features documented in the current app
            and server. We will not make promises that the system has not verified.
          </p>
        </header>

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-medium">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-white/65 sm:text-base">
                {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}

          <section>
            <h2 className="text-xl font-medium">Questions or privacy requests</h2>
            <p className="mt-3 text-sm leading-7 text-white/65 sm:text-base">
              Contact us at{" "}
              <a
                href="mailto:support.trexave@gmail.com"
                className="text-orange-300 underline underline-offset-4 hover:text-orange-200"
              >
                support.trexave@gmail.com
              </a>
              {" "}if you have a question about this page or want to ask about information
              associated with your account.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
