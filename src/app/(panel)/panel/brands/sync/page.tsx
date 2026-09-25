import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PanelTable } from "@/components/panel/ui";
import { formatDate, formatDateTime, formatNumber } from "@/lib/panel/format";
import { isStaffRole } from "@/lib/panel/host";
import { loadSyncAudit } from "@/lib/panel/sync-audit";

export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  pending: "Bekliyor",
  running: "Çalışıyor",
  success: "Başarılı",
  error: "Hata",
} as const;

function statusClass(status: keyof typeof STATUS_LABEL) {
  if (status === "success") return "text-emerald-600";
  if (status === "error") return "text-rose-600";
  if (status === "running") return "text-amber-700";
  return "text-zinc-400";
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-zinc-900 tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export default async function BrandSyncAuditPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) redirect("/");

  const h = await headers();
  if (h.get("x-panel-mode") !== "staff") {
    redirect("/login?error=AccessDenied");
  }

  const audit = await loadSyncAudit();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-zinc-500">
          <Link href="/brands" className="text-[#e91825] hover:underline">
            ← Markalar
          </Link>
        </p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight">
          Veri çekimi
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Meta Graph ve Google Ads API çağrılarının kaydı. Logolu markalarda
          günde iki kez otomatik (09:00 / 18:00 İstanbul); kanıt satır sayısı
          ve son metrik günü.
        </p>
      </div>

      {audit.mock ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Canlı API kapalı (mock). Bu sayfa production’daki SyncJob ve metrik
          satırlarını gösterir.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Son otomatik çekim"
              value={
                audit.cron?.lastSuccessAt
                  ? formatDateTime(audit.cron.lastSuccessAt)
                  : "Henüz yok"
              }
              hint={
                audit.cron
                  ? STATUS_LABEL[audit.cron.status]
                  : "İlk 09:00 / 18:00 slotunu bekler"
              }
            />
            <Stat
              label="Logolu marka"
              value={formatNumber(audit.logoCount)}
              hint="Günlük cron yalnızca bunları çeker"
            />
            <Stat
              label="Bugün başarılı çağrı"
              value={formatNumber(audit.todaySuccess)}
              hint="lastSuccessAt bugün (İstanbul)"
            />
            <Stat
              label="Hatalı çağrı"
              value={formatNumber(audit.errorCount)}
              hint="Açık error durumundaki SyncJob"
            />
          </div>

          {audit.cron?.error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              Otomatik sync: {audit.cron.error}
            </p>
          ) : null}

          <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                Marka kanıtı
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Son başarılı API + veritabanında duran günlük satırlar
              </p>
            </div>
            {audit.brands.length === 0 ? (
              <p className="text-sm text-zinc-500">Görünür marka yok.</p>
            ) : (
              <PanelTable
                headers={[
                  "Marka",
                  "Logo",
                  "Meta API",
                  "Google API",
                  "Son Meta günü",
                  "Son Google günü",
                  "Satır",
                ]}
              >
                {audit.brands.map((b) => (
                  <tr key={b.id} className="text-zinc-700">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/brands/${encodeURIComponent(b.slug)}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {b.name}
                      </Link>
                      <p className="font-mono text-[11px] text-zinc-400">
                        {b.slug}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {b.logo ? (
                        <span className="font-medium text-emerald-700">
                          Var
                        </span>
                      ) : (
                        <span className="text-zinc-400">Yok</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {b.metaStatus ? (
                        <span className={statusClass(b.metaStatus)}>
                          {STATUS_LABEL[b.metaStatus]}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                      <p className="text-zinc-500">
                        {formatDateTime(b.metaLastSuccessAt)}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {b.googleStatus ? (
                        <span className={statusClass(b.googleStatus)}>
                          {STATUS_LABEL[b.googleStatus]}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                      <p className="text-zinc-500">
                        {formatDateTime(b.googleLastSuccessAt)}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-zinc-600">
                      {b.metaLatestDay ? formatDate(b.metaLatestDay) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-zinc-600">
                      {b.googleLatestDay ? formatDate(b.googleLatestDay) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-zinc-600">
                      Meta {formatNumber(b.metaRows)}
                      <br />
                      Google {formatNumber(b.googleRows)}
                    </td>
                  </tr>
                ))}
              </PanelTable>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                API çağrıları
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Her satır bir SyncJob — gerçek istek (Graph / GAQL) ve sonucu
              </p>
            </div>
            {audit.calls.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Henüz çağrı kaydı yok. Elle sync veya ilk otomatik slottan
                sonra dolar.
              </p>
            ) : (
              <PanelTable
                headers={[
                  "Güncellendi",
                  "Marka",
                  "API",
                  "Çağrı",
                  "Durum",
                  "Son başarı",
                  "Hata",
                ]}
              >
                {audit.calls.map((c) => (
                  <tr key={c.id} className="text-zinc-700">
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap text-zinc-500">
                      {formatDateTime(c.updatedAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/brands/${encodeURIComponent(c.slug)}`}
                        className="text-sm font-medium text-zinc-900 hover:underline"
                      >
                        {c.brand}
                      </Link>
                      {c.logo ? (
                        <p className="text-[11px] text-zinc-400">logolu</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium text-zinc-800">
                      {c.api}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-zinc-600">
                      {c.call}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <span className={statusClass(c.status)}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap text-zinc-500">
                      {formatDateTime(c.lastSuccessAt)}
                    </td>
                    <td className="max-w-xs px-3 py-2.5 text-xs text-rose-600">
                      {c.error ?? "—"}
                    </td>
                  </tr>
                ))}
              </PanelTable>
            )}
          </section>
        </>
      )}
    </div>
  );
}
