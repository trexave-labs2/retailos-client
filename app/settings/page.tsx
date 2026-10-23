"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import DashboardShell from "@/components/layout/DashboardShell";
import { api, ApiError } from "@/lib/api";

const fieldClass =
  "mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-orange-400 disabled:cursor-not-allowed disabled:opacity-50";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function SettingsPage() {
  const { user, refresh, logout } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const [storeName, setStoreName] = useState(user?.store_name ?? "");
  const [savingStore, setSavingStore] = useState(false);
  const [storeError, setStoreError] = useState("");
  const [storeSuccess, setStoreSuccess] = useState("");
  const storeSubmitLock = useRef(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const passwordSubmitLock = useRef(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // AuthProvider clears client auth state and redirects even if the server request fails.
    } finally {
      setSigningOut(false);
    }
  }

  async function handleStoreSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingStore || storeSubmitLock.current) return;

    const normalizedName = storeName.trim();
    setStoreError("");
    setStoreSuccess("");

    if (!normalizedName) {
      setStoreError("Enter a store name.");
      return;
    }
    if (normalizedName.length > 100) {
      setStoreError("Store name must be 100 characters or fewer.");
      return;
    }
    if (!user?.store_id) {
      setStoreError("This account has no store assigned, so its name cannot be changed.");
      return;
    }

    storeSubmitLock.current = true;
    setSavingStore(true);
    try {
      const result = await api<{ store: { id: number; name: string } }>("/settings/store", {
        method: "PATCH",
        json: { store_id: user.store_id, name: normalizedName },
      });

      const refreshedUser = await refresh();
      if (refreshedUser?.store_name === result.store.name) {
        setStoreName(result.store.name);
        setStoreSuccess("Store name saved successfully.");
      } else {
        setStoreError("The server saved the store name, but account details could not be refreshed. Reload the page to verify the latest name.");
      }
    } catch (error) {
      setStoreError(errorMessage(error, "Could not save the store name. Check your connection and try again."));
    } finally {
      storeSubmitLock.current = false;
      setSavingStore(false);
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (changingPassword || passwordSubmitLock.current) return;

    setPasswordError("");
    if (!currentPassword) {
      setPasswordError("Enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must contain at least 6 characters.");
      return;
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setPasswordError("New password exceeds the supported 72-byte limit.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    passwordSubmitLock.current = true;
    setChangingPassword(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        json: { current_password: currentPassword, new_password: newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.replace("/login?reason=password-changed");
      router.refresh();
    } catch (error) {
      setPasswordError(errorMessage(error, "Could not change the password. Check your connection and try again."));
    } finally {
      passwordSubmitLock.current = false;
      setChangingPassword(false);
    }
  }

  return (
    <DashboardShell title="Settings">
      <section data-tour="settings-account" className="rounded-2xl border border-white/10 bg-[#151515] p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Account</h2>
            <p className="mt-2 text-sm text-white/50">Account details for your TX RetailOS login.</p>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/40">Username</dt>
                <dd className="mt-1">{user?.username || "Not available"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/40">Email</dt>
                <dd className="mt-1 break-all">{user?.email || "Not available"}</dd>
              </div>
            </dl>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="shrink-0 rounded-lg border border-red-400/30 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </section>

      <section data-tour="settings-store" className="mt-5 rounded-2xl border border-white/10 bg-[#151515] p-5">
        <h2 className="font-semibold">Store profile</h2>
        <p className="mt-2 text-sm text-white/50">Update the name shown throughout RetailOS. Only the store owner can make this change.</p>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-white/40">Current store name</dt>
            <dd className="mt-1 font-medium">{user?.store_name || "No store name available"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-white/40">Store ID</dt>
            <dd className="mt-1">{user?.store_id ?? "Not assigned"}</dd>
          </div>
        </dl>

        <form onSubmit={handleStoreSave} className="mt-5 max-w-xl space-y-4">
          <label className="block text-sm font-medium" htmlFor="store-name">
            Store name
            <input
              id="store-name"
              name="store_name"
              type="text"
              value={storeName}
              onChange={(event) => {
                setStoreName(event.target.value);
                setStoreError("");
                setStoreSuccess("");
              }}
              maxLength={100}
              autoComplete="organization"
              required
              disabled={!user?.store_id || savingStore}
              className={fieldClass}
            />
          </label>
          {storeError && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{storeError}</p>}
          {storeSuccess && <p role="status" className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-300">{storeSuccess}</p>}
          <button
            type="submit"
            disabled={!user?.store_id || savingStore || storeName.trim() === (user?.store_name ?? "")}
            className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingStore ? "Saving store name…" : "Save store name"}
          </button>
        </form>
      </section>

      <section data-tour="settings-password" className="mt-5 rounded-2xl border border-white/10 bg-[#151515] p-5">
        <h2 className="font-semibold">Change password</h2>
        <p className="mt-2 text-sm text-white/50">Choose a new password for this account. After a successful change, all sessions are invalidated and you must sign in again.</p>
        <form onSubmit={handlePasswordChange} className="mt-5 max-w-xl space-y-4">
          <label htmlFor="current-password" className="block text-sm font-medium">
            Current password
            <input
              id="current-password"
              name="current_password"
              type="password"
              value={currentPassword}
              onChange={(event) => { setCurrentPassword(event.target.value); setPasswordError(""); }}
              autoComplete="current-password"
              required
              disabled={changingPassword}
              className={fieldClass}
            />
          </label>
          <label htmlFor="new-password" className="block text-sm font-medium">
            New password
            <input
              id="new-password"
              name="new_password"
              type="password"
              value={newPassword}
              onChange={(event) => { setNewPassword(event.target.value); setPasswordError(""); }}
              autoComplete="new-password"
              minLength={6}
              required
              disabled={changingPassword}
              className={fieldClass}
            />
            <span className="mt-1 block text-xs text-white/40">At least 6 characters and no more than 72 UTF-8 bytes.</span>
          </label>
          <label htmlFor="confirm-password" className="block text-sm font-medium">
            Confirm new password
            <input
              id="confirm-password"
              name="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(event) => { setConfirmPassword(event.target.value); setPasswordError(""); }}
              autoComplete="new-password"
              minLength={6}
              required
              disabled={changingPassword}
              className={fieldClass}
            />
          </label>
          {passwordError && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{passwordError}</p>}
          <button
            type="submit"
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {changingPassword ? "Changing password…" : "Change password"}
          </button>
        </form>
      </section>


    </DashboardShell>
  );
}
