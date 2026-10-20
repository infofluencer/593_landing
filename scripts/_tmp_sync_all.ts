import { runAgencySync } from "@/lib/panel/sync";
import { prisma } from "@/lib/db";
(async () => {
  const t0 = Date.now();
  const r = await runAgencySync({ mode: "daily", logoOnly: true, providers: ["meta"] });
  for (const t of r.tenants) {
    const bad = Object.entries(t.services).filter(([, v]) => v && !v.ok).map(([k, v]) => `${k}: ${v?.error?.slice(0, 100)}`);
    console.log(t.slug, bad.length ? "HATA → " + bad.join(" | ") : "ok");
  }
  console.log("elapsed", Math.round((Date.now() - t0) / 1000), "s");
  await prisma.$disconnect();
})().catch(e => { console.error("ERR", e); process.exit(1); });
