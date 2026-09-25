import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const BRAND_COVER_SIZE = 1024;
export const BRAND_COVER_MAX_BYTES = 8 * 1024 * 1024;
export const BRAND_COVER_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function brandCoverPublicPath(tenantId: string, version?: number): string {
  const base = `/uploads/brands/${tenantId}.webp`;
  return version ? `${base}?v=${version}` : base;
}

/** Writable dir outside `public/` — Next does not pick up runtime public writes. */
export function brandCoverFsPath(tenantId: string): string {
  return path.join(process.cwd(), "uploads", "brands", `${tenantId}.webp`);
}

export function brandCoverLegacyFsPath(tenantId: string): string {
  return path.join(
    process.cwd(),
    "public",
    "uploads",
    "brands",
    `${tenantId}.webp`,
  );
}

export async function resolveBrandCoverFsPath(
  tenantId: string,
): Promise<string | null> {
  for (const fsPath of [
    brandCoverFsPath(tenantId),
    brandCoverLegacyFsPath(tenantId),
  ]) {
    try {
      await access(fsPath);
      return fsPath;
    } catch {
      // try next
    }
  }
  return null;
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

async function unlinkQuiet(fsPath: string): Promise<void> {
  try {
    await unlink(fsPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
}

export async function deleteBrandCoverFile(tenantId: string): Promise<void> {
  await unlinkQuiet(brandCoverFsPath(tenantId));
  await unlinkQuiet(brandCoverLegacyFsPath(tenantId));
}
