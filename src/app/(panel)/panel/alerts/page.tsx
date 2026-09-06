import { headers } from "next/headers";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { PanelTable } from "@/components/panel/ui";
import { requireBundle } from "@/lib/panel/data";
import { formatDateTime } from "@/lib/panel/format";
import AlertActions from "@/components/panel/AlertActions";
import SyncButton from "@/components/panel/SyncButton";
import { auth } from "@/auth";

const SYNC_LABEL = {
  pending: "Bekliyor",
  running: "Çalışıyor",
  success: "Başarılı",
  error: "Hata",
} as const;

export default async function AlertsPage() {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  const bundle = await requireBundle(slug);
  const { alerts, syncJobs, health, thresholds, tenant } = bundle;
  const session = await auth();
  const canManage =
    session?.user.role === "admin" || session?.user.role === "team";

  const open = alerts.filter((a) => !a.resolved);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Uyarılar</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Eşikler · atama · çözüm geçmişi
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={health} />
            {canManage ? <SyncButton tenantSlug={slug} /> : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">
              Tempo eşiği
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              %{thresholds.budgetPaceWarnPct}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">
              Dönüşüm kesintisi
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {thresholds.convDropoutDays} gün
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">
              Min harcama
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {thresholds.minSpendForAlert} {tenant.currency}
            </p>
          </div>
        </div>

        {open.length === 0 ? (
          <p className="text-sm text-zinc-500">Açık uyarı yok.</p>
        ) : (
          <PanelTable
            headers={["Önem", "Tür", "Mesaj", "Sorumlu / işlem", "Güncelleme"]}
          >
            {open.map((a) => (
              <tr key={a.id} className="text-zinc-700">
                <td className="px-3 py-2.5">
                  <StatusBadge status={a.severity} />
                </td>
                <td className="px-3 py-2.5 text-xs font-mono text-zinc-400">
                  {a.type}
                </td>
                <td className="px-3 py-2.5 text-sm text-zinc-800">{a.message}</td>
                <td className="px-3 py-2.5">
                  {canManage ? (
                    <AlertActions alertId={a.id} assignee={a.assignee} />
                  ) : (
                    <span className="text-xs text-zinc-400">
                      {a.assignee ?? "—"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-500 whitespace-nowrap">
                  {formatDateTime(a.updatedAt)}
                </td>
              </tr>
            ))}
          </PanelTable>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              SyncJob durumu
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Son başarılı güncelleme · hata (0 sonuç yazılmaz)
            </p>
          </div>
          <a
            href="/api/panel/export"
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
          >
            CSV dışa aktar
          </a>
        </div>

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
      </section>
    </div>
  );
}
