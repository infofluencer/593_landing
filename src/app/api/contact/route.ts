import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string) {
  const now = Date.now();
  const slot = hits.get(ip);
  if (!slot || now > slot.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return false;
  }
  slot.count += 1;
  return slot.count > 8;
}

function clean(value: unknown, max = 120) {
  return String(value ?? "")
    .replace(/[\r\n\0]/g, " ")
    .trim()
    .slice(0, max);
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Çok fazla deneme. Lütfen biraz sonra tekrar deneyin." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  if (clean(body.website)) {
    return NextResponse.json({ ok: true });
  }

  const firstName = clean(body.firstName, 80);
  const lastName = clean(body.lastName, 80);
  const company = clean(body.company, 120);
  const phone = clean(body.phone, 40);

  if (!firstName || !lastName || !company || !phone) {
    return NextResponse.json(
      { error: "Tüm alanları doldurun." },
      { status: 400 },
    );
  }

  if (phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json(
      { error: "Geçerli bir telefon numarası girin." },
      { status: 400 },
    );
  }

  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  const port = Number(process.env["SMTP_PORT"] || 465);
  const to = process.env["CONTACT_TO"] || "info@593emarketing.com";
  const secure =
    process.env["SMTP_SECURE"] !== "false" && port === 465;

  if (!host || !user || !pass) {
    console.error("Contact form: SMTP env vars missing");
    return NextResponse.json(
      { error: "Mail henüz yapılandırılmadı." },
      { status: 500 },
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const fullName = `${firstName} ${lastName}`;

  try {
    await transporter.sendMail({
      from: `"593 Web" <${user}>`,
      to,
      replyTo: user,
      subject: `Yeni iletişim talebi: ${fullName} — ${company}`,
      text: [
        `İsim: ${firstName}`,
        `Soyisim: ${lastName}`,
        `Firma: ${company}`,
        `Telefon: ${phone}`,
      ].join("\n"),
      html: `
        <p><strong>İsim:</strong> ${escapeHtml(firstName)}</p>
        <p><strong>Soyisim:</strong> ${escapeHtml(lastName)}</p>
        <p><strong>Firma:</strong> ${escapeHtml(company)}</p>
        <p><strong>Telefon:</strong> ${escapeHtml(phone)}</p>
      `,
    });
  } catch (err) {
    console.error("Contact form send failed", err);
    return NextResponse.json(
      { error: "Mail gönderilemedi. Lütfen daha sonra deneyin." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
