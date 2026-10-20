/**
 * Müşteri raporu — PDF (pdf-lib) + e-posta. Ajans yorumu alanı ile.
 * Haftalık (Pazartesi, önceki hafta) / aylık (ayın 1'i, önceki ay) otomatik;
 * marka detayından elle de indirilir / gönderilir.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { prisma } from "@/lib/db";
import { addDaysYmd, istanbulYmd, subMonthsYmd, ymdToUtcDate } from "@/lib/date/tr";
import { loadBrandBudgetPlan } from "@/lib/panel/brand-budget";
import { getTenantBundle } from "@/lib/panel/data";
import { sendEmail } from "@/lib/panel/notify";
import { buildPresentation } from "@/lib/panel/presentation";
import { loadTenantStatus, planInputFromBudget } from "@/lib/panel/tenant-status";
import { derivedMetrics } from "@/lib/panel/mock-data";

const FONT_PATH = path.join(process.cwd(), "src/assets/fonts/Geist-Regular.ttf");
let fontBytes: Promise<Buffer> | null = null;
function loadFont(): Promise<Buffer> {
  fontBytes ??= readFile(FONT_PATH);
  return fontBytes;
}

function money(v: number, currency: string): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(v);
}
function num(v: number, digits = 0): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: digits }).format(v);
}
function ymdTr(ymd: string): string {
  return `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}.${ymd.slice(0, 4)}`;
}
function pct(cur: number, prev: number): string {
  if (!Number.isFinite(prev) || prev === 0) return "";
  const d = ((cur - prev) / prev) * 100;
  return ` (${d > 0 ? "+" : ""}${d.toFixed(0)}% önceki döneme göre)`;
}

export type BrandReportInput = {
  slug: string;
  from: string;
  to: string;
  comment: string;
};

export type BrandReportBuilt = {
  pdf: Uint8Array;
  filename: string;
  tenant: { id: string; name: string; slug: string; currency: string };
  summaryText: string;
};

/** Basit sayfa yazıcı — satır satır, taşınca yeni sayfa. */
class Writer {
  y: number;
  page: PDFPage;
  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private margin = 56,
  ) {
    this.page = doc.addPage([595.28, 841.89]);
    this.y = this.page.getHeight() - margin;
  }
  private ensure(h: number) {
    if (this.y - h < this.margin) {
      this.page = this.doc.addPage([595.28, 841.89]);
      this.y = this.page.getHeight() - this.margin;
    }
  }
  text(s: string, size = 10, color = rgb(0.09, 0.09, 0.11), indent = 0) {
    const maxW = this.page.getWidth() - this.margin * 2 - indent;
    const words = s.split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (this.font.widthOfTextAtSize(t, size) > maxW && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    if (line) lines.push(line);
    for (const l of lines) {
      this.ensure(size + 6);
      this.page.drawText(l, { x: this.margin + indent, y: this.y - size, size, font: this.font, color });
      this.y -= size + 6;
    }
  }
  gap(h = 10) {
    this.y -= h;
  }
  rule() {
    this.ensure(12);
    this.page.drawLine({
      start: { x: this.margin, y: this.y - 4 },
      end: { x: this.page.getWidth() - this.margin, y: this.y - 4 },
      thickness: 0.6,
      color: rgb(0.88, 0.88, 0.9),
    });
    this.y -= 14;
  }
  heading(s: string) {
    this.gap(6);
    this.text(s, 13, rgb(0.09, 0.09, 0.11));
    this.rule();
  }
  /** Yatay bar: etiket · değer · oran çubuğu (tek renk). */
  bar(label: string, value: string, ratio: number, color = rgb(0.11, 0.13, 0.34)) {
    this.ensure(18);
    const x0 = this.margin;
    const w = this.page.getWidth() - this.margin * 2;
    const labelW = 170;
    const valueW = 90;
    const barW = w - labelW - valueW;
    this.page.drawText(label.length > 34 ? `${label.slice(0, 33)}…` : label, {
      x: x0, y: this.y - 10, size: 9, font: this.font, color: rgb(0.3, 0.3, 0.33),
    });
    this.page.drawRectangle({
      x: x0 + labelW, y: this.y - 12, width: barW, height: 8, color: rgb(0.94, 0.94, 0.95),
    });
    this.page.drawRectangle({
      x: x0 + labelW, y: this.y - 12, width: Math.max(2, barW * Math.max(0, Math.min(1, ratio))), height: 8, color,
    });
    this.page.drawText(value, {
      x: x0 + labelW + barW + 8, y: this.y - 10, size: 9, font: this.font, color: rgb(0.09, 0.09, 0.11),
    });
    this.y -= 18;
  }
  kv(k: string, v: string) {
    this.ensure(16);
    this.page.drawText(k, { x: this.margin, y: this.y - 10, size: 10, font: this.font, color: rgb(0.4, 0.4, 0.45) });
    this.page.drawText(v, { x: this.margin + 200, y: this.y - 10, size: 10, font: this.font, color: rgb(0.09, 0.09, 0.11) });
    this.y -= 16;
  }
}

