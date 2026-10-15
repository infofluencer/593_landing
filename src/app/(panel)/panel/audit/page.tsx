import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AuditLogTable from "@/components/panel/AuditLogTable";
import { prisma } from "@/lib/db";
import { listAuditLogs, listStaffOptions } from "@/lib/panel/audit-query";
import { isStaffRole } from "@/lib/panel/host";

export const dynamic = "force-dynamic";

const ENTITY_OPTIONS = [
  { value: "", label: "Tümü" },
  { value: "budget", label: "Bütçe" },
  { value: "tenant", label: "Marka ayarları" },
  { value: "user", label: "Kullanıcılar" },
  { value: "team", label: "Ekipler" },
  { value: "board_card", label: "Durum panosu" },
];

type Props = {
  searchParams: Promise<{
    tenant?: string;
    actor?: string;
    entity?: string;
    before?: string;
  }>;
};

export default async function AuditPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) redirect("/");

  const h = await headers();
  if (h.get("x-panel-mode") !== "staff") {
    redirect("/login?error=AccessDenied");
  }

  const sp = await searchParams;
  const tenantSlug = sp.tenant?.trim().toLowerCase() || "";
  const actorId = sp.actor?.trim() || "";
  const entity = ENTITY_OPTIONS.some((o) => o.value === sp.entity)
    ? (sp.entity ?? "")
    : "";

  const [tenants, staff] = await Promise.all([
    prisma.tenant.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { name: "asc" },
    }),
    listStaffOptions(),
  ]);
  const tenant = tenants.find((t) => t.slug === tenantSlug) ?? null;

  const { rows, nextBefore } = await listAuditLogs({
    tenantId: tenant?.id,
    actorId: actorId || undefined,
    entity: entity || undefined,
    before: sp.before,
    take: 100,
  });

  const filterQs = new URLSearchParams();
  if (tenantSlug) filterQs.set("tenant", tenantSlug);
  if (actorId) filterQs.set("actor", actorId);
  if (entity) filterQs.set("entity", entity);
  const nextQs = new URLSearchParams(filterQs);
  if (nextBefore) nextQs.set("before", nextBefore);

  const selectClass =
    "rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">İşlem kaydı</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Kim, neyi, ne zaman değiştirdi — bütçe, plan, marka ayarları,
          kullanıcı ve ekip değişiklikleri. Durum panosu kart geçmişi kartın
          kendi detayında tutulur.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4"
      >
        <label className="space-y-1 text-[11px] font-medium text-zinc-500">
          <span className="block">Marka</span>
          <select name="tenant" defaultValue={tenantSlug} className={selectClass}>
            <option value="">Tümü</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[11px] font-medium text-zinc-500">
          <span className="block">Kim</span>
          <select name="actor" defaultValue={actorId} className={selectClass}>
            <option value="">Herkes</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[11px] font-medium text-zinc-500">
          <span className="block">Alan</span>
          <select name="entity" defaultValue={entity} className={selectClass}>
            {ENTITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
        >
          Filtrele
        </button>
        {filterQs.size > 0 ? (
          <Link
            href="/audit"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            Temizle
          </Link>
        ) : null}
      </form>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <AuditLogTable rows={rows} />
        <div className="mt-4 flex justify-end gap-3 text-xs">
          {sp.before ? (
            <Link
              href={`/audit${filterQs.size ? `?${filterQs}` : ""}`}
              className="font-medium text-zinc-500 hover:text-zinc-900"
            >
              ← En yeniler
            </Link>
          ) : null}
          {nextBefore ? (
            <Link
              href={`/audit?${nextQs}`}
              className="font-medium text-[#e91825] hover:underline"
            >
              Daha eski →
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
