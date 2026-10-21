import { NextResponse } from "next/server";
import { sendTestWhatsApp, whatsappConfigured } from "@/lib/panel/notify";
import { requireStaffApi } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

/** POST {phone} — WhatsApp kanalını doğrulamak için şablon test mesajı. */
export async function POST(request: Request) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;
  if (!whatsappConfigured()) {
    return NextResponse.json(
      { error: "WhatsApp tanımlı değil: sunucuda WHATSAPP_ACCESS_TOKEN ve WHATSAPP_PHONE_NUMBER_ID gerekli." },
      { status: 503 },
    );
  }
  let body: { phone?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }
  try {
    const r = await sendTestWhatsApp({
      to: String(body.phone ?? ""),
      byEmail: session.user.email ?? null,
    });
    return NextResponse.json({ ok: true, messageId: r.messageId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
