import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

/**
 * Meta makbuz linki (business.facebook.com/ads/receipt) yalnızca reklam
 * hesabına erişimi olan FB oturumunda açılır; Graph API makbuz PDF’i vermez.
 * Müşteriye senkron edilen çekim verisinden ödeme özeti PDF’i üretilir.
 */
export type MetaReceiptInput = {
  tenantName: string;
  metaAccountId: string;
  transactionId: string;
  amount: number;
  currency: string;
  chargedAt: Date;
  timezone: string;
};

const FONT_PATH = path.join(
  process.cwd(),
  "src/assets/fonts/Geist-Regular.ttf",
);

let fontBytes: Promise<Buffer> | null = null;

function loadFont(): Promise<Buffer> {
  fontBytes ??= readFile(FONT_PATH);
  return fontBytes;
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currencyDisplay: "code",
    currency: currency || "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export async function renderMetaReceiptPdf(
  input: MetaReceiptInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await loadFont(), { subset: true });

  doc.setTitle(`Meta ödeme özeti ${input.transactionId}`);
  doc.setCreator("593 E-Marketing Panel");

  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 56;
  const fg = rgb(0.09, 0.09, 0.11);
  const muted = rgb(0.45, 0.45, 0.5);
  const line = rgb(0.88, 0.88, 0.9);
  const accent = rgb(0.914, 0.094, 0.145);

  let y = height - margin;

  page.drawText("593 E-Marketing", { x: margin, y, size: 11, font, color: accent });
  y -= 30;
  page.drawText("Meta Reklam Ödeme Özeti", { x: margin, y, size: 20, font, color: fg });
  y -= 18;
  page.drawText("Başarılı otomatik kart çekimi", { x: margin, y, size: 10, font, color: muted });
  y -= 28;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: line,
  });
  y -= 30;

  const accountId = input.metaAccountId.replace(/^act_/, "");
  const rows: Array<[string, string]> = [
    ["Reklam hesabı", input.tenantName],
    ["Hesap kimliği", accountId],
    ["İşlem kimliği", input.transactionId],
    ["Tarih", formatDate(input.chargedAt, input.timezone)],
    ["Durum", "Başarılı"],
    ["Para birimi", input.currency],
  ];

  const labelX = margin;
  const valueX = margin + 130;
  const valueMax = width - margin - valueX;
  for (const [label, value] of rows) {
    page.drawText(label, { x: labelX, y, size: 10, font, color: muted });
    page.drawText(value, {
      x: valueX,
      y,
      size: font.widthOfTextAtSize(value, 11) > valueMax ? 9 : 11,
      font,
      color: fg,
    });
    y -= 24;
  }

  y -= 12;
  page.drawRectangle({
    x: margin,
    y: y - 30,
    width: width - margin * 2,
    height: 52,
    color: rgb(0.97, 0.97, 0.98),
    borderColor: line,
    borderWidth: 1,
  });
  page.drawText("Tutar", { x: margin + 16, y: y - 10, size: 11, font, color: muted });
  const total = formatMoney(input.amount, input.currency);
  const totalSize = 18;
  page.drawText(total, {
    x: width - margin - 16 - font.widthOfTextAtSize(total, totalSize),
    y: y - 12,
    size: totalSize,
    font,
    color: fg,
  });

  const note =
    "Bu belge Meta Ads Billing → Transactions verisinden 593 panelinde oluşturulmuş bir ödeme özetidir. " +
    "Resmî Meta makbuzu, reklam hesabına erişimi olan kullanıcılar tarafından Meta Business Suite → " +
    "Faturalama ve ödemeler bölümünden indirilebilir.";
  const noteSize = 8.5;
  const noteMax = width - margin * 2;
  const lines: string[] = [];
  let current = "";
  for (const word of note.split(" ")) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, noteSize) > noteMax && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);

  let noteY = margin + lines.length * 12;
  for (const l of lines) {
    page.drawText(l, { x: margin, y: noteY, size: noteSize, font, color: muted });
    noteY -= 12;
  }

  return doc.save();
}
