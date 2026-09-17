import {
  OPENAI_APPOINTMENT_EVENT,
  OPENAI_PIXEL_ID,
} from "@/lib/openai-pixel";

/** Server-side Conversions API: Randevu planlandı */
export async function sendAppointmentScheduledEvent(opts: {
  sourceUrl: string;
  eventId?: string;
}) {
  const apiKey = process.env.OPENAI_BZR_API_KEY?.trim();
  if (!apiKey) return { skipped: true as const };

  const pixelId =
    process.env.OPENAI_PIXEL_ID?.trim() || OPENAI_PIXEL_ID;
  const eventId = opts.eventId || crypto.randomUUID();
  const url = `https://bzr.openai.com/v1/events?pid=${encodeURIComponent(pixelId)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      validate_only: false,
      events: [
        {
          id: eventId,
          type: OPENAI_APPOINTMENT_EVENT,
          timestamp_ms: Date.now(),
          source_url: opts.sourceUrl,
          action_source: "web",
          data: { type: "customer_action" },
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OpenAI Conversions API ${res.status}: ${body.slice(0, 300)}`,
    );
  }

  return { ok: true as const, eventId };
}
