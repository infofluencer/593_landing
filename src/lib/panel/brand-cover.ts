import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const BRAND_COVER_SIZE = 1024;
export const BRAND_COVER_MAX_BYTES = 8 * 1024 * 1024;
export const BRAND_COVER_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function brandCoverPublicPath(tenantId: string, version?: number): string {
  const base = `/uploads/brands/${tenantId}.webp`;
  return version ? `${base}?v=${version}` : base;
}

export function brandCoverFsPath(tenantId: string): string {
  return path.join(
    process.cwd(),
    "public",
    "uploads",
    "brands",
    `${tenantId}.webp`,
  );
}

export async function processBrandCover(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(BRAND_COVER_SIZE, BRAND_COVER_SIZE, {
      fit: "cover",
      position: "attention",
    })
    .webp({ quality: 82 })
    .toBuffer();
}

export async function saveBrandCover(
  tenantId: string,
  buffer: Buffer,
): Promise<string> {
  const processed = await processBrandCover(buffer);
  const fsPath = brandCoverFsPath(tenantId);
  await mkdir(path.dirname(fsPath), { recursive: true });
  await writeFile(fsPath, processed);
  return brandCoverPublicPath(tenantId, Date.now());
}

export async function deleteBrandCoverFile(tenantId: string): Promise<void> {
  try {
    await unlink(brandCoverFsPath(tenantId));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
}
