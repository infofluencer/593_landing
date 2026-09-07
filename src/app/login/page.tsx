import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/panel/LoginForm";
import AuthSessionProvider from "@/components/panel/AuthSessionProvider";
import { auth } from "@/auth";
import { sanitizeCallbackPath } from "@/lib/panel/auth-nav";
import { rootDomain } from "@/lib/panel/host";
import { useMockPanelData } from "@/lib/integrations/tokens";

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
  const panelMode = h.get("x-panel-mode");
  const tenantSlug = h.get("x-tenant-slug");
  const callbackUrl = sanitizeCallbackPath(
    params.callbackUrl,
    panelMode === "staff" ? "/brands" : "/",
  );
  const showDevCreds = useMockPanelData();
  const root = rootDomain();

  // Already signed in on a panel host → go to panel (or requested path).
  if (session?.user && (tenantSlug || panelMode === "staff")) {
    redirect(callbackUrl);
  }

  const apexLoggedIn = Boolean(
    session?.user && panelMode !== "tenant" && panelMode !== "staff",
  );

  const isStaffHost = panelMode === "staff";
  const isTenantHost = panelMode === "tenant" && Boolean(tenantSlug);

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
              {isStaffHost
                ? "Ajans hesabı — marka subdomain’lerinden ayrı"
                : "Her marka yalnızca kendi hesabıyla girer"}
            </p>
          </div>

          {params.error === "AccessDenied" ? (
            <p className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
              Bu adres için yetkiniz yok. Marka paneline kendi hesabınızla,
              ajans işlemlerine{" "}
              <code className="text-rose-800">admin.{root}</code> üzerinden
              girin.
            </p>
          ) : null}

          {isStaffHost || isTenantHost ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-lg shadow-zinc-200/80">
              <p className="mb-4 text-xs text-zinc-500">
                {isStaffHost ? (
                  <>Ajans portalı</>
                ) : (
                  <>
                    Marka paneli:{" "}
                    <span className="font-medium text-zinc-800">
                      {tenantSlug}
                    </span>
                  </>
                )}
              </p>
              {isStaffHost ? (
                <ol className="mb-4 space-y-0.5 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] leading-snug text-zinc-500">
                  <li>Meta BM hesabı → Markalar → Yeni marka</li>
                  <li>Google ID’ler + müşteri hesabı</li>
                  <li>Meta / Google çek → slug.{root} kontrol</li>
                </ol>
              ) : null}
              <LoginForm callbackUrl={callbackUrl} />
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm leading-6 text-zinc-600">
              <p>
                Panel girişi ilgili host’ta yapılır; oturum çerezi o adrese
                yazılır.
              </p>
              {apexLoggedIn ? (
                <p className="mt-3 text-amber-800">
                  Apex oturumu panel host’larında geçerli değildir. Aşağıdaki
                  adreslerden birini kullanın.
                </p>
              ) : null}
              <p className="mt-4">
                Ajans:{" "}
                <Link
                  href="http://admin.localhost:3006/login"
                  className="font-medium text-[#e91825] hover:underline"
                >
                  admin.localhost:3006/login
                </Link>
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                Marka örneği:{" "}
                <Link
                  href="http://mareen.localhost:3006/login"
                  className="text-zinc-400 hover:underline"
                >
                  mareen.localhost:3006/login
                </Link>
              </p>
            </div>
          )}

          {showDevCreds ? (
            <p className="mt-6 text-center text-xs text-zinc-600">
              Ajans (admin.*):{" "}
              <code className="text-zinc-400">admin@593emarketing.com</code> /{" "}
              <code className="text-zinc-400">demo1234</code>
              <br />
              Müşteri (mareen.*):{" "}
              <code className="text-zinc-400">musteri@mareen.com</code> /{" "}
              <code className="text-zinc-400">client1234</code>
            </p>
          ) : null}
        </div>
      </main>
    </AuthSessionProvider>
  );
}
