/** Reklam hesabı İstanbul dışında bir saat diliminde ise günler o saate göredir. */
export function TimezoneNotice({
  platform,
  timeZone,
}: {
  platform: string;
  timeZone: string | null | undefined;
}) {
  if (!timeZone || timeZone === "Europe/Istanbul") return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
      {platform} hesabının saat dilimi <span className="font-mono">{timeZone}</span>
      . Günlük veriler bu saat dilimine göre; panel tarihleri İstanbul takvimini
      kullanır, gün sınırları birkaç saat kayabilir.
    </div>
  );
}
