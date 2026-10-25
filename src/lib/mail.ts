import nodemailer, { type Transporter } from "nodemailer";

/**
 * Site formları (iletişim, kariyer) için ortak SMTP taşıyıcısı.
 * Env: SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT (465), SMTP_SECURE.
 */

export type Mailer = {
  transporter: Transporter;
  from: string;
};

export function getMailer(): Mailer | null {
  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  const port = Number(process.env["SMTP_PORT"] || 465);
  const secure = process.env["SMTP_SECURE"] !== "false" && port === 465;

  if (!host || !user || !pass) return null;

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    }),
    from: `"593 Web" <${user}>`,
  };
}

export function contactRecipient(): string {
  return process.env["CONTACT_TO"] || "info@593emarketing.com";
}

export function careerRecipient(): string {
  return process.env["CAREER_TO"] || contactRecipient();
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Satır sonlarını ve null byte'ı temizler, tek satıra indirir. */
export function cleanLine(value: unknown, max = 120) {
  return String(value ?? "")
    .replace(/[\r\n\0]/g, " ")
    .trim()
    .slice(0, max);
}

/** Çok satırlı metin; sadece null byte ve CRLF normalize edilir. */
export function cleanText(value: unknown, max = 1000) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Bellek içi, IP başına basit oran sınırı. */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string) => {
    const now = Date.now();
    const slot = hits.get(key);
    if (!slot || now > slot.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }
    slot.count += 1;
    return slot.count > limit;
  };
}

export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}