export async function buildBrandReport(input: BrandReportInput): Promise<BrandReportBuilt> {
  const bundle = await getTenantBundle(input.slug, { from: input.from, to: input.to });
  if (!bundle) throw new Error(`Marka bulunamadı: ${input.slug}`);
  const plan = await loadBrandBudgetPlan(input.slug, { from: input.from, to: input.to });
  const status = await loadTenantStatus(bundle, plan);
  const model = buildPresentation(bundle, `${ymdTr(input.from)} – ${ymdTr(input.to)}`, status);
  const cur = bundle.tenant.currency;
  const lead = model.tenantType !== "ecommerce";
  const resultLabel = lead ? "Lead" : "Satış";
  const planInput = planInputFromBudget(plan);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await loadFont(), { subset: true });
  doc.setTitle(`${model.brand} — performans raporu ${input.from} – ${input.to}`);
  doc.setCreator("593 E-Marketing Panel");
  const w = new Writer(doc, font);

  w.text("593 E-Marketing", 11, rgb(0.914, 0.094, 0.145));
  w.gap(8);
  w.text(`${model.brand} — Performans Raporu`, 20);
  w.text(`${ymdTr(input.from)} – ${ymdTr(input.to)} · önceki dönemle karşılaştırma · ${model.typeLabel}`, 10, rgb(0.45, 0.45, 0.5));
  w.gap(4);

  if (input.comment.trim()) {
    w.heading("Ajans yorumu");
    for (const para of input.comment.trim().split(/\n{2,}/)) w.text(para, 10.5, rgb(0.15, 0.15, 0.18));
  }

  w.heading("Özet");
  const cpl = model.totalConv > 0 ? model.totalSpend / model.totalConv : null;
  const prevCpl = model.prev.conv > 0 ? model.prev.spend / model.prev.conv : null;
  w.kv("Toplam harcama", `${money(model.totalSpend, cur)}${pct(model.totalSpend, model.prev.spend)}`);
  w.kv(`Toplam ${resultLabel.toLowerCase()}`, `${num(model.totalConv, 1)}${pct(model.totalConv, model.prev.conv)}`);
  w.kv(lead ? "Lead maliyeti" : "Satış maliyeti", cpl != null ? `${money(cpl, cur)}${prevCpl != null ? pct(cpl, prevCpl) : ""}` : "—");
  w.kv("Tıklama", `${num(model.totalClicks)}${pct(model.totalClicks, model.prev.clicks)}`);
  w.kv("Gösterim", `${num(model.totalImpr)}${pct(model.totalImpr, model.prev.impr)}`);
  if (model.totalRevenue != null) {
    w.kv("Toplam gelir", `${money(model.totalRevenue, cur)}${model.prev.revenue != null ? pct(model.totalRevenue, model.prev.revenue) : ""}`);
  }

  if (planInput && planInput.planned != null && planInput.planned > 0) {
    w.heading("Bütçe");
    const spent = planInput.spent;
    w.kv("Planlanan", money(planInput.planned, cur));
    w.kv("Harcanan", money(spent, cur));
    w.kv("Kalan", money(Math.max(0, planInput.planned - spent), cur));
    w.gap(4);
    w.bar("Harcanan / plan", `%${Math.round((spent / planInput.planned) * 100)}`, spent / planInput.planned);
  }

  w.heading("Kanallar");
  const maxSpend = Math.max(model.meta.spend, model.google.spend, 1);
  for (const ch of [model.meta, model.google]) {
    if (ch.status === "unknown") {
      w.text(`${ch.label}: veri alınamadı${ch.reasons.length ? ` — ${ch.reasons[0]}` : ""}`, 10, rgb(0.45, 0.45, 0.5));
      continue;
    }
    const d = derivedMetrics({ campaign: ch.label, spend: ch.spend, impr: ch.impr, clicks: ch.clicks, conv: ch.conv, convValue: ch.convValue ?? 0 });
    w.bar(`${ch.label} · harcama`, money(ch.spend, cur), ch.spend / maxSpend, ch.id === "meta" ? rgb(0.03, 0.4, 1) : rgb(0.89, 0.45, 0));
    w.text(
      `${resultLabel}: ${num(ch.conv, 1)} · ${lead ? "Lead" : "Satış"} maliyeti: ${ch.conv > 0 ? money(d.cpa, cur) : "—"} · Tıklama: ${num(ch.clicks)} · CTR: %${num(d.ctr, 2)}${ch.reach != null ? ` · Erişim: ${num(ch.reach)}` : ""}`,
      9,
      rgb(0.3, 0.3, 0.33),
      0,
    );
    w.gap(4);
  }

  const campaigns = [...model.meta.campaigns, ...model.google.campaigns]
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8);
  if (campaigns.length) {
    w.heading("Kampanyalar (harcamaya göre)");
    const top = campaigns[0]!.spend;
    for (const c of campaigns) {
      const d = derivedMetrics(c);
      w.bar(c.campaign, `${money(c.spend, cur)} · ${num(c.conv, 1)} ${resultLabel.toLowerCase()}${c.conv > 0 ? ` · ${money(d.cpa, cur)}` : ""}`, c.spend / top);
    }
  }

  if (status.overall.reasons.length) {
    w.heading("Dikkat");
    for (const r of status.overall.reasons) w.text(`• ${r.text}`, 10);
  }

  w.gap(16);
  w.text(`Rapor ${ymdTr(istanbulYmd())} tarihinde panelden üretildi. Rakamlar Meta ve Google Ads API verisidir.`, 8, rgb(0.55, 0.55, 0.6));

  const pdf = await doc.save();
  const summaryText = [
    `${model.brand} — ${ymdTr(input.from)} – ${ymdTr(input.to)}`,
    `Toplam harcama: ${money(model.totalSpend, cur)}${pct(model.totalSpend, model.prev.spend)}`,
    `${resultLabel}: ${num(model.totalConv, 1)}${pct(model.totalConv, model.prev.conv)}`,
    cpl != null ? `${lead ? "Lead" : "Satış"} maliyeti: ${money(cpl, cur)}` : null,
    input.comment.trim() ? `\nAjans yorumu:\n${input.comment.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    pdf,
    filename: `${bundle.tenant.slug}-rapor-${input.from}-${input.to}.pdf`,
    tenant: { id: bundle.tenant.id, name: bundle.tenant.name, slug: bundle.tenant.slug, currency: cur },
    summaryText,
  };
}

async function reportRecipients(tenantId: string): Promise<string[]> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      reportEmails: true,
      memberships: { where: { user: { role: "client" } }, select: { user: { select: { email: true } } } },
    },
  });
  if (!t) return [];
  const explicit = t.reportEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (explicit.length) return [...new Set(explicit)];
  return [...new Set(t.memberships.map((m) => m.user.email.toLowerCase()))];
}

/** PDF üretir, e-postayla gönderir ve BrandReport kaydı açar. */
export async function sendBrandReport(opts: {
  slug: string;
  from: string;
  to: string;
  comment: string;
  trigger: "manual" | "cron";
  actor?: { id: string | null; email: string | null };
  recipients?: string[];
}): Promise<{ reportId: string; sentTo: string[]; error: string | null }> {
  const built = await buildBrandReport(opts);
  const to = opts.recipients?.length ? opts.recipients : await reportRecipients(built.tenant.id);
  let error: string | null = null;
  if (to.length === 0) {
    error = "Alıcı yok — marka ayarlarında rapor e-postası ya da müşteri kullanıcısı tanımlı değil.";
  } else {
    try {
      await sendEmail({
        to,
        subject: `${built.tenant.name} — performans raporu ${ymdTr(opts.from)} – ${ymdTr(opts.to)}`,
        text: `${built.summaryText}\n\nDetaylı rapor ekte (PDF).`,
        attachments: [{ filename: built.filename, content: built.pdf, contentType: "application/pdf" }],
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
  const row = await prisma.brandReport.create({
    data: {
      tenantId: built.tenant.id,
      from: ymdToUtcDate(opts.from),
      to: ymdToUtcDate(opts.to),
      comment: opts.comment,
      createdById: opts.actor?.id ?? null,
      createdByEmail: opts.actor?.email ?? null,
      trigger: opts.trigger,
      sentTo: error ? [] : to,
      sentAt: error ? null : new Date(),
      error,
    },
  });
  return { reportId: row.id, sentTo: error ? [] : to, error };
}

/** Pazartesi → önceki hafta (Pzt–Paz); ayın 1'i → önceki ay. */
export function scheduledReportRange(
  today: string,
  frequency: "weekly" | "monthly",
): { from: string; to: string } | null {
  const d = new Date(`${today}T00:00:00Z`);
  if (frequency === "weekly") {
    if (d.getUTCDay() !== 1) return null;
    return { from: addDaysYmd(today, -7), to: addDaysYmd(today, -1) };
  }
  if (today.slice(8, 10) !== "01") return null;
  const prevMonth = subMonthsYmd(today, 1).slice(0, 7);
  return { from: `${prevMonth}-01`, to: addDaysYmd(today, -1) };
}

/** Zamanlanmış raporlar — aynı dönem için ikinci kez gönderilmez. */
export async function runScheduledReports(today = istanbulYmd()): Promise<{ sent: number; skipped: number }> {
  const tenants = await prisma.tenant.findMany({
    where: { visible: true, reportFrequency: { in: ["weekly", "monthly"] } },
    select: { id: true, slug: true, reportFrequency: true },
  });
  let sent = 0;
  let skipped = 0;
  for (const t of tenants) {
    const freq = t.reportFrequency === "weekly" ? "weekly" : "monthly";
    const range = scheduledReportRange(today, freq);
    if (!range) {
      skipped += 1;
      continue;
    }
    const exists = await prisma.brandReport.findFirst({
      where: { tenantId: t.id, trigger: "cron", from: ymdToUtcDate(range.from), to: ymdToUtcDate(range.to) },
      select: { id: true },
    });
    if (exists) {
      skipped += 1;
      continue;
    }
    try {
      const r = await sendBrandReport({ slug: t.slug, ...range, comment: "", trigger: "cron" });
      if (!r.error) sent += 1;
    } catch (err) {
      console.error("[report]", t.slug, err);
    }
  }
  return { sent, skipped };
}

export type SerializedReport = {
  id: string;
  from: string;
  to: string;
  comment: string;
  trigger: string;
  sentTo: string[];
  sentAt: string | null;
  error: string | null;
  createdAt: string;
  createdBy: string | null;
};

export async function listBrandReports(tenantId: string, take = 10): Promise<SerializedReport[]> {
  const rows = await prisma.brandReport.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    from: r.from.toISOString().slice(0, 10),
    to: r.to.toISOString().slice(0, 10),
    comment: r.comment,
    trigger: r.trigger,
    sentTo: r.sentTo,
    sentAt: r.sentAt?.toISOString() ?? null,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    createdBy: r.createdByEmail,
  }));
}
