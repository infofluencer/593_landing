import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import AlertActions from "@/components/panel/AlertActions";
import BrandBudgetPlanner from "@/components/panel/BrandBudgetPlanner";
import BrandDetailHeaderActions from "@/components/panel/BrandDetailHeaderActions";
import BrandPanelLinkActions from "@/components/panel/BrandPanelLinkActions";
import { StatusBadge } from "@/components/panel/StatusBadge";
import TenantSettingsForm from "@/components/panel/TenantSettingsForm";
import BrandSettingsDisclosure from "@/components/panel/BrandSettingsDisclosure";
import { PanelTable } from "@/components/panel/ui";
import { prisma } from "@/lib/db";
import {
  brandInitials,
  resolveBrandCover,
} from "@/lib/panel/brand-logos";
import { loadBrandBudgetPlan, tenantHasBudgetPlan } from "@/lib/panel/brand-budget";
import { getBrandMissingIntegrations } from "@/lib/panel/brand-onboarding";
import { getTenantBundle } from "@/lib/panel/data";
import { formatDateTime, formatNumber, formatTry } from "@/lib/panel/format";
import { isStaffRole, rootDomain } from "@/lib/panel/host";
import { resolvePanelDateRange } from "@/lib/panel/period";
import { loadTenantSettingsInitial } from "@/lib/panel/tenant-settings";
import { useMockPanelData } from "@/lib/integrations/tokens";
import type { MockSyncJob } from "@/lib/panel/mock-data";

const SYNC_LABEL = {
  pending: "Bekliyor",
  running: "Çalışıyor",
  success: "Başarılı",
  error: "Hata",
} as const;

function latestProviderSync(
  jobs: MockSyncJob[],
  provider: "meta" | "google",
): string {
  let best: string | null = null;
  for (const j of jobs) {
    if (j.provider !== provider || !j.lastSuccessAt) continue;
    if (!best || new Date(j.lastSuccessAt) > new Date(best)) {
      best = j.lastSuccessAt;
    }
  }
  return best ? formatDateTime(best) : "Henüz çekilmedi";
}

