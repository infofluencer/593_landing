import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { deleteUpload, saveUpload } from "@/lib/storage/uploads";

export const BOARD_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const BOARD_IMAGE_MAX_PER_CARD = 10;
export const BOARD_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** `{cardId}-{rand}.webp` — kart id’si cuid, rand hex. */
export const BOARD_IMAGE_FILE_RE = /^([a-z0-9]+)-([a-f0-9]+)\.webp$/i;

export const BOARD_IMAGE_DIR = "board";
const PUBLIC_PREFIX = `/uploads/${BOARD_IMAGE_DIR}/`;

/** `/uploads/board/x.webp` → `x.webp` (geçersizse null). */
export function boardImageFileFromUrl(url: string): string | null {
  if (!url.startsWith(PUBLIC_PREFIX)) return null;
  const file = url.slice(PUBLIC_PREFIX.length);
  return BOARD_IMAGE_FILE_RE.test(file) ? file : null;
}

/** En uzun kenar 1600px, oran korunur; WebP. */
export async function saveBoardImage(
  cardId: string,
  buffer: Buffer,
): Promise<string> {
  const processed = await sharp(buffer, {
    failOn: "error",
    limitInputPixels: 268402689,
  })
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const file = `${cardId}-${randomBytes(6).toString("hex")}.webp`;
  await saveUpload(BOARD_IMAGE_DIR, file, processed, "image/webp");
  return `${PUBLIC_PREFIX}${file}`;
}

export async function deleteBoardImageFiles(urls: string[]): Promise<void> {
  for (const url of urls) {
    const file = boardImageFileFromUrl(url);
    if (file) await deleteUpload(BOARD_IMAGE_DIR, file);
  }
}
