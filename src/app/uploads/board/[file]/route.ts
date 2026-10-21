import { NextResponse } from "next/server";
import {
  BOARD_IMAGE_DIR,
  BOARD_IMAGE_FILE_RE,
} from "@/lib/panel/board-images";
import { requireStaffApi } from "@/lib/panel/staff-auth";
import { serveUpload } from "@/lib/storage/uploads";

export const runtime = "nodejs";

/** Durum panosu kart görselleri — yalnızca staff görebilir. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { error } = await requireStaffApi();
  if (error) return error;

  const { file } = await ctx.params;
  if (!BOARD_IMAGE_FILE_RE.test(file)) {
    return new NextResponse("Not found", { status: 404 });
  }
  return serveUpload(BOARD_IMAGE_DIR, file, "image/webp");
}
