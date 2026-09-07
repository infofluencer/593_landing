import { Suspense } from "react";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { StatusBadge } from "@/components/panel/StatusBadge";
import SiteVerifyButton from "@/components/panel/SiteVerifyButton";
import PanelLoadingBlock from "@/components/panel/PanelLoadingBlock";
import { PanelStat, PanelTable } from "@/components/panel/ui";
import { requireBundle } from "@/lib/panel/data";
import { fetchGtmSnapshotResolved } from "@/lib/integrations/google/gtm";
import { resolveGtmApiRef, resolveGtmPublicId } from "@/lib/panel/gtm-container-map";
import { useMockPanelData } from "@/lib/integrations/tokens";
import { formatDateTime } from "@/lib/panel/format";
import { prisma } from "@/lib/db";
import type { MockGtmSnapshot, MockTenantBundle } from "@/lib/panel/mock-data";

const VERIFY_LABEL: Record<string, string> = {
  not_tested: "Test edilmedi",
  pass: "Geçti",
  fail: "Başarısız",
  partial: "Kısmi",
  unknown: "Kontrol edilemedi",
  error: "Hata",
};

function isQuotaError(message: string) {
  return /quota|429|rate.?limit|Too Many Requests|Queries per minute/i.test(
    message,
  );
}

