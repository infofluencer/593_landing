import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  S3_SIGNED_URL_TTL,
  s3Delete,
  s3Enabled,
  s3Put,
  s3SignedGetUrl,
} from "@/lib/storage/s3";

/**
 * `uploads/<dir>/<file>` — S3 tanımlıysa bucket’ta `<dir>/<file>` anahtarı,
 * değilse proje kökündeki `uploads/` klasörü. Public URL her iki durumda
 * `/uploads/<dir>/<file>`; route yetkiyi kontrol edip dosyayı verir.
 */

function fsPath(dir: string, file: string): string {
  return path.join(process.cwd(), "uploads", dir, file);
}

export async function saveUpload(
  dir: string,
  file: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  if (s3Enabled()) {
    await s3Put(`${dir}/${file}`, body, contentType);
    return;
  }
  const p = fsPath(dir, file);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, body);
}

export async function deleteUpload(dir: string, file: string): Promise<void> {
  // S3’e geçişten önce diske yazılmış dosyalar da temizlensin.
  try {
    await unlink(fsPath(dir, file));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
  if (s3Enabled()) await s3Delete(`${dir}/${file}`);
}

/** Yerel dosya varsa onu döner; yoksa S3’e imzalı URL ile yönlendirir. */
export async function serveUpload(
  dir: string,
  file: string,
  contentType: string,
): Promise<NextResponse> {
  const local = fsPath(dir, file);
  try {
    await access(local);
    return new NextResponse(await readFile(local), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }

  if (!s3Enabled()) {
    return new NextResponse("Not found", { status: 404 });
  }
  const url = await s3SignedGetUrl(`${dir}/${file}`);
  return NextResponse.redirect(url, {
    status: 302,
    headers: {
      // İmza süresinden kısa: tarayıcı yönlendirmeyi süresi dolmadan yeniler.
      "Cache-Control": `private, max-age=${S3_SIGNED_URL_TTL - 60}`,
    },
  });
}
