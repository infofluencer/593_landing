import { NextResponse } from "next/server";
import { CV_MAX_BYTES, getPosition } from "@/data/positions";
import {
  careerRecipient,
  cleanLine,
  cleanText,
  clientIp,
  createRateLimiter,
  escapeHtml,
  getMailer,
  isEmail,
} from "@/lib/mail";

export const runtime = "nodejs";



const rateLimited = createRateLimiter(5, 10 * 60 * 1000);

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function safeFileName(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

export async function POST(request: Request) {
  if (rateLimited(clientIp(request))) {
    return bad("Çok fazla deneme. Lütfen biraz sonra tekrar deneyin.", 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("Geçersiz istek.");
  }

  // Honeypot: botlar doldurur, insanlar görmez.
  if (cleanLine(form.get("website"))) {
    return NextResponse.json({ ok: true });
  }

  const position = getPosition(cleanLine(form.get("position"), 80));
  if (!position) return bad("Pozisyon bulunamadı.");

  const name = cleanLine(form.get("name"), 120);
  const email = cleanLine(form.get("email"), 160).toLowerCase();
  const phone = cleanLine(form.get("phone"), 40);
  const link = cleanLine(form.get("link"), 300);
  const summary = cleanText(form.get("summary"), 2000);
  const consent = form.get("consent") === "on";

  if (!name || !email || !phone || !summary) {
    return bad("Zorunlu alanları doldurun.");
  }
  if (!isEmail(email)) return bad("Geçerli bir e-posta adresi girin.");
  if (link && !/^https?:\/\/\S+$/i.test(link)) {
    return bad("Bağlantı https:// ile başlamalı.");
  }
  if (!consent) return bad("Aydınlatma metnini onaylamanız gerekiyor.");

  const answers: Array<{ label: string; value: string; required: boolean }> =
    [];
  for (const q of position.screening) {
    const raw = cleanLine(form.get(`q_${q.id}`), 20);
    if (q.kind === "years") {
      const years = Number(raw);
      if (!raw || !Number.isFinite(years) || years < 0 || years > 60) {
        if (q.required) return bad("Deneyim yılını girin.");
        continue;
      }
      answers.push({ label: q.label, value: `${years} yıl`, required: q.required });
    } else {
      if (raw !== "yes" && raw !== "no") {
        if (q.required) return bad("Tüm ön eleme sorularını yanıtlayın.");
        continue;
      }
      answers.push({
        label: q.label,
        value: raw === "yes" ? "Evet" : "Hayır",
        required: q.required,
      });
    }
  }

  const cv = form.get("cv");
  if (!(cv instanceof File) || cv.size === 0) return bad("CV yükleyin.");
  if (cv.size > CV_MAX_BYTES) return bad("CV en fazla 5 MB olabilir.");
  const cvBuffer = Buffer.from(await cv.arrayBuffer());
  const isPdf =
    cvBuffer.subarray(0, 5).toString("latin1") === "%PDF-" &&
    (cv.type === "application/pdf" || cv.type === "");
  if (!isPdf) return bad("CV yalnızca PDF olabilir.");

  const mailer = getMailer();
  if (!mailer) {
    console.error("Career form: SMTP env vars missing");
    return bad("Mail henüz yapılandırılmadı.", 500);
  }

  const lines = [
    `Pozisyon: ${position.title}`,
    `Ad Soyad: ${name}`,
    `E-posta: ${email}`,
    `Telefon: ${phone}`,
    `Bağlantı: ${link || "-"}`,
    "",
    "Ön eleme:",
    ...answers.map(
      (a) => `- ${a.required ? "" : "[tercih] "}${a.label} → ${a.value}`,
    ),
    "",
    "Sektörler ve sorumluluklar:",
    summary,
  ];

  const html = `
    <h2 style="margin:0 0 12px">${escapeHtml(position.title)} başvurusu</h2>
    <p><strong>Ad Soyad:</strong> ${escapeHtml(name)}</p>
    <p><strong>E-posta:</strong> ${escapeHtml(email)}</p>
    <p><strong>Telefon:</strong> ${escapeHtml(phone)}</p>
    <p><strong>Bağlantı:</strong> ${
      link
        ? `<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`
        : "-"
    }</p>
    <h3 style="margin:20px 0 8px">Ön eleme</h3>
    <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
      ${answers
        .map(
          (a) => `<tr>
            <td style="border:1px solid #ddd;vertical-align:top">${
              a.required ? "" : "<em>Tercih · </em>"
            }${escapeHtml(a.label)}</td>
            <td style="border:1px solid #ddd;white-space:nowrap"><strong>${escapeHtml(a.value)}</strong></td>
          </tr>`,
        )
        .join("")}
    </table>
    <h3 style="margin:20px 0 8px">Sektörler ve sorumluluklar</h3>
    <p>${escapeHtml(summary).replaceAll("\n", "<br>")}</p>
    <p style="color:#888;font-size:12px;margin-top:20px">CV ektedir. Aydınlatma metni onaylandı.</p>
  `;

  try {
    await mailer.transporter.sendMail({
      from: mailer.from,
      to: careerRecipient(),
      replyTo: email,
      subject: `Başvuru · ${position.title} · ${name}`,
      text: lines.join("\n"),
      html,
      attachments: [
        {
          filename: safeFileName(cv.name || `${name}-cv.pdf`),
          content: cvBuffer,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (err) {
    console.error("Career form send failed", err);
    return bad("Başvuru gönderilemedi. Lütfen daha sonra deneyin.", 502);
  }

  return NextResponse.json({ ok: true });
}
