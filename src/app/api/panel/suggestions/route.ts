import { NextResponse } from "next/server";
import type { SuggestionKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaffApi, resolveStaffUserId } from "@/lib/panel/staff-auth";
import {
  SUGGESTION_BODY_MAX,
  SUGGESTION_KINDS,
  serializeSuggestion,
  suggestionSelect,
} from "@/lib/panel/suggestions";

export const runtime = "nodejs";

const KINDS = new Set<SuggestionKind>(SUGGESTION_KINDS.map((k) => k.value));

type PostBody = {
  kind?: SuggestionKind;
  body?: string;
  /** true → gönderen hiç kaydedilmez. */
  anonymous?: boolean;
};

/** POST — öneri gönder (tüm staff). Gelenleri yalnızca admin görür. */
export async function POST(request: Request) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (text.length < 3) {
    return NextResponse.json({ error: "Biraz daha detay yazın" }, { status: 400 });
  }
  if (text.length > SUGGESTION_BODY_MAX) {
    return NextResponse.json(
      { error: `En fazla ${SUGGESTION_BODY_MAX} karakter` },
      { status: 400 },
    );
  }
  const kind = body.kind && KINDS.has(body.kind) ? body.kind : "idea";
  const authorId = body.anonymous ? null : await resolveStaffUserId(session);

  const created = await prisma.suggestion.create({
    data: { kind, body: text, authorId },
    select: suggestionSelect,
  });
  return NextResponse.json({ ok: true, suggestion: serializeSuggestion(created) });
}
