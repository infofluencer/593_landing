import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import TenantSettingsForm from "@/components/panel/TenantSettingsForm";
import { requireBundle } from "@/lib/panel/data";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/panel/host";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) {
    redirect("/");
  }

  const h = await headers();
  const panelMode = h.get("x-panel-mode");
  if (panelMode !== "staff") {
    redirect("/login?error=AccessDenied");
  }

  const sp = await searchParams;
  const slug = sp.tenant?.trim().toLowerCase() || "";

  const allTenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
  });

  if (!slug) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e91825]">
            Ayarlar · ajans
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            Marka seçin
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Ayarlar ajans portalından yönetilir; marka subdomain’inde admin
            oturumu yoktur.
          </p>
        </div>
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
          {allTenants.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/settings?tenant=${encodeURIComponent(t.slug)}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-zinc-50"
              >
                <span className="font-medium text-zinc-900">{t.name}</span>
                <span className="font-mono text-xs text-zinc-400">{t.slug}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const bundle = await requireBundle(slug);

  const db = await prisma.tenant.findUnique({
    where: { slug },
    include: { mapping: true, thresholds: true },
  });

  const tenant = db
    ? {
        type: db.type,
        website: db.website ?? "",
        monthlyBudget: db.monthlyBudget ? String(Number(db.monthlyBudget)) : "",
        timezone: db.timezone,
        currency: db.currency,
        mapping: {
          adsCustomerId: db.mapping?.adsCustomerId ?? "",
          ga4PropertyId: db.mapping?.ga4PropertyId ?? "",
          gtmContainerId: db.mapping?.gtmContainerId ?? "",
          gscSiteUrl: db.mapping?.gscSiteUrl ?? "",
          merchantId: db.mapping?.merchantId ?? "",
        },
        thresholds: {
          budgetPaceWarnPct: String(db.thresholds?.budgetPaceWarnPct ?? 85),
          convDropoutDays: String(db.thresholds?.convDropoutDays ?? 3),
          minSpendForAlert: String(
            db.thresholds?.minSpendForAlert
              ? Number(db.thresholds.minSpendForAlert)
              : 100,
          ),
        },
      }
    : {
        type: bundle.tenant.type,
        website: bundle.tenant.website ?? "",
        monthlyBudget: String(bundle.tenant.monthlyBudget || ""),
        timezone: bundle.tenant.timezone,
        currency: bundle.tenant.currency,
        mapping: {
          adsCustomerId: bundle.tenant.mapping.adsCustomerId ?? "",
          ga4PropertyId: bundle.tenant.mapping.ga4PropertyId ?? "",
          gtmContainerId: bundle.tenant.mapping.gtmContainerId ?? "",
          gscSiteUrl: bundle.tenant.mapping.gscSiteUrl ?? "",
          merchantId: bundle.tenant.mapping.merchantId ?? "",
        },
        thresholds: {
          budgetPaceWarnPct: String(bundle.thresholds.budgetPaceWarnPct),
          convDropoutDays: String(bundle.thresholds.convDropoutDays),
          minSpendForAlert: String(bundle.thresholds.minSpendForAlert),
        },
      };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e91825]">
          Ayarlar · ajans
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {bundle.tenant.name}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Tip · website · Google eşleştirme · uyarı eşikleri. Meta account ID
          BM’den gelir, burada değiştirilmez.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          <Link href="/settings" className="text-[#e91825] hover:underline">
            ← Marka listesi
          </Link>
        </p>
      </div>

      {!db ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Bu marka henüz DB’de yok (yalnızca mock). Kaydetmek için seed veya Meta
          provision çalıştırın.
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
        <TenantSettingsForm initial={tenant} tenantSlug={slug} />
      </div>
    </div>
  );
}
