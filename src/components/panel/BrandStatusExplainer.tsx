import type { AlertSeverity } from "@prisma/client";
import { CheckCircle2, Info } from "lucide-react";
import type {
  ChannelStatus,
  ReasonTone,
  StatusReason,
  TenantStatus,
} from "@/lib/panel/status-reasons";

type OpenAlert = {
  id: string;
  severity: AlertSeverity;
  type: string;
  message: string | null;
};

const TONE: Record<
  ReasonTone,
  { label: string; dot: string; text: string }
> = {
  critical: {
    label: "Bakılmalı",
    dot: "bg-rose-500",
    text: "text-rose-700",
  },
  warn: {
    label: "Göz atın",
    dot: "bg-amber-400",
    text: "text-amber-700",
  },
  unknown: {
    label: "Kontrol edilemedi",
    dot: "bg-zinc-300",
    text: "text-zinc-500",
  },
};

const ALERT_TONE: Record<AlertSeverity, ReasonTone | null> = {
  critical: "critical",
  warn: "warn",
  unknown: "unknown",
  ok: null,
};

/**
 * Marka detayı — “Kritik / Uyarı” rozetinin nedenini kanal kanal ve ne
 * yapılması gerektiğiyle açıklar. Liste sayfası rozet göstermez; detay burada.
 */
export default function BrandStatusExplainer({
  status,
  openAlerts,
}: {
  status: TenantStatus;
  openAlerts: OpenAlert[];
}) {
  const channels: Array<{ key: string; label: string; s: ChannelStatus }> = [
    { key: "google", label: "Google Ads", s: status.google },
    { key: "meta", label: "Meta", s: status.meta },
    { key: "budget", label: "Bütçe", s: status.budget },
    { key: "ga4", label: "GA4", s: status.ga4 },
    { key: "gtm", label: "GTM", s: status.gtm },
  ];

  // Kanal sebeplerinde zaten anlatılmayan açık uyarılar.
  const known = new Set(channels.flatMap((c) => c.s.reasons.map((r) => r.text)));
  const alertReasons: StatusReason[] = openAlerts
    .filter((a) => ALERT_TONE[a.severity] && a.message && !known.has(a.message))
    .map((a) => ({
      tone: ALERT_TONE[a.severity]!,
      text: a.message!,
      fix: "Aşağıdaki Uyarılar bölümünden sorumlu atayın veya çözüldü olarak işaretleyin.",
    }));

  const all = [...channels.flatMap((c) => c.s.reasons), ...alertReasons];
  const actionable = all.filter((r) => r.tone !== "unknown").length;
  const unknownCount = all.length - actionable;

  const summary =
    all.length === 0
      ? "Her şey yolunda — dikkat gerektiren bir konu yok."
      : actionable === 0
        ? `Acil bir sorun yok. ${unknownCount} kanal kontrol edilemedi; çoğunlukla kurulum eksiğidir, reklamları etkilemez.`
        : `${actionable} konu dikkat istiyor${unknownCount ? `, ${unknownCount} kanal kontrol edilemedi` : ""}.`;

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        {all.length === 0 ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
        ) : (
          <Info className="mt-0.5 size-5 shrink-0 text-zinc-400" aria-hidden />
        )}
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Durum özeti</h3>
          <p className="mt-0.5 text-sm text-zinc-600">{summary}</p>
        </div>
      </div>

      <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-100">
        {channels.map(({ key, label, s }) => (
          <li key={key} className="grid gap-2 px-3 py-3 sm:grid-cols-[7rem_1fr]">
            <p className="text-xs font-semibold text-zinc-700">{label}</p>
            {s.reasons.length === 0 ? (
              <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                Sorun yok
              </p>
            ) : (
              <ReasonList reasons={s.reasons} />
            )}
          </li>
        ))}
        {alertReasons.length > 0 ? (
          <li className="grid gap-2 px-3 py-3 sm:grid-cols-[7rem_1fr]">
            <p className="text-xs font-semibold text-zinc-700">
              <a href="#uyarilar" className="hover:underline">
                Açık uyarılar
              </a>
            </p>
            <ReasonList reasons={alertReasons} />
          </li>
        ) : null}
      </ul>

      {unknownCount > 0 ? (
        <p className="text-[11px] leading-relaxed text-zinc-400">
          “Kontrol edilemedi”: o kanalın verisi okunamadığı için durumu bilinmiyor.
          Bu bir arıza değil, genelde bağlantı veya kurulum eksiğidir. Kanal bu
          markada kullanılmıyorsa Entegrasyonlar’dan kapatırsanız uyarı kalkar.
        </p>
      ) : null}
    </section>
  );
}

function ReasonList({ reasons }: { reasons: StatusReason[] }) {
  return (
    <ul className="space-y-2.5">
      {reasons.map((r) => {
        const t = TONE[r.tone];
        return (
          <li key={r.text} className="flex gap-2">
            <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${t.dot}`} aria-hidden />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm text-zinc-800">
                {r.text}{" "}
                <span className={`whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide ${t.text}`}>
                  · {t.label}
                </span>
              </p>
              {r.fix ? (
                <p className="text-xs text-zinc-500">
                  <span className="font-medium text-zinc-600">Ne yapmalı:</span> {r.fix}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
