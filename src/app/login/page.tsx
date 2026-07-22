"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/language";
import { site } from "@/lib/site";

export default function LoginPage() {
  const { tr } = useLang();
  const [username, setUsername] = useState(process.env.NEXT_PUBLIC_LOGIN_USERNAME || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const next = new URLSearchParams(window.location.search).get("next") || "/dashboard";
        window.location.assign(next);
        return;
      }
      setError(tr({ en: "Invalid username or password.", ar: "اسم المستخدم أو كلمة المرور غير صحيحة." }));
    } catch {
      setError(tr({ en: "Something went wrong. Try again.", ar: "حدث خطأ ما. حاول مرة أخرى." }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg shadow-primary/20">
            <Image src={site.logo} alt={site.shortName} width={64} height={64} className="h-full w-full object-contain" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">
            {tr({ en: "Doctor Dashboard", ar: "لوحة الطبيب" })}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {tr({ en: "Sign in to manage appointments", ar: "سجّل الدخول لإدارة المواعيد" })}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-3xl border border-primary/15 bg-surface p-6 shadow-2xl shadow-primary/10 sm:p-8"
        >
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">
              {tr({ en: "Username", ar: "اسم المستخدم" })}
            </label>
            <input
              type="text"
              dir="ltr"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-primary/20 bg-background px-4 py-2.5 text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">
              {tr({ en: "Password", ar: "كلمة المرور" })}
            </label>
            <input
              type="password"
              dir="ltr"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-primary/20 bg-background px-4 py-2.5 text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-rose-300/50 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-3 font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-60"
          >
            {loading
              ? tr({ en: "Signing in…", ar: "جارٍ تسجيل الدخول…" })
              : tr({ en: "Sign in", ar: "تسجيل الدخول" })}
          </button>

          <Link href="/" className="block text-center text-sm text-muted transition hover:text-primary">
            {tr({ en: "← Back to site", ar: "← العودة للموقع" })}
          </Link>
        </form>
      </div>
    </div>
  );
}
