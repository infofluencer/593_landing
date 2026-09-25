import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { resolveBrandCoverFsPath } from "@/lib/panel/brand-cover";

export const runtime = "nodejs";

const FILE_RE = /^([a-z0-9_-]+)\.webp$/i;

/** Runtime-written covers — public/ is not reliable after `next start`. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params;
  const match = FILE_RE.exec(file);
  if (!match) {
    return new NextResponse("Not found", { status: 404 });
  }

  const fsPath = await resolveBrandCoverFsPath(match[1]);
  if (!fsPath) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const buf = await readFile(fsPath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return new NextResponse("Not found", { status: 404 });
    }
    throw err;
  }
}
