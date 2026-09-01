"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench, Phone, Lock, Loader2, AlertCircle } from "lucide-react";

export default function TechLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/tech/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), passcode }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Login failed");
        return;
      }
      router.replace("/tech");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-surface-elevated shadow-sm p-7">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <Wrench size={24} strokeWidth={1.8} className="text-primary" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Technician Login</h1>
          <p className="text-sm text-text-muted mt-1">Sign in to see your jobs</p>
        </div>

        <label className="block text-sm font-medium text-foreground mb-1.5">Phone number</label>
        <div className="relative mb-4">
          <Phone size={16} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+9665XXXXXXXX" className={inputCls} />
        </div>

        <label className="block text-sm font-medium text-foreground mb-1.5">Passcode</label>
        <div className="relative mb-4">
          <Lock size={16} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Your passcode" className={inputCls} />
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-error mb-3">
            <AlertCircle size={13} strokeWidth={1.8} /> {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !phone.trim() || !passcode}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary hover:bg-primary-hover text-black text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Sign in
        </button>
        <p className="text-[11px] text-text-muted text-center mt-4">
          Don&apos;t have a passcode? Ask your admin to set one.
        </p>
      </form>
    </main>
  );
}
