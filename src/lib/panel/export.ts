import { prisma } from "@/lib/db";

/** Marka bazlı CSV — Google Ads + Meta + GA4 + conversions + uyarı + sync. */
export async function buildTenantReportCsv(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    include: {
      googleAdsMetrics: { orderBy: [{ date: "asc" }, { campaignName: "asc" }] },
      metaInsights: { orderBy: [{ date: "asc" }, { campaignName: "asc" }] },
      ga4Metrics: {
        orderBy: [{ date: "asc" }, { dimensionType: "asc" }, { dimensionValue: "asc" }],
      },
      conversions: { orderBy: [{ date: "asc" }, { name: "asc" }] },
      alerts: {
        where: { resolved: false },
        include: { assignee: { select: { email: true } } },
      },
      syncJobs: true,
    },
  });

  const lines: string[] = [];
  lines.push(
    `# 593 Panel Report — ${tenant.name} (${tenant.slug}) type=${tenant.type}`,
  );
  lines.push(`# generated,${new Date().toISOString()}`);
  lines.push("");
  lines.push(
    "section,date,campaign,cost,impressions,clicks,conversions,conv_value,roas",
  );
  for (const m of tenant.googleAdsMetrics) {
    lines.push(
      [
        "google_ads",
        m.date.toISOString().slice(0, 10),
        csvEscape(m.campaignName),
        Number(m.cost),
        m.impressions,
        m.clicks,
        Number(m.conversions),
        Number(m.convValue),
        m.roas != null ? Number(m.roas) : "",
      ].join(","),
    );
  }

  lines.push("");
  lines.push(
    "section,date,campaign,objective,spend,impressions,reach,clicks,conversions,conv_value,roas",
  );
  for (const m of tenant.metaInsights) {
    lines.push(
      [
        "meta",
        m.date.toISOString().slice(0, 10),
        csvEscape(m.campaignName),
        csvEscape(m.objective),
        Number(m.spend),
        m.impressions,
        m.reach,
        m.clicks,
        m.conversions != null ? Number(m.conversions) : "",
        m.convValue != null ? Number(m.convValue) : "",
        m.roas != null ? Number(m.roas) : "",
      ].join(","),
    );
  }

  lines.push("");
  lines.push(
    "section,date,dimension_type,dimension_value,users,sessions,bounce_rate,purchase_revenue,transactions",
  );
  for (const m of tenant.ga4Metrics) {
    lines.push(
      [
        "ga4",
        m.date.toISOString().slice(0, 10),
        csvEscape(m.dimensionType),
        csvEscape(m.dimensionValue),
        m.totalUsers ?? "",
        m.sessions ?? "",
        m.bounceRate != null ? Number(m.bounceRate) : "",
        m.purchaseRevenue != null ? Number(m.purchaseRevenue) : "",
        m.transactions ?? "",
      ].join(","),
    );
  }

  lines.push("");
  lines.push("section,date,name,source,kind,primary,count,dupe_flag");
  for (const c of tenant.conversions) {
    lines.push(
      [
        "conversion",
        c.date.toISOString().slice(0, 10),
        csvEscape(c.name),
        csvEscape(c.source),
        c.kind,
        c.primary ? "1" : "0",
        c.count,
        c.dupeFlag ? "1" : "0",
      ].join(","),
    );
  }

  lines.push("");
  lines.push("section,type,severity,assignee,message");
  for (const a of tenant.alerts) {
    lines.push(
      [
        "alert",
        csvEscape(a.type),
        a.severity,
        csvEscape(a.assignee?.email || ""),
        csvEscape(a.message || ""),
      ].join(","),
    );
  }

  lines.push("");
  lines.push("section,provider,service,objective,status,last_success,error");
  for (const j of tenant.syncJobs) {
    lines.push(
      [
        "sync",
        j.provider,
        j.service,
        j.objective,
        j.status,
        j.lastSuccessAt?.toISOString() || "",
        csvEscape(j.error || ""),
      ].join(","),
    );
  }

  return lines.join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
