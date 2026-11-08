import type { AlertSeverity } from "@prisma/client";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  SendAlertButton,
  TestSendForm,
  WhatsAppToggle,
} from "@/components/panel/NotificationControls";
import { chipClass } from "@/components/panel/ds/buttons";
import { EmptyState } from "@/components/panel/ds/EmptyState";
import { SectionCard } from "@/components/panel/ds/SectionCard";
import { StatusBadge } from "@/components/panel/ds/StatusBadge";
import { isStaffRole } from "@/lib/panel/host";
import {
  LOG_CHANNELS,
  LOG_PAGE_SIZE,
  LOG_STATUSES,
  listNotificationLog,
  listPendingAlerts,
  listRecentTests,
  loadNotificationStats,
  loadPhoneStatus,
  loadTemplateStatus,
  type TemplateRow,
} from "@/lib/panel/notification-admin";
import { whatsappEnabled } from "@/lib/panel/notification-settings";
import { ALERT_TITLE, smtpConfigured, whatsappConfigured } from "@/lib/panel/notify";
import { can } from "@/lib/panel/permissions";

export const dynamic = "force-dynamic";

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-posta",
  none: "Alıcı yok",
};
const STATUS_LABEL: Record<string, string> = {
  sent: "Gönderildi",
  failed: "Başarısız",
  skipped: "Atlandı",
};
const STATUS_SEVERITY: Record<string, AlertSeverity> = {
  sent: "ok",
  failed: "critical",
  skipped: "warn",
};
const TEMPLATE_STATUS_LABEL: Record<string, string> = {
  APPROVED: "Onaylı",
  PENDING: "Onay bekliyor",
  REJECTED: "Reddedildi",
  PAUSED: "Duraklatıldı",
  DISABLED: "Devre dışı",
};

