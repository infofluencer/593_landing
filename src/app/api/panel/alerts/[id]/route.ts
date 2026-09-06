import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assignAlert, resolveAlert } from "@/lib/panel/alerts-engine";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await request.json()) as {
    action?: "assign" | "resolve";
    assignee?: string;
    note?: string;
  };

  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.action === "assign") {
    if (!body.assignee?.trim()) {
      return NextResponse.json({ error: "assignee required" }, { status: 400 });
    }
    const updated = await assignAlert({
      alertId: id,
      assigneeEmail: body.assignee.trim(),
      by: session.user.email || session.user.id,
    });
    return NextResponse.json({ ok: true, alert: updated });
  }

  if (body.action === "resolve") {
    const updated = await resolveAlert({
      alertId: id,
      by: session.user.email || session.user.id,
      note: body.note,
    });
    return NextResponse.json({ ok: true, alert: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
