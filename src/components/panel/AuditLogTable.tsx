import Link from "next/link";
import { PanelTable } from "@/components/panel/ui";
import { formatDateTime } from "@/lib/panel/format";

export type AuditRow = {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  summary: string;
  tenant: { slug: string; name: string } | null;
  before: unknown;
  after: unknown;
};

const ACTION_LABEL: Record<string, string> = {
  "tenant.create": "Marka eklendi",
  "tenant.update": "Marka ayarı",
  "tenant.delete": "Marka silindi",
  "budget.update": "Bütçe planı",
  "budget.year_update": "Yıllık plan",
  "user.create": "Kullanıcı eklendi",
  "user.delete": "Kullanıcı silindi",
  "client_user.create": "Müşteri hesabı",
  "client_user.update": "Müşteri hesabı",
  "team.member_add": "Ekibe eklendi",
  "team.member_remove": "Ekipten çıkarıldı",
  "board_card.create": "Kart oluşturuldu",
  "board_card.update": "Kart güncellendi",
  "board_card.delete": "Kart silindi",
  "meeting.action_add": "Aksiyon eklendi",
  "meeting.action_update": "Aksiyon güncellendi",
  "meeting.action_to_card": "Aksiyon göreve çevrildi",
  "meeting.action_delete": "Aksiyon silindi",
  "alert.assign": "Uyarı atandı",
  "alert.resolve": "Uyarı çözüldü",
  "content_post.create": "İçerik eklendi",
  "content_post.update": "İçerik güncellendi",
  "content_post.delete": "İçerik silindi",
  "brand_note.create": "Not eklendi",
  "brand_note.delete": "Not silindi",
  "brand_note.to_card": "Not göreve çevrildi",
  "user.update": "Kullanıcı güncellendi",
  "report.send": "Rapor gönderildi",
  "tenant.report_settings": "Rapor ayarı",
  "meeting.create": "Toplantı eklendi",
  "meeting.update": "Toplantı güncellendi",
  "meeting.delete": "Toplantı silindi",
};

export function auditActionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** before/after → "alan: eski → yeni" satırları. */
function changeLines(before: unknown, after: unknown): string[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<
    string,
    unknown
  >;
  const a = (after && typeof after === "object" ? after : {}) as Record<
    string,
    unknown
  >;
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
  return keys.map((k) => {
    if (!(k in b)) return `${k}: ${formatValue(a[k])}`;
    if (!(k in a)) return `${k}: ${formatValue(b[k])} → —`;
    return `${k}: ${formatValue(b[k])} → ${formatValue(a[k])}`;
  });
}

export default function AuditLogTable({
  rows,
  showTenant = true,
}: {
  rows: AuditRow[];
  showTenant?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">Kayıt yok.</p>;
  }
  return (
    <PanelTable
      headers={[
        "Zaman",
        "Kim",
        "İşlem",
        ...(showTenant ? ["Marka"] : []),
        "Özet",
        "Değişiklik",
      ]}
    >
      {rows.map((r) => {
        const lines = changeLines(r.before, r.after);
        return (
          <tr key={r.id} className="align-top text-zinc-700">
            <td className="px-3 py-2.5 text-xs whitespace-nowrap text-zinc-500">
              {formatDateTime(r.createdAt)}
            </td>
            <td className="px-3 py-2.5 text-xs text-zinc-800">{r.actor}</td>
            <td className="px-3 py-2.5 text-xs font-medium whitespace-nowrap text-zinc-900">
              {auditActionLabel(r.action)}
            </td>
            {showTenant ? (
              <td className="px-3 py-2.5 text-xs">
                {r.tenant ? (
                  <Link
                    href={`/brands/${encodeURIComponent(r.tenant.slug)}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {r.tenant.name}
                  </Link>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
            ) : null}
            <td className="max-w-xs px-3 py-2.5 text-xs text-zinc-700">
              {r.summary || "—"}
            </td>
            <td className="max-w-md px-3 py-2.5">
              {lines.length === 0 ? (
                <span className="text-xs text-zinc-400">—</span>
              ) : (
                <details className="text-[11px] text-zinc-600">
                  <summary className="cursor-pointer text-zinc-500 hover:text-zinc-800">
                    {lines.length} alan
                  </summary>
                  <ul className="mt-1.5 space-y-0.5 font-mono break-all">
                    {lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </details>
              )}
            </td>
          </tr>
        );
      })}
    </PanelTable>
  );
}