async function GtmConfigSection({
  slug,
  mockGtm,
  tenant,
  gtmJob,
}: {
  slug: string;
  mockGtm: MockGtmSnapshot;
  tenant: MockTenantBundle["tenant"];
  gtmJob: MockTenantBundle["syncJobs"][number] | undefined;
}) {
  const gtmRef = resolveGtmApiRef(tenant);
  const expectedPublicId = resolveGtmPublicId(tenant);

  let publicId = mockGtm.publicId || expectedPublicId || "";
  let liveVersion = mockGtm.liveVersion;
  let unpublishedChanges = mockGtm.unpublishedChanges;
  let tags = mockGtm.tags;
  let triggers = mockGtm.triggers;
  let variables = mockGtm.variables;
  let liveError: string | null = null;
  let mode: "mock" | "live" | "empty" = useMockPanelData() ? "mock" : "empty";

  if (!useMockPanelData() && gtmRef) {
    try {
      const { snapshot, path } = await fetchGtmSnapshotResolved(gtmRef);
      publicId = snapshot.publicId || expectedPublicId || gtmRef;
      liveVersion = snapshot.liveVersion?.name
        ? `${snapshot.liveVersion.name}${snapshot.liveVersion.versionId ? ` — ${snapshot.liveVersion.versionId}` : ""}`
        : "—";
      unpublishedChanges = snapshot.workspaceHasChanges;
      tags = snapshot.tags.map((t) => ({
        name: t.name,
        type: t.type,
        paused: Boolean(t.paused),
        expected: true,
        measurementIdOk: true,
      }));
      triggers = 0;
      variables = 0;
      mode = "live";

      const numeric = `${path.accountId}/${path.containerId}`;
      if (tenant.mapping.gtmContainerId !== numeric) {
        const dbTenant = await prisma.tenant.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (dbTenant) {
          await prisma.tenantMapping.upsert({
            where: { tenantId: dbTenant.id },
            update: { gtmContainerId: numeric },
            create: { tenantId: dbTenant.id, gtmContainerId: numeric },
          });
        }
      }
    } catch (err) {
      liveError = err instanceof Error ? err.message : String(err);
      tags = [];
      mode = "empty";
      if (expectedPublicId) publicId = expectedPublicId;
    }
  } else if (!useMockPanelData() && !gtmRef) {
    liveError = "GTM container yok (map / Ayarlar)";
    tags = [];
  }

  const configUnknown =
    Boolean(liveError) ||
    gtmJob?.status === "error" ||
    (!publicId && mode !== "mock");

  const siteStatus = mockGtm.siteVerified;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-800">Konteyner config</p>
        <StatusBadge status={configUnknown ? "unknown" : "ok"} />
      </div>

      {liveError ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            isQuotaError(liveError)
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-zinc-200 bg-zinc-100 text-zinc-700"
          }`}
        >
          <p className="font-medium">
            {isQuotaError(liveError)
              ? "GTM API kotası aşıldı (429)"
              : "GTM config alınamadı"}
          </p>
          <p className="mt-1 text-xs leading-5 opacity-90">{liveError}</p>
          {isQuotaError(liveError) ? (
            <p className="mt-2 text-xs leading-5 opacity-80">
              Sayfa çalışıyor; Google geçici olarak isteği reddetti. 1–2 dakika
              bekleyip yenileyin.
            </p>
          ) : null}
        </div>
      ) : null}

      {!liveError && configUnknown ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          GTM config gösterilemiyor
          {gtmJob?.error ? (
            <span className="mt-1 block text-xs text-zinc-500">
              {gtmJob.error}
            </span>
          ) : !publicId ? (
            <span className="mt-1 block text-xs text-zinc-500">
              Public ID / container eşleşmesi yok.
            </span>
          ) : null}
        </div>
      ) : null}

      {!configUnknown ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PanelStat label="Public ID" value={publicId || "—"} />
            <PanelStat label="Canlı sürüm" value={liveVersion} />
            <PanelStat
              label="Yayımlanmamış değişiklik"
              value={unpublishedChanges ? "Var" : "Yok"}
            />
            <PanelStat
              label="Site doğrulama"
              value={VERIFY_LABEL[siteStatus] ?? siteStatus}
            />
          </div>

          {mode === "mock" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <PanelStat label="Trigger" value={String(triggers)} />
              <PanelStat label="Variable" value={String(variables)} />
            </div>
          ) : null}

          {tags.length > 0 ? (
            <PanelTable
              headers={[
                "Tag",
                "Tip",
                "Duraklatılmış",
                "Beklenen",
                "Measurement ID",
              ]}
            >
              {tags.map((t) => (
                <tr key={t.name} className="text-zinc-700">
                  <td className="px-3 py-2.5 font-medium text-zinc-900">
                    {t.name}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">
                    {t.type}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {t.paused ? (
                      <span className="text-zinc-500">Evet</span>
                    ) : (
                      <span className="text-emerald-600">Hayır</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {t.expected ? (
                      <span className="text-emerald-600">Evet</span>
                    ) : (
                      <span className="text-amber-700">Hayır</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {t.measurementIdOk ? (
                      <span className="text-emerald-600">OK</span>
                    ) : (
                      <span className="text-rose-600">Eksik / eski</span>
                    )}
                  </td>
                </tr>
              ))}
            </PanelTable>
          ) : null}
        </>
      ) : null}
    </>
  );
}

export default async function GtmPage() {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  const bundle = await requireBundle(slug);
  const session = await auth();
  const canVerify =
    session?.user.role === "admin" || session?.user.role === "team";

  const { gtm: mockGtm, tenant, syncJobs } = bundle;
  const gtmJob = syncJobs.find(
    (j) => j.service === "gtm" && (j.objective === "config" || !j.objective),
  );

  const siteStatus = mockGtm.siteVerified;
  const siteBadge =
    siteStatus === "pass"
      ? "ok"
      : siteStatus === "fail" || siteStatus === "error"
        ? "critical"
        : siteStatus === "partial"
          ? "warn"
          : "unknown";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400">
            Google Tag Manager
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            Konteyner + site doğrulama
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Config özeti ayrı; sitede çalışıyor mu testi ayrı (Playwright)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canVerify ? <SiteVerifyButton /> : null}
        </div>
      </div>

      <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-950">
              Site tag testi · {VERIFY_LABEL[siteStatus] ?? siteStatus}
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-900/80">
              GTM’de etiket görünmesi, sitede doğru çalıştığı anlamına gelmez.
              Consent (kabul / red / varsayılan) senaryoları Playwright ile
              kontrol edilir.
            </p>
          </div>
          <StatusBadge
            status={siteBadge}
            label={VERIFY_LABEL[siteStatus] ?? siteStatus}
          />
        </div>
        {mockGtm.siteVerifySummary ? (
          <p className="text-sm text-amber-950/90">{mockGtm.siteVerifySummary}</p>
        ) : (
          <p className="text-sm text-amber-900/70">
            Henüz test edilmedi
            {tenant.website ? ` · hedef: ${tenant.website}` : " · website yok"}.
          </p>
        )}
        {mockGtm.siteVerifyCheckedAt ? (
          <p className="text-[11px] text-amber-800/70">
            Son test: {formatDateTime(mockGtm.siteVerifyCheckedAt)}
          </p>
        ) : null}

        {mockGtm.siteVerifyScenarios &&
        mockGtm.siteVerifyScenarios.length > 0 ? (
          <PanelTable headers={["Senaryo", "Sonuç", "Notlar"]}>
            {mockGtm.siteVerifyScenarios.map((s) => (
              <tr key={s.id} className="text-zinc-700">
                <td className="px-3 py-2.5 font-medium text-zinc-900">
                  {s.label}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  {s.ok ? (
                    <span className="text-emerald-600">OK</span>
                  ) : (
                    <span className="text-rose-600">Fail</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-400">
                  {s.notes?.join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </PanelTable>
        ) : null}
      </section>

      <Suspense
        fallback={
          <PanelLoadingBlock
            title="GTM config çekiliyor"
            detail="Google Tag Manager API çağrılıyor. Bu 10–60 sn sürebilir; 429 (kota) alırsanız 1–2 dk bekleyip yenileyin."
          />
        }
      >
        <div className="space-y-6">
          <GtmConfigSection
            slug={slug}
            mockGtm={mockGtm}
            tenant={tenant}
            gtmJob={gtmJob}
          />
        </div>
      </Suspense>
    </div>
  );
}
