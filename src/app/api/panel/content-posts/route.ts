import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/panel/audit";
import {
  isContentStatus,
  isPlatform,
  listContentPosts,
  postInclude,
  serializePost,
} from "@/lib/panel/content-posts";
import {
  requirePermissionApi,
  requireStaffApi,
  resolveStaffUserId,
} from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

function parseDate(v: unknown): Date | null | "invalid" {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

function cleanUrls(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((x) => String(x).trim()).filter((x) => /^https?:\/\//i.test(x)))].slice(0, 20);
}

/** GET — ?from=ISO&to=ISO&tenantId= */
export async function GET(request: Request) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;
  const url = new URL(request.url);
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));
  if (!from || !to || from === "invalid" || to === "invalid") {
    return NextResponse.json({ error: "from / to gerekli" }, { status: 400 });
  }
  const posts = await listContentPosts({
    from,
    to,
    tenantId: url.searchParams.get("tenantId")?.trim() || null,
  });
  return NextResponse.json({ posts });
}

type CreateBody = {
  tenantId?: string;
  title?: string;
  platform?: string;
  scheduledAt?: string;
  status?: string;
  brief?: string;
  caption?: string;
  mediaUrls?: string[];
  assigneeId?: string | null;
  designerId?: string | null;
};

/** POST — yeni içerik kartı. */
export async function POST(request: Request) {
  const { session, error } = await requirePermissionApi("brands.edit");
  if (error || !session) return error;
  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }
  const tenantId = body.tenantId?.trim();
  if (!tenantId) return NextResponse.json({ error: "Marka gerekli" }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) return NextResponse.json({ error: "Marka bulunamadı" }, { status: 400 });
  const scheduledAt = parseDate(body.scheduledAt);
  if (!scheduledAt || scheduledAt === "invalid") {
    return NextResponse.json({ error: "Paylaşım tarihi gerekli" }, { status: 400 });
  }
  const platform = isPlatform(body.platform) ? body.platform : "instagram";
  const status = isContentStatus(body.status) ? body.status : "draft";
  const assigneeId = body.assigneeId?.trim() || null;
  const designerId = body.designerId?.trim() || null;
  const actorId = await resolveStaffUserId(session);

  const post = await prisma.contentPost.create({
    data: {
      tenantId,
      title: body.title?.trim() ?? "",
      platform,
      scheduledAt,
      status,
      brief: body.brief?.trim() ?? "",
      caption: body.caption?.trim() ?? "",
      mediaUrls: cleanUrls(body.mediaUrls),
      assigneeId,
      designerId,
      createdById: actorId,
    },
    include: postInclude,
  });
  await audit(session, {
    action: "content_post.create",
    entity: "content_post",
    entityId: post.id,
    tenantId,
    summary: `${tenant.name}: içerik eklendi (${platform})`,
    after: { title: post.title, platform, scheduledAt, status },
  });
  return NextResponse.json({ post: serializePost(post) }, { status: 201 });
}
