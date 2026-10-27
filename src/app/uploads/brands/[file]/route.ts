import { NextResponse } from "next/server";
import {
  BRAND_COVER_FILE_RE,
  serveBrandCover,
} from "@/lib/panel/brand-cover";

export const runtime = "nodejs";

/** Marka kapakları — S3 tanımlıysa imzalı URL’ye yönlendirir, değilse diskten verir. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params;
  const match = BRAND_COVER_FILE_RE.exec(file);
  if (!match) {
    return new NextResponse("Not found", { status: 404 });
  }
  return serveBrandCover(match[1]);
}
