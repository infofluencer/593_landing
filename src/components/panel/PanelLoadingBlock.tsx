export default function PanelLoadingBlock({
  title = "Yükleniyor",
  detail,
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className="mt-0.5 inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-zinc-200 border-t-[#e91825]"
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        {detail ? (
          <p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}
