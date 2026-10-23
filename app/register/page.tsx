"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { ThemeToggle } from "@/components/theme/ThemeProvider";
import BrandMark from "@/components/brand/BrandMark";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ password: "Passwords do not match" });
      return;
    }

    setLoading(true);

    try {
      await api("/auth/register", {
        method: "POST",
        json: { username, email, password },
      });
      router.push("/login");
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setError(err instanceof Error ? err.message : "Unable to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#0b0b0b] px-4 py-8 text-white">
      <div className="absolute right-4 top-4"><ThemeToggle compact /></div>
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#151515] p-8">
        <div className="mb-8 flex items-center gap-3">
          <BrandMark size={48} />
          <p className="text-xl font-bold tracking-tight">TX <span className="text-orange-500">RetailOS</span></p>
        </div>
        <h1 className="text-3xl font-semibold">Create account</h1>
        <p className="mt-2 text-sm text-white/45">Register a store owner account. Your first store is created by the server.</p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <Field label="Username" value={username} onChange={setUsername} error={fieldErrors.username} />
          <Field label="Email" value={email} onChange={setEmail} error={fieldErrors.email} type="email" />
          <Field label="Password" value={password} onChange={setPassword} error={fieldErrors.password} type="password" />
          <Field label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} type="password" />

          {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

          <button disabled={loading} className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/40">
          Already registered? <Link href="/login" className="text-orange-400">Sign in</Link>
        </p>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/75">{label}</span>
      <input
        required
        minLength={label.toLowerCase().includes("password") ? 6 : label === "Username" ? 2 : undefined}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field"
        autoComplete={type === "password" ? "new-password" : undefined}
      />
      {error && <span className="mt-1 block text-xs text-red-300">{error}</span>}
    </label>
  );
}