function templateSeverity(t: TemplateRow): AlertSeverity {
  if (t.status === "APPROVED") return t.category === "MARKETING" ? "critical" : "ok";
  if (t.status === "PENDING") return "warn";
  return "critical";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

function logHref(channel: string | null, status: string | null, page = 1): string {
  const q = new URLSearchParams();
  if (channel) q.set("channel", channel);
  if (status) q.set("status", status);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/bildirimler?${s}` : "/bildirimler";
}

const thClass =
  "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-panel-fg-muted";
const tdClass = "px-3 py-2.5 align-top text-sm text-panel-fg";

/** Bildirim yönetimi — yalnızca admin. */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; status?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) redirect("/");

  const h = await headers();
  if (h.get("x-panel-mode") !== "staff") {
    redirect("/login?error=AccessDenied");
  }
  if (!can(session.user.role, "notifications.manage")) redirect("/brands");

  const sp = await searchParams;
  const channel = pick(sp.channel, LOG_CHANNELS);
  const status = pick(sp.status, LOG_STATUSES);
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);

  const [enabled, phone, templates, pending, log, stats, tests] = await Promise.all([
    whatsappEnabled(),
    loadPhoneStatus(),
    loadTemplateStatus(),
    listPendingAlerts(),
    listNotificationLog({ channel, status, page }),
    loadNotificationStats(),
    listRecentTests(),
  ]);
  const configured = whatsappConfigured();
  const smtp = smtpConfigured();
  const totalPages = Math.max(1, Math.ceil(log.total / LOG_PAGE_SIZE));
  const marketing =
    templates.state === "ok" ? templates.rows.filter((t) => t.category === "MARKETING") : [];

  return (
    <div className="space-y-6">
      <SectionCard
        title="WhatsApp kanalı"
        description="Kapalıyken uyarılar WhatsApp'tan gitmez; SMTP tanımlıysa e-postayla gider."
        actions={
          <WhatsAppToggle enabled={enabled} configured={configured} pendingCount={pending.length} />
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-panel-fg-secondary">Numara</dt>
            <dd className="min-w-0 break-words text-panel-fg">
              {phone === null ? (
                "Env tanımlı değil"
              ) : phone.ok ? (
                <>
                  {phone.number ?? "—"}
                  {phone.name ? ` · ${phone.name}` : ""}
                </>
              ) : (
                <span className="text-panel-critical">Meta hatası: {phone.error}</span>
              )}
            </dd>
            {phone?.ok ? (
              <>
                <dt className="text-panel-fg-secondary">Durum</dt>
                <dd className="text-panel-fg">
                  {phone.status ?? "—"} · kalite {phone.quality ?? "—"} · limit{" "}
                  {phone.limitTier ?? "—"}
                </dd>
              </>
            ) : null}
            <dt className="text-panel-fg-secondary">E-posta yedeği</dt>
            <dd className="text-panel-fg">{smtp ? "Tanımlı" : "SMTP tanımlı değil"}</dd>
            <dt className="text-panel-fg-secondary">Son 7 gün</dt>
            <dd className="text-panel-fg">
              {stats.sent} gönderildi · {stats.failed} başarısız · {stats.skipped} atlandı
            </dd>
            <dt className="text-panel-fg-secondary">Telefonu eksik</dt>
            <dd className="text-panel-fg">
              {stats.staffWithoutPhone} ekip üyesi ·{" "}
              <Link href="/ekip" className="underline underline-offset-2">
                Ekip sayfası
              </Link>
            </dd>
          </dl>
          <div className="min-w-0 space-y-4">
            <TestSendForm configured={configured} />
            {tests.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold text-panel-fg-muted">Son test denemeleri</p>
                <ul className="space-y-2">
                  {tests.map((t) => (
                    <li key={t.id} className="text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          size="sm"
                          status={STATUS_SEVERITY[t.status] ?? "unknown"}
                          label={STATUS_LABEL[t.status] ?? t.status}
                        />
                        <span className="text-panel-fg">{t.recipient}</span>
                        <span className="text-xs text-panel-fg-muted">{formatDate(t.createdAt)}</span>
                      </div>
                      {t.error ? (
                        <p className="mt-1 break-words text-xs text-panel-critical">{t.error}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Şablonlar"
        description="Meta'dan canlı okunur. Bildirim göndermek için hepsi Onaylı ve Utility olmalı."
      >
        {templates.state === "not_configured" ? (
          <EmptyState
            variant="unknown"
            title="Şablon durumu okunamıyor"
            description="Sunucuda WHATSAPP_ACCESS_TOKEN ve WHATSAPP_BUSINESS_ACCOUNT_ID tanımlanmalı."
          />
        ) : templates.state === "error" ? (
          <EmptyState variant="unknown" title="Meta'dan okunamadı" description={templates.error} />
        ) : (
          <>
            {marketing.length > 0 ? (
              <p
                role="alert"
                className="mb-4 rounded-lg border border-panel-critical/25 bg-panel-critical-bg px-3 py-2 text-sm text-panel-critical"
              >
                Marketing kategorisinde: {marketing.map((t) => t.name).join(", ")}. Bu şablonlarla
                uyarı gönderilmemeli; metni değiştirip Utility olarak yeniden açın.
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="border-b border-panel-border">
                    <th className={thClass}>Şablon</th>
                    <th className={thClass}>Kullanım</th>
                    <th className={thClass}>Kategori</th>
                    <th className={thClass}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.rows.map((t) => (
                    <tr key={t.name} className="border-b border-panel-border last:border-0">
                      <td className={`${tdClass} font-mono text-xs`}>{t.name}</td>
                      <td className={tdClass}>{t.label}</td>
                      <td className={tdClass}>{t.category ?? "—"}</td>
                      <td className={tdClass}>
                        <StatusBadge
                          size="sm"
                          status={templateSeverity(t)}
                          label={
                            t.status
                              ? (TEMPLATE_STATUS_LABEL[t.status] ?? t.status)
                              : "Açılmamış"
                          }
                          reasons={t.rejectedReason ? [t.rejectedReason] : undefined}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard
        title={`Bekleyen uyarılar (${pending.length})`}
        description="Henüz iletilmemiş açık uyarılar. WhatsApp'ı açmadan önce eskimiş olanları marka sayfasından çözün."
      >
        {pending.length === 0 ? (
          <EmptyState title="Bekleyen uyarı yok" description="Açık uyarıların hepsi iletilmiş." />
        ) : (
          <ul className="divide-y divide-panel-border">
            {pending.slice(0, 50).map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="mr-auto min-w-0 flex-1 basis-64">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/brands/${a.tenantSlug}`}
                      className="text-sm font-semibold text-panel-fg underline-offset-2 hover:underline"
                    >
                      {a.tenantName}
                    </Link>
                    <StatusBadge size="sm" status={a.severity} />
                    <span className="text-xs text-panel-fg-muted">{formatDate(a.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-panel-fg-secondary">
                    {ALERT_TITLE[a.type] ?? a.type}
                    {a.message ? ` — ${a.message}` : ""}
                  </p>
                </div>
                <SendAlertButton alertId={a.id} />
              </li>
            ))}
          </ul>
        )}
        {pending.length > 50 ? (
          <p className="mt-3 text-xs text-panel-fg-muted">
            En yeni 50 uyarı gösteriliyor; toplam {pending.length}.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Gönderim kaydı"
        description="WhatsApp'ta Gönderildi, Meta'nın kabul ettiği anlamına gelir; teslim durumu için webhook gerekir."
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href={logHref(null, status)} className={chipClass(channel === null)}>
            Tüm kanallar
          </Link>
          {LOG_CHANNELS.map((c) => (
            <Link key={c} href={logHref(c, status)} className={chipClass(channel === c)}>
              {CHANNEL_LABEL[c]}
            </Link>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href={logHref(channel, null)} className={chipClass(status === null)}>
            Tüm durumlar
          </Link>
          {LOG_STATUSES.map((s) => (
            <Link key={s} href={logHref(channel, s)} className={chipClass(status === s)}>
              {STATUS_LABEL[s]}
            </Link>
          ))}
        </div>

        {log.rows.length === 0 ? (
          <EmptyState title="Kayıt yok" description="Bu filtreyle eşleşen gönderim bulunmuyor." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-b border-panel-border">
                  <th className={thClass}>Zaman</th>
                  <th className={thClass}>Marka / uyarı</th>
                  <th className={thClass}>Kanal</th>
                  <th className={thClass}>Alıcı</th>
                  <th className={thClass}>Durum</th>
                  <th className={thClass}>Not</th>
                </tr>
              </thead>
              <tbody>
                {log.rows.map((r) => (
                  <tr key={r.id} className="border-b border-panel-border last:border-0">
                    <td className={`${tdClass} whitespace-nowrap`}>{formatDate(r.createdAt)}</td>
                    <td className={tdClass}>
                      <div>{r.tenantName ?? "—"}</div>
                      <div className="text-xs text-panel-fg-muted">
                        {r.alertType ? (ALERT_TITLE[r.alertType] ?? r.alertType) : ""}
                      </div>
                    </td>
                    <td className={tdClass}>
                      <div>{CHANNEL_LABEL[r.channel] ?? r.channel}</div>
                      {r.template ? (
                        <div className="font-mono text-xs text-panel-fg-muted">{r.template}</div>
                      ) : null}
                    </td>
                    <td className={`${tdClass} break-all`}>{r.recipient}</td>
                    <td className={tdClass}>
                      <StatusBadge
                        size="sm"
                        status={STATUS_SEVERITY[r.status] ?? "unknown"}
                        label={STATUS_LABEL[r.status] ?? r.status}
                      />
                    </td>
                    <td className={`${tdClass} max-w-xs break-words text-panel-fg-secondary`}>
                      {r.error === "test" ? "Test mesajı" : (r.error ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <nav aria-label="Sayfalama" className="mt-4 flex items-center justify-between gap-3">
            {page > 1 ? (
              <Link href={logHref(channel, status, page - 1)} className={chipClass(false)}>
                Önceki
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-panel-fg-muted">
              Sayfa {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={logHref(channel, status, page + 1)} className={chipClass(false)}>
                Sonraki
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </SectionCard>
    </div>
  );
}
