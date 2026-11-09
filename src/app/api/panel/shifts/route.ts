import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/panel/audit";
import {
  isOfficeWeekday,
  normalizeWeekdays,
  toggleWeekday,
  weekdayLabels,
} from "@/lib/panel/office-shifts";
import { requireStaffApi } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

type PutBody = {
  userId?: string;
  weekday?: number;
};

/**
 * PUT { userId, weekday: 1–5 } — o kişinin o hafta gününü ofis / değil olarak çevirir.
 * Her personelin ofis günleri ayrıdır; takvim haftası değil, düzenli program.
 */
export async function PUT(request: Request) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const weekday = body.weekday;
  if (!userId || !isOfficeWeekday(weekday)) {
    return NextResponse.json({ error: "Kişi ve hafta günü gerekli" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, role: { in: ["admin", "team"] }, viewOnly: false },
    select: { id: true, name: true, email: true, officeWeekdays: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Personel bulunamadı" }, { status: 404 });
  }

  const before = normalizeWeekdays(target.officeWeekdays);
  const after = toggleWeekday(before, weekday);
  await prisma.user.update({
    where: { id: userId },
    data: { officeWeekdays: after },
  });

  const label = (target.name ?? "").trim() || target.email;
  await audit(session, {
    action: "office_shift.weekdays",
    entity: "office_shift",
    entityId: userId,
    summary: `${label} ofis günleri: ${weekdayLabels(after)}`,
    before: { officeWeekdays: before },
    after: { officeWeekdays: after },
  });

  return NextResponse.json({
    ok: true,
    userId,
    officeWeekdays: after,
  });
}
