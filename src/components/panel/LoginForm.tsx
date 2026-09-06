"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { sanitizeCallbackPath } from "@/lib/panel/auth-nav";

export default function LoginForm({
  callbackUrl,
}: {
  callbackUrl: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const safeCallback = sanitizeCallbackPath(callbackUrl, "/");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        // Relative only — Auth.js must not invent apex localhost redirects.
        callbackUrl: safeCallback,
      });

      if (!res || res.error) {
        setError("E-posta veya şifre hatalı.");
        setPending(false);
        return;
      }

      // IMPORTANT: do not use res.url (often http://localhost:3006/ while the
      // user is on demo.localhost — that drops the host-scoped session cookie).
      router.replace(safeCallback);
      router.refresh();
    } catch {
      setError("Giriş sırasında bir hata oluştu. Tekrar deneyin.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-[12px] font-medium text-zinc-600"
        >
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none ring-[#e91825]/40 focus:ring-2"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-[12px] font-medium text-zinc-600"
        >
          Şifre
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none ring-[#e91825]/40 focus:ring-2"
        />
      </div>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center rounded-md bg-[#e91825] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#c91420] disabled:opacity-60"
      >
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
