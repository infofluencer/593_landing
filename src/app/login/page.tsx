import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/panel/LoginForm";
import AuthSessionProvider from "@/components/panel/AuthSessionProvider";
import { auth } from "@/auth";
import { sanitizeCallbackPath } from "@/lib/panel/auth-nav";

export const metadata = {
  title: "Giriş | 593 Panel",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const h = await headers();
  const tenantSlug = h.get("x-tenant-slug");
  const callbackUrl = sanitizeCallbackPath(params.callbackUrl, "/");

  // Already signed in on a tenant host → go to panel (or requested path).
  if (session?.user && tenantSlug) {
    redirect(callbackUrl);
  }

  // Signed in on apex (no tenant) — session won't help panel hosts; show guide.
  const apexLoggedIn = Boolean(session?.user && !tenantSlug);

  return (
    <AuthSessionProvider>
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-900">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e91825]">
              593 Ajans Paneli
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Giriş
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Her marka yalnızca kendi verisini görür
            </p>
          </div>

          {params.error === "AccessDenied" ? (
            <p className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
              Bu marka için yetkiniz yok. Doğru firma adresinden girin veya
              çıkış yapıp tekrar deneyin.
            </p>
          ) : null}

          {!tenantSlug ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm leading-6 text-zinc-600">
              <p>
                Panel girişi marka adresinde yapılır. Oturum çerezi o adrese
                yazılır;{" "}
                <code className="text-zinc-700">localhost</code> ile{" "}
                <code className="text-zinc-700">demo.localhost</code> karışmaz.
              </p>
              {apexLoggedIn ? (
                <p className="mt-3 text-amber-800">
                  Şu an apex oturumu açık görünüyor; panele geçmek için aşağıdaki
                  marka login’ini kullanın.
                </p>
              ) : null}
              <p className="mt-4">
                <Link
                  href="http://demo.localhost:3006/login"
                  className="font-medium text-[#e91825] hover:underline"
                >
                  demo.localhost:3006/login
                </Link>
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                Müşteri örneği:{" "}
                <Link
                  href="http://mareen.localhost:3006/login"
                  className="text-zinc-400 hover:underline"
                >
                  mareen.localhost:3006/login
                </Link>
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-lg shadow-zinc-200/80">
              <p className="mb-4 text-xs text-zinc-500">
                Marka paneli:{" "}
                <span className="font-medium text-zinc-800">{tenantSlug}</span>
              </p>
              <LoginForm callbackUrl={callbackUrl} />
            </div>
          )}

          <p className="mt-6 text-center text-xs text-zinc-600">
            Admin:{" "}
            <code className="text-zinc-400">admin@593emarketing.com</code> /{" "}
            <code className="text-zinc-400">demo1234</code>
            <br />
            Müşteri (mareen):{" "}
            <code className="text-zinc-400">musteri@mareen.com</code> /{" "}
            <code className="text-zinc-400">client1234</code>
          </p>
        </div>
      </main>
    </AuthSessionProvider>
  );
}
