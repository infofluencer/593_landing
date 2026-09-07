import { headers } from "next/headers";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { PanelTable } from "@/components/panel/ui";
import { requireBundle } from "@/lib/panel/data";
import { formatNumber } from "@/lib/panel/format";

const KIND_LABEL = {
  whatsapp: "WhatsApp",
  form: "Form",
  sale: "Satış",
  other: "Diğer",
} as const;

export default async function ConversionsPage() {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  const bundle = await requireBundle(slug);
  const { conversions, health } = bundle;
  const hasConv = conversions.length > 0;

  const byKind = {
    sale: conversions.filter((c) => c.kind === "sale"),
    form: conversions.filter((c) => c.kind === "form"),
    whatsapp: conversions.filter((c) => c.kind === "whatsapp"),
    other: conversions.filter((c) => c.kind === "other"),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Dönüşüm kontrolü
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Aksiyon · kaynak · birincil/ikincil · mükerrer sayım riski
          </p>
        </div>
        <StatusBadge status={hasConv ? (health === "unknown" ? "ok" : health) : "unknown"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["sale", "form", "whatsapp"] as const).map((kind) => {
          const total = byKind[kind].reduce((s, c) => s + c.count, 0);
          return (
            <div
              key={kind}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-3"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                {KIND_LABEL[kind]}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {hasConv ? formatNumber(total) : "—"}
              </p>
            </div>
          );
        })}
      </div>

      {!hasConv ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          Bu dönem için dönüşüm kaydı yok. Google Ads sync sonrası aksiyonlar
          burada listelenir.
        </div>
      ) : (
        <PanelTable
          headers={[
            "Aksiyon",
            "Kaynak",
            "Tür",
            "Birincil",
            "Kayıt",
            "Mükerrer",
          ]}
        >
          {conversions.map((c) => (
            <tr key={`${c.name}-${c.source}`} className="text-zinc-700">
              <td className="px-3 py-2.5 font-medium text-zinc-900">{c.name}</td>
              <td className="px-3 py-2.5 text-xs text-zinc-400">{c.source}</td>
              <td className="px-3 py-2.5 text-xs">{KIND_LABEL[c.kind]}</td>
              <td className="px-3 py-2.5 text-xs">
                {c.primary ? (
                  <span className="text-emerald-600">Birincil</span>
                ) : (
                  <span className="text-zinc-500">İkincil</span>
                )}
              </td>
              <td className="px-3 py-2.5 tabular-nums">{formatNumber(c.count)}</td>
              <td className="px-3 py-2.5">
                {c.dupeFlag ? (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-500/30">
                    Risk
                  </span>
                ) : (
                  <span className="text-xs text-zinc-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </PanelTable>
      )}
    </div>
  );
}
