import Link from "next/link";
import { CalendarDays, ClipboardList, Users } from "lucide-react";
import { formatDateTime } from "@/lib/panel/format";
import { MEETING_STATUS_LABELS, type SerializedMeeting } from "@/lib/panel/meetings";

/** Marka detayında kompakt toplantı listesi — düzenleme Toplantılar sayfasında. */
export default function BrandMeetingsList({
  meetings,
  tenantSlug,
  canManage,
}: {
  meetings: SerializedMeeting[];
  tenantSlug: string;
  canManage: boolean;
}) {
  const listHref = `/toplantilar?tenant=${encodeURIComponent(tenantSlug)}`;
  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Toplantılar</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Bu markaya ait toplantı notları ve aksiyonlar ·{" "}
            <Link href={listHref} className="text-[#e91825] hover:underline">
              Tümü
            </Link>
          </p>
        </div>
        {canManage ? (
          <Link
            href={`${listHref}&new=1`}
            className="inline-flex min-h-9 items-center rounded-full border border-zinc-300 bg-white px-3 text-xs font-semibold text-[#141111] hover:border-[#141111]"
          >
            Yeni toplantı
          </Link>
        ) : null}
      </div>

      {meetings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
          Henüz toplantı kaydı yok.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {meetings.map((m) => {
            const open = m.actionItems.filter((a) => !a.done).length;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="inline-flex items-center gap-1 text-xs text-zinc-500 tabular-nums">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {formatDateTime(m.startsAt)}
                </span>
                <Link
                  href={listHref}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 hover:underline"
                >
                  {m.title}
                </Link>
                <span className="text-[11px] font-semibold text-zinc-500">
                  {MEETING_STATUS_LABELS[m.status]}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                  <Users className="size-3.5" aria-hidden />
                  {m.attendees.length}
                </span>
                {m.actionItems.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                    <ClipboardList className="size-3.5" aria-hidden />
                    {open > 0 ? `${open} açık` : "tamam"}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
