import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/panel/host";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) {
    redirect("/");
  }

  const h = await headers();
  const panelMode = h.get("x-panel-mode");
  if (panelMode !== "staff") {
    redirect("/login?error=AccessDenied");
  }

  const sp = await searchParams;
  const slug = sp.tenant?.trim().toLowerCase() || "";

  // Ayarlar artık marka detayında — eski linkleri yönlendir
  if (slug) {
    redirect(`/brands/${encodeURIComponent(slug)}#ayarlar`);
  }

  const allTenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e91825]">
          Ayarlar · ajans
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          Marka seçin
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Ayarlar marka detay sayfasında. Bir marka seçin.
        </p>
      </div>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {allTenants.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/brands/${encodeURIComponent(t.slug)}#ayarlar`}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-zinc-50"
            >
              <span className="font-medium text-zinc-900">{t.name}</span>
              <span className="font-mono text-xs text-zinc-400">{t.slug}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
