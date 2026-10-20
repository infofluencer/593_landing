/**
 * Sosyal medya yayın takvimi — marka başına içerik kartı. Grafik Tasarım ve
 * Sosyal Medya ekipleri aynı kartta çalışır; tasarım görevi Durum panosuna bağlanır.
 */
import type { ContentPostStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureAgencyBoard } from "@/lib/panel/board";

export const CONTENT_PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "x",
  "youtube",
] as const;
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

export const PLATFORM_LABEL: Record<ContentPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
};

export const CONTENT_STATUSES: ContentPostStatus[] = ["draft", "design", "review", "published"];

export const STATUS_LABEL: Record<ContentPostStatus, string> = {
  draft: "Taslak",
  design: "Tasarımda",
  review: "Onayda",
  published: "Paylaşıldı",
};

export function isPlatform(v: unknown): v is ContentPlatform {
  return typeof v === "string" && (CONTENT_PLATFORMS as readonly string[]).includes(v);
}

export function isContentStatus(v: unknown): v is ContentPostStatus {
  return typeof v === "string" && (CONTENT_STATUSES as string[]).includes(v);
}

const userSelect = { id: true, name: true, email: true } as const;

export const postInclude = {
  tenant: { select: { id: true, name: true, slug: true } },
  assignee: { select: userSelect },
  designer: { select: userSelect },
  boardCard: { select: { id: true, column: { select: { name: true } } } },
} satisfies Prisma.ContentPostInclude;

export type PostWithRelations = Prisma.ContentPostGetPayload<{ include: typeof postInclude }>;

export type SerializedPost = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  title: string;
  platform: string;
  scheduledAt: string;
  status: ContentPostStatus;
  brief: string;
  caption: string;
  mediaUrls: string[];
  assigneeId: string | null;
  assigneeLabel: string | null;
  designerId: string | null;
  designerLabel: string | null;
  boardCard: { id: string; column: string } | null;
  createdAt: string;
  updatedAt: string;
};

function label(u: { name: string | null; email: string } | null): string | null {
  return u ? u.name || u.email : null;
}

export function serializePost(p: PostWithRelations): SerializedPost {
  return {
    id: p.id,
    tenantId: p.tenantId,
    tenantName: p.tenant.name,
    tenantSlug: p.tenant.slug,
    title: p.title,
    platform: p.platform,
    scheduledAt: p.scheduledAt.toISOString(),
    status: p.status,
    brief: p.brief,
    caption: p.caption,
    mediaUrls: p.mediaUrls,
    assigneeId: p.assigneeId,
    assigneeLabel: label(p.assignee),
    designerId: p.designerId,
    designerLabel: label(p.designer),
    boardCard: p.boardCard ? { id: p.boardCard.id, column: p.boardCard.column.name } : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listContentPosts(opts: {
  from: Date;
  to: Date;
  tenantId?: string | null;
}): Promise<SerializedPost[]> {
  const rows = await prisma.contentPost.findMany({
    where: {
      scheduledAt: { gte: opts.from, lte: opts.to },
      ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
    },
    include: postInclude,
    orderBy: { scheduledAt: "asc" },
    take: 1000,
  });
  return rows.map(serializePost);
}

/**
 * Tasarım görevi: Durum panosunun ilk kolonuna "Tasarım: …" kartı açar,
 * Grafik Tasarım ekibine ve markaya bağlar; teslim tarihi paylaşım zamanıdır.
 */
export async function createDesignCardForPost(opts: {
  postId: string;
  actorId: string | null;
}): Promise<{ cardId: string; created: boolean }> {
  const post = await prisma.contentPost.findUnique({
    where: { id: opts.postId },
    include: { tenant: { select: { name: true } } },
  });
  if (!post) throw new Error("İçerik bulunamadı");
  if (post.boardCardId) return { cardId: post.boardCardId, created: false };

  const [board, designTeam] = await Promise.all([
    ensureAgencyBoard(),
    prisma.team.findUnique({ where: { slug: "grafik-tasarim" }, select: { id: true } }),
  ]);
  const column = board.columns[0];
  if (!column) throw new Error("Durum panosunda kolon yok");
  const maxPos = await prisma.boardCard.aggregate({
    where: { columnId: column.id },
    _max: { position: true },
  });
  const description = [
    post.brief.trim() ? `Brief:\n${post.brief.trim()}` : null,
    post.caption.trim() ? `Metin:\n${post.caption.trim()}` : null,
    post.mediaUrls.length ? `Görsel / video:\n${post.mediaUrls.join("\n")}` : null,
    `Platform: ${PLATFORM_LABEL[post.platform as ContentPlatform] ?? post.platform}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const card = await prisma.boardCard.create({
    data: {
      columnId: column.id,
      title: `Tasarım: ${post.title || post.tenant.name}`,
      description,
      position: (maxPos._max.position ?? -1) + 1,
      teamId: designTeam?.id ?? null,
      tenantId: post.tenantId,
      dueAt: post.scheduledAt,
      labels: ["tasarım", "sosyal medya"],
      createdById: opts.actorId,
      assignees: post.designerId ? { create: [{ userId: post.designerId }] } : undefined,
      activities: {
        create: {
          actorId: opts.actorId,
          type: "created",
          message: "İçerik takviminden oluşturuldu",
          meta: { contentPostId: post.id },
        },
      },
    },
    select: { id: true },
  });
  await prisma.contentPost.update({
    where: { id: post.id },
    data: { boardCardId: card.id, status: post.status === "draft" ? "design" : post.status },
  });
  return { cardId: card.id, created: true };
}