function IconSpend({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M12 3v18M16.5 7.5C16.5 5.57 14.49 4 12 4S7.5 5.57 7.5 7.5 9.51 11 12 11s4.5 1.57 4.5 3.5S14.49 18 12 18s-4.5-1.57-4.5-3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconConvert({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M7 7h11M18 7l-3-3M18 7l-3 3M17 17H6M6 17l3-3M6 17l3 3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 8v4.5l3 1.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8.5 12.5 11 15l4.5-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.5 5.43"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13.5 18.57"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconAlert({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M12 4.5 20.5 19h-17L12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12 10v4M12 16.5v.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSync({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M4.5 12a7.5 7.5 0 0 1 12.7-5.4L19 9M19.5 12a7.5 7.5 0 0 1-12.7 5.4L5 15"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 5v4h-4M5 19v-4h4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    month?: string;
    period?: string;
    start?: string;
    end?: string;
  }>;
};

export default async function BrandDetailPage({ params, searchParams }: Props) {
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

  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim().toLowerCase();
  if (!slug) notFound();

  const bundle = await getTenantBundle(slug);
  if (!bundle) notFound();

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const isLocal = host.includes("localhost") || host.startsWith("127.");
  const root = rootDomain();
  const panelHost = isLocal
    ? `${bundle.tenant.slug}.localhost:3006`
    : `${bundle.tenant.slug}.${root}`;
  const panelProto = isLocal ? "http" : "https";
  const panelUrl = `${panelProto}://${panelHost}/`;

  let clientOk = useMockPanelData();
  if (!clientOk) {
    const count = await prisma.membership.count({
      where: {
        tenantId: bundle.tenant.id,
        user: { role: "client" },
      },
    });
    clientOk = count > 0;
  }

  const isUnknown = bundle.health === "unknown";
  const cover = resolveBrandCover({
    slug: bundle.tenant.slug,
    name: bundle.tenant.name,
    coverUrl: bundle.tenant.coverUrl,
  });

  const openAlerts = bundle.alerts.filter((a) => !a.resolved);
  const { thresholds, syncJobs } = bundle;
  const { initial: settingsInitial, existsInDb } =
    await loadTenantSettingsInitial(slug, bundle);
  const range = await resolvePanelDateRange(await searchParams);
  const [budgetOk, budgetPlan] = existsInDb
    ? await Promise.all([
        tenantHasBudgetPlan(bundle.tenant.id),
        loadBrandBudgetPlan(slug, {
          from: range.startDate,
          to: range.endDate,
        }),
      ])
    : ([true, null] as const);
  const missing = getBrandMissingIntegrations({
    tenant: bundle.tenant,
    clientOk,
    budgetOk,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="size-24 shrink-0 overflow-hidden rounded-[1.1rem] border border-zinc-200 bg-[#f4f1ea] sm:size-28">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.src}
              alt=""
              className={
                cover.fit === "cover"
                  ? "h-full w-full object-cover"
                  : "h-full w-full object-contain p-3"
              }
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-zinc-400">
              {brandInitials(bundle.tenant.name)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e91825]">
            Marka detayı
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">
            {bundle.tenant.name}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {bundle.tenant.visible ? (
              <StatusBadge status={bundle.health} />
            ) : (
              <span className="rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-600">
                Devre dışı
              </span>
            )}
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600">
              {bundle.tenant.type === "ecommerce" ? "E-ticaret" : "Lead"}
            </span>
            <code className="text-xs text-zinc-400">{bundle.tenant.slug}</code>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            <Link href="/brands" className="text-[#e91825] hover:underline">
              ← Markalar
            </Link>
          </p>
        </div>

        <BrandDetailHeaderActions
          tenantSlug={bundle.tenant.slug}
          metaLastSynced={latestProviderSync(syncJobs, "meta")}
          googleLastSynced={latestProviderSync(syncJobs, "google")}
          active={bundle.tenant.visible}
        />
      </div>

      {!bundle.tenant.visible ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Bu marka devre dışı. Meta ve Google’dan yeni veri çekilmez. Ayarlardan
          tekrar aktif edebilirsiniz.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="min-w-0 rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            <IconSpend className="size-3.5 shrink-0 text-zinc-400" />
            Harcama
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 tabular-nums">
            {isUnknown
              ? "—"
              : formatTry(bundle.periodSpend, bundle.tenant.currency)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            <IconConvert className="size-3.5 shrink-0 text-zinc-400" />
            Dönüşüm
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 tabular-nums">
            {isUnknown ? "—" : formatNumber(bundle.periodConv)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            <IconClock className="size-3.5 shrink-0 text-zinc-400" />
            Son kontrol
          </p>
          <p className="mt-2 text-base font-semibold tracking-tight text-zinc-900 tabular-nums">
            {formatDateTime(bundle.lastCheckAt)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            <IconCheck className="size-3.5 shrink-0 text-zinc-400" />
            Onboarding
          </p>
          <div className="mt-2">
            {missing.length === 0 ? (
              <p className="text-base font-semibold text-emerald-600">Tamam</p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {missing.map((m) => (
                  <span
                    key={m}
                    className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200/80"
                  >
                    {m}
                  </span>
                ))}
                <a
                  href="#ayarlar"
                  className="text-[11px] font-medium text-[#e91825] hover:underline"
                >
                  Eksikleri tamamla
                </a>
              </div>
            )}
          </div>
        </div>
        <div className="min-w-0 rounded-xl border border-zinc-200 bg-white px-4 py-3 sm:col-span-2 lg:col-span-1">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            <IconLink className="size-3.5 shrink-0 text-zinc-400" />
            Panel adresi
          </p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <a
              href={panelUrl}
              className="min-w-0 break-all font-mono text-xs text-zinc-700 hover:text-zinc-900 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {panelHost}
            </a>
            <BrandPanelLinkActions panelHost={panelHost} panelUrl={panelUrl} />
          </div>
        </div>
      </div>

      <BrandBudgetPlanner plan={budgetPlan} existsInDb={existsInDb} />

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <IconAlert className="size-4 text-zinc-400" />
              Uyarılar
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Bu firmaya özel · eşikler · atama · çözüm
            </p>
          </div>
          <StatusBadge status={bundle.health} />
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">
              Dönüşüm kesintisi
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {thresholds.convDropoutDays} gün
            </p>
          </div>
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">
              Min harcama
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {thresholds.minSpendForAlert} {bundle.tenant.currency}
            </p>
          </div>
        </div>

        {openAlerts.length === 0 ? (
          <p className="text-sm text-zinc-500">Açık uyarı yok.</p>
        ) : (
          <PanelTable
            headers={["Önem", "Tür", "Mesaj", "Sorumlu / işlem", "Güncelleme"]}
          >
            {openAlerts.map((a) => (
              <tr key={a.id} className="text-zinc-700">
                <td className="px-3 py-2.5">
                  <StatusBadge status={a.severity} />
                </td>
                <td className="px-3 py-2.5 text-xs font-mono text-zinc-400">
                  {a.type}
                </td>
                <td className="px-3 py-2.5 text-sm text-zinc-800">{a.message}</td>
                <td className="px-3 py-2.5">
                  <AlertActions alertId={a.id} assignee={a.assignee} />
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-500 whitespace-nowrap">
                  {formatDateTime(a.updatedAt)}
                </td>
              </tr>
            ))}
          </PanelTable>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <IconSync className="size-4 text-zinc-400" />
            SyncJob durumu
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Son başarılı güncelleme · hata (0 sonuç yazılmaz)
          </p>
        </div>

        {syncJobs.length === 0 ? (
          <p className="text-sm text-zinc-500">Henüz sync kaydı yok.</p>
        ) : (
          <PanelTable
            headers={[
              "Provider",
              "Servis",
              "Objective",
              "Durum",
              "Son başarı",
              "Hata",
            ]}
          >
            {syncJobs.map((j) => (
              <tr
                key={`${j.provider}-${j.service}-${j.objective ?? "default"}`}
                className="text-zinc-700"
              >
                <td className="px-3 py-2.5 capitalize">{j.provider}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{j.service}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">
                  {j.objective ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={
                      j.status === "success"
                        ? "text-emerald-600"
                        : j.status === "error"
                          ? "text-rose-400"
                          : "text-zinc-400"
                    }
                  >
                    {SYNC_LABEL[j.status]}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-500 whitespace-nowrap">
                  {formatDateTime(j.lastSuccessAt)}
                </td>
                <td className="max-w-xs px-3 py-2.5 text-xs text-rose-600">
                  {j.error ?? "—"}
                </td>
              </tr>
            ))}
          </PanelTable>
        )}
      </section>

      <BrandSettingsDisclosure>
        {!existsInDb ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Bu marka henüz DB’de yok (yalnızca mock). Kaydetmek için seed veya
            Meta provision çalıştırın.
          </div>
        ) : null}

        <TenantSettingsForm
          initial={settingsInitial}
          tenantSlug={slug}
          rootDomain={root}
          allowDelete={existsInDb}
          detailBasePath="/brands"
        />
      </BrandSettingsDisclosure>
    </div>
  );
}
