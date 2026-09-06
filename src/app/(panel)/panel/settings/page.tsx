import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import TenantSettingsForm from "@/components/panel/TenantSettingsForm";
import { requireBundle } from "@/lib/panel/data";
import { prisma } from "@/lib/db";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "team") {
    redirect("/");
  }

  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
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
          Ayarlar · admin
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {bundle.tenant.name}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Tip · website · Google eşleştirme · uyarı eşikleri. Meta account ID
          BM’den gelir, burada değiştirilmez.
        </p>
      </div>

      {!db ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Bu marka henüz DB’de yok (yalnızca mock). Kaydetmek için seed veya Meta
          provision çalıştırın.
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
        <TenantSettingsForm initial={tenant} />
      </div>
    </div>
  );
}
