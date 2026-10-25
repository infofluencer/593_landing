import { NextResponse } from "next/server";
import { sendAppointmentScheduledEvent } from "@/lib/openai-conversions";
import {
  cleanLine,
  cleanText,
  clientIp,
  contactRecipient,
  createRateLimiter,
  escapeHtml,
  getMailer,
  isEmail,
} from "@/lib/mail";

export const runtime = "nodejs";

const rateLimited = createRateLimiter(8, 10 * 60 * 1000);

export async function POST(request: Request) {
  if (rateLimited(clientIp(request))) {
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

  if (cleanLine(body.website)) {
    return NextResponse.json({ ok: true });
  }

  const name = cleanLine(body.name, 120);
  const note = cleanText(body.note, 1000);
  const email = cleanLine(body.email, 160).toLowerCase();

  if (!name || !note || !email) {
    return NextResponse.json(
      { error: "Tüm alanları doldurun." },
      { status: 400 },
    );
  }

  if (!isEmail(email)) {
    return NextResponse.json(
      { error: "Geçerli bir e-posta adresi girin." },
      { status: 400 },
    );
  }

  const mailer = getMailer();
  if (!mailer) {
    console.error("Contact form: SMTP env vars missing");
    return NextResponse.json(
      { error: "Mail henüz yapılandırılmadı." },
      { status: 500 },
    );
  }

  try {
    await mailer.transporter.sendMail({
      from: mailer.from,
      to: contactRecipient(),
      replyTo: email,
      subject: `Yeni iletişim talebi: ${name}`,
      text: [`İsim: ${name}`, `Not: ${note}`, `Mail: ${email}`].join("\n"),
      html: `
        <p><strong>İsim:</strong> ${escapeHtml(name)}</p>
        <p><strong>Not:</strong> ${escapeHtml(note).replaceAll("\n", "<br>")}</p>
        <p><strong>Mail:</strong> ${escapeHtml(email)}</p>
      `,
    });
  } catch (err) {
    console.error("Contact form send failed", err);
    return NextResponse.json(
      { error: "Mail gönderilemedi. Lütfen daha sonra deneyin." },
      { status: 502 },
    );
  }

  const sourceUrl =
    request.headers.get("referer") ||
    request.headers.get("origin") ||
    "https://593emarketing.com";

  try {
    await sendAppointmentScheduledEvent({ sourceUrl });
  } catch (err) {
    console.error("OpenAI Conversions API failed", err);
  }

  return NextResponse.json({ ok: true });
}
