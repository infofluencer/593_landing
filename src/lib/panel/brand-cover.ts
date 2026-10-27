import { access, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { deleteUpload, saveUpload, serveUpload } from "@/lib/storage/uploads";

export const BRAND_COVER_SIZE = 1024;
export const BRAND_COVER_MAX_BYTES = 8 * 1024 * 1024;
export const BRAND_COVER_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Depolama dizini — S3 anahtarı `brands/<tenantId>.webp`, yerelde `uploads/brands/`. */
export const BRAND_COVER_DIR = "brands";
export const BRAND_COVER_FILE_RE = /^([a-z0-9_-]+)\.webp$/i;

function coverFile(tenantId: string): string {
  return `${tenantId}.webp`;
}

export function brandCoverPublicPath(tenantId: string, version?: number): string {
  const base = `/uploads/${BRAND_COVER_DIR}/${coverFile(tenantId)}`;
  return version ? `${base}?v=${version}` : base;
}

/** S3 öncesi `public/uploads/brands/` altına yazılmış eski dosyalar. */
function legacyFsPath(tenantId: string): string {
  return path.join(
    process.cwd(),
    "public",
    "uploads",
    BRAND_COVER_DIR,
    coverFile(tenantId),
  );
}

export async function processBrandCover(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { failOn: "error", limitInputPixels: 268402689 })
    .rotate()
    .resize(BRAND_COVER_SIZE, BRAND_COVER_SIZE, {
      fit: "cover",
      position: "centre",
    })
    .webp({ quality: 82 })
    .toBuffer();
}

/** 1024×1024 WebP işler, S3’e (yoksa yerel diske) yazar; cache-busting URL döner. */
export async function saveBrandCover(
  tenantId: string,
  buffer: Buffer,
): Promise<string> {
  const processed = await processBrandCover(buffer);
  await saveUpload(BRAND_COVER_DIR, coverFile(tenantId), processed, "image/webp");
  return brandCoverPublicPath(tenantId, Date.now());
}

export async function deleteBrandCoverFile(tenantId: string): Promise<void> {
  await deleteUpload(BRAND_COVER_DIR, coverFile(tenantId));
  try {
    await unlink(legacyFsPath(tenantId));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
}

/** Eski `public/` kopyası varsa onu, yoksa `uploads/` → S3 sırasıyla sunar. */
export async function serveBrandCover(tenantId: string): Promise<NextResponse> {
  const legacy = legacyFsPath(tenantId);
  try {
    await access(legacy);
    return new NextResponse(await readFile(legacy), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
  return serveUpload(BRAND_COVER_DIR, coverFile(tenantId), "image/webp");
}
