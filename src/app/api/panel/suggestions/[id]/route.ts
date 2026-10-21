import { NextResponse } from "next/server";
import type { SuggestionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermissionApi } from "@/lib/panel/staff-auth";
import {
  SUGGESTION_STATUSES,
  serializeSuggestion,
  suggestionSelect,
} from "@/lib/panel/suggestions";

export const runtime = "nodejs";

const STATUSES = new Set<SuggestionStatus>(SUGGESTION_STATUSES.map((s) => s.value));

/** PATCH — durum güncelle (yalnızca admin). */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermissionApi("suggestions.view");
  if (error) return error;

  const { id } = await ctx.params;
  let body: { status?: SuggestionStatus };
  try {
    body = (await request.json()) as { status?: SuggestionStatus };
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }
  if (!body.status || !STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
  }

  const exists = await prisma.suggestion.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Öneri bulunamadı" }, { status: 404 });
  }
  const updated = await prisma.suggestion.update({
    where: { id },
    data: { status: body.status },
    select: suggestionSelect,
  });
  return NextResponse.json({ suggestion: serializeSuggestion(updated) });
}

/** DELETE — öneriyi sil (yalnızca admin). */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermissionApi("suggestions.view");
  if (error) return error;

  const { id } = await ctx.params;
  await prisma.suggestion.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
