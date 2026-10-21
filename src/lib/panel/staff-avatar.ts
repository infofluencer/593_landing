import sharp from "sharp";
import { saveUpload } from "@/lib/storage/uploads";

export const STAFF_AVATAR_SIZE = 256;
export const STAFF_AVATAR_FILE_RE = /^([a-z0-9]+)\.webp$/i;
export const STAFF_AVATAR_DIR = "avatars";

/** Kare kırpar (yüze odaklı), 256×256 WebP kaydeder; cache-busting URL döner. */
export async function saveStaffAvatar(
  userId: string,
  buffer: Buffer,
): Promise<string> {
  const processed = await sharp(buffer, {
    failOn: "error",
    limitInputPixels: 268402689,
  })
    .rotate()
    .resize(STAFF_AVATAR_SIZE, STAFF_AVATAR_SIZE, {
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .webp({ quality: 85 })
    .toBuffer();
  await saveUpload(STAFF_AVATAR_DIR, `${userId}.webp`, processed, "image/webp");
  return `/uploads/${STAFF_AVATAR_DIR}/${userId}.webp?v=${Date.now()}`;
}
