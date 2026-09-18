import { NextResponse } from "next/server";
import { ensureAgencyBoard, serializeBoardCard } from "@/lib/panel/board";
import { requireStaffApi } from "@/lib/panel/staff-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function serializeBoard(
  boardRaw: Awaited<ReturnType<typeof ensureAgencyBoard>>,
) {
  return {
    id: boardRaw.id,
    name: boardRaw.name,
    columns: boardRaw.columns.map((col) => ({
      id: col.id,
      name: col.name,
      position: col.position,
      color: col.color,
      cards: col.cards.map((card) => serializeBoardCard(card)),
    })),
  };
}

/** GET — ajans durum tablosu + staff + ekipler + markalar. */
export async function GET() {
  const { error } = await requireStaffApi();
  if (error) return error;

  const [boardRaw, staff, teams, tenants] = await Promise.all([
    ensureAgencyBoard(),
    prisma.user.findMany({
      where: { role: { in: ["admin", "team"] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
    prisma.team.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        members: { select: { userId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.tenant.findMany({
      where: { visible: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    board: serializeBoard(boardRaw),
    staff,
    teams,
    tenants,
  });
}

type PatchBody = {
  /** Kolon sırası (boardColumn.position güncelle). */
  columnOrder?: string[];
};

/** PATCH — kolon sıralama. */
export async function PATCH(request: Request) {
  const { error } = await requireStaffApi();
  if (error) return error;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  if (!Array.isArray(body.columnOrder) || body.columnOrder.length === 0) {
    return NextResponse.json(
      { error: "columnOrder gerekli" },
      { status: 400 },
    );
  }

  const board = await ensureAgencyBoard();
  const known = new Set(board.columns.map((c) => c.id));
  if (
    body.columnOrder.length !== known.size ||
    body.columnOrder.some((id) => !known.has(id))
  ) {
    return NextResponse.json(
      { error: "Geçersiz kolon listesi" },
      { status: 400 },
    );
  }

  await prisma.$transaction(
    body.columnOrder.map((id, position) =>
      prisma.boardColumn.update({
        where: { id },
        data: { position },
      }),
    ),
  );

  const fresh = await ensureAgencyBoard();
  return NextResponse.json({ board: serializeBoard(fresh) });
}
