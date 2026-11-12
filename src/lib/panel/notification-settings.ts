import { prisma } from "@/lib/db";

const WHATSAPP_ENABLED_KEY = "whatsapp.enabled";

/**
 * WhatsApp ana anahtarı. Kayıt yoksa veya okunamazsa kapalı sayılır: env eklendi
 * diye açık uyarılar kendiliğinden toplu gönderilmesin; açma kararı admindedir.
 */
const WHATSAPP_START_AT_KEY = "whatsapp.startAt";

export type WhatsappSwitch = {
  /** Anahtar açık mı (başlangıç saati gelmemiş olsa bile). */
  on: boolean;
  /** Planlı başlangıç (ISO). Geçmişte veya yoksa null. */
  startAt: string | null;
};

export async function whatsappSwitch(): Promise<WhatsappSwitch> {
  try {
    const rows = await prisma.appSetting.findMany({
      where: { key: { in: [WHATSAPP_ENABLED_KEY, WHATSAPP_START_AT_KEY] } },
      select: { key: true, value: true },
    });
    const on = rows.find((r) => r.key === WHATSAPP_ENABLED_KEY)?.value === true;
    const raw = rows.find((r) => r.key === WHATSAPP_START_AT_KEY)?.value;
    const at = typeof raw === "string" ? new Date(raw) : null;
    const startAt = at && !Number.isNaN(at.getTime()) && at.getTime() > Date.now() ? at.toISOString() : null;
    return { on, startAt };
  } catch (err) {
    console.error("[notify] whatsapp.enabled okunamadı", err);
    return { on: false, startAt: null };
  }
}

/** Gönderim için: anahtar açık ve planlı başlangıç saati geldiyse true. */
export async function whatsappEnabled(): Promise<boolean> {
  const s = await whatsappSwitch();
  return s.on && s.startAt === null;
}

/**
 * Bir sonraki sabah kontrolünden hemen önce (İstanbul 08:55). Türkiye UTC+3
 * sabit; 09:00 günlük senkronun ürettiği uyarılar bu saatten sonra gider.
 */
export function nextMorningStart(now = new Date()): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const today = new Date(`${ymd}T08:55:00+03:00`);
  return today.getTime() > now.getTime() ? today : new Date(today.getTime() + 24 * 3_600_000);
}

export async function setWhatsappEnabled(
  enabled: boolean,
  startAt: Date | null = null,
): Promise<void> {
  const at = enabled && startAt ? startAt.toISOString() : null;
  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: WHATSAPP_ENABLED_KEY },
      create: { key: WHATSAPP_ENABLED_KEY, value: enabled },
      update: { value: enabled },
    }),
    at
      ? prisma.appSetting.upsert({
          where: { key: WHATSAPP_START_AT_KEY },
          create: { key: WHATSAPP_START_AT_KEY, value: at },
          update: { value: at },
        })
      : prisma.appSetting.deleteMany({ where: { key: WHATSAPP_START_AT_KEY } }),
  ]);
}

const EMAIL_ALERTS_ENABLED_KEY = "email.alerts.enabled";

/**
 * Uyarıların e-posta yedeği. Kayıt yoksa kapalı: uyarılar yalnızca WhatsApp'tan
 * gider. (Marka rapor e-postaları bu anahtardan etkilenmez.)
 */
export async function emailAlertsEnabled(): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: EMAIL_ALERTS_ENABLED_KEY },
      select: { value: true },
    });
    return row?.value === true;
  } catch (err) {
    console.error("[notify] email.alerts.enabled okunamadı", err);
    return false;
  }
}

export async function setEmailAlertsEnabled(enabled: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: EMAIL_ALERTS_ENABLED_KEY },
    create: { key: EMAIL_ALERTS_ENABLED_KEY, value: enabled },
    update: { value: enabled },
  });
}
