import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { boardCardInclude, serializeBoardCard } from "@/lib/panel/board";
import {
  BOARD_IMAGE_MAX_BYTES,
  BOARD_IMAGE_MAX_PER_CARD,
  BOARD_IMAGE_TYPES,
  deleteBoardImageFiles,
  saveBoardImage,
} from "@/lib/panel/board-images";
import { requireStaffApi, resolveStaffUserId } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

function isUploadBlob(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).size === "number"
  );
}

async function cardResponse(id: string) {
  const card = await prisma.boardCard.findUnique({
    where: { id },
    include: boardCardInclude,
  });
  return NextResponse.json({ card: card ? serializeBoardCard(card) : null });
}

/** POST — karta referans görseli ekle (multipart `file`). */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;

  const { id } = await ctx.params;
  const existing = await prisma.boardCard.findUnique({
    where: { id },
    select: { id: true, images: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Kart bulunamadı" }, { status: 404 });
  }
  if (existing.images.length >= BOARD_IMAGE_MAX_PER_CARD) {
    return NextResponse.json(
      { error: `Bir karta en fazla ${BOARD_IMAGE_MAX_PER_CARD} görsel eklenebilir` },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Form verisi gerekli" }, { status: 400 });
  }

  const file = form.get("file");
  if (!isUploadBlob(file) || file.size === 0) {
    return NextResponse.json({ error: "Görsel seçin" }, { status: 400 });
  }
  if (file.size > BOARD_IMAGE_MAX_BYTES) {
    return NextResponse.json(
      { error: "Dosya en fazla 8 MB olabilir" },
      { status: 400 },
    );
  }
  if (file.type && !BOARD_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "JPG, PNG, WebP veya GIF yükleyin" },
      { status: 400 },
    );
  }

  let url: string;
  try {
    url = await saveBoardImage(id, Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Görsel işlenemedi: ${message}` },
      { status: 400 },
    );
  }

  const actorId = await resolveStaffUserId(session);
  await prisma.$transaction([
    prisma.boardCard.update({
      where: { id },
      data: { images: { push: url } },
    }),
    prisma.boardCardActivity.create({
      data: { cardId: id, actorId, type: "image", message: "Görsel eklendi" },
    }),
  ]);

  return cardResponse(id);
}

/** DELETE ?url=… — görseli kaldır. */
export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;

  const { id } = await ctx.params;
  const url = new URL(request.url).searchParams.get("url") ?? "";
  const existing = await prisma.boardCard.findUnique({
    where: { id },
    select: { images: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Kart bulunamadı" }, { status: 404 });
  }
  if (!existing.images.includes(url)) {
    return NextResponse.json({ error: "Görsel bulunamadı" }, { status: 404 });
  }

  const actorId = await resolveStaffUserId(session);
  await prisma.$transaction([
    prisma.boardCard.update({
      where: { id },
      data: { images: existing.images.filter((u) => u !== url) },
    }),
    prisma.boardCardActivity.create({
      data: { cardId: id, actorId, type: "image", message: "Görsel kaldırıldı" },
    }),
  ]);
  await deleteBoardImageFiles([url]);

  return cardResponse(id);
}
