import { prisma } from "@/lib/db";

const WHATSAPP_ENABLED_KEY = "whatsapp.enabled";

/**
 * WhatsApp ana anahtarı. Kayıt yoksa veya okunamazsa kapalı sayılır: env eklendi
 * diye açık uyarılar kendiliğinden toplu gönderilmesin; açma kararı admindedir.
 */
export async function whatsappEnabled(): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: WHATSAPP_ENABLED_KEY },
      select: { value: true },
    });
    return row?.value === true;
  } catch (err) {
    console.error("[notify] whatsapp.enabled okunamadı", err);
    return false;
  }
}

export async function setWhatsappEnabled(enabled: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: WHATSAPP_ENABLED_KEY },
    create: { key: WHATSAPP_ENABLED_KEY, value: enabled },
    update: { value: enabled },
  });
}
