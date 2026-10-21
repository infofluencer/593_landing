import { NextResponse } from "next/server";
import {
  STAFF_AVATAR_DIR,
  STAFF_AVATAR_FILE_RE,
} from "@/lib/panel/staff-avatar";
import { requireStaffApi } from "@/lib/panel/staff-auth";
import { serveUpload } from "@/lib/storage/uploads";

export const runtime = "nodejs";

/** Ekip üyesi profil fotoğrafları — yalnızca staff görebilir. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { error } = await requireStaffApi();
  if (error) return error;

  const { file } = await ctx.params;
  if (!STAFF_AVATAR_FILE_RE.test(file)) {
    return new NextResponse("Not found", { status: 404 });
  }
  return serveUpload(STAFF_AVATAR_DIR, file, "image/webp");
}
