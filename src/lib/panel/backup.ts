import type { Prisma } from "@prisma/client";
import { istanbulYmd } from "@/lib/date/tr";
import { prisma } from "@/lib/db";
import { ensureAgencyBoard } from "@/lib/panel/board";
import { deleteUpload, readUpload, saveUpload } from "@/lib/storage/uploads";

/**
 * Panel içi, elle girilen verilerin JSON yedeği. Reklam metrikleri (Meta,
 * Google, GA4) API’den yeniden çekilebildiği için yedeğe girmez; loglar da
 * (audit, sync, bildirim) alınmaz.
 */

export const BACKUP_DIR = "backups";
export const BACKUP_VERSION = 1;
/** Otomatik (cron) yedeklerden en fazla bu kadar tutulur; elle alınanlar silinmez. */
export const BACKUP_CRON_KEEP = 30;

export type BackupTrigger = "manual" | "cron";

export type BackupCounts = Record<string, number>;

export type SerializedBackup = {
  id: string;
  trigger: BackupTrigger;
  createdAt: string;
  createdByEmail: string | null;
  counts: BackupCounts;
  sizeBytes: number;
};

export const backupSelect = {
  id: true,
  trigger: true,
  createdAt: true,
  createdByEmail: true,
  counts: true,
  sizeBytes: true,
} as const;

type BackupRow = Prisma.BackupGetPayload<{ select: typeof backupSelect }>;

export function serializeBackup(row: BackupRow): SerializedBackup {
  return {
    id: row.id,
    trigger: row.trigger === "cron" ? "cron" : "manual",
    createdAt: row.createdAt.toISOString(),
    createdByEmail: row.createdByEmail,
    counts: (row.counts ?? {}) as BackupCounts,
    sizeBytes: row.sizeBytes,
  };
}

export function backupFile(id: string): string {
  return `${id}.json`;
}

export function backupFileName(b: { id: string; createdAt: string }): string {
  const stamp = b.createdAt.slice(0, 19).replace(/[:T]/g, "-");
  return `593-yedek-${stamp}-${b.id.slice(-6)}.json`;
}

/* ───────────── Anlık görüntü ───────────── */

export async function buildSnapshot(trigger: BackupTrigger) {
  const [users, teams, tenants, board, notes, meetings, contentPosts, suggestions] =
    await Promise.all([
      prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true },
        orderBy: { email: "asc" },
      }),
      prisma.team.findMany({
        select: { id: true, slug: true, name: true, color: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.tenant.findMany({
        select: { id: true, slug: true, name: true, type: true, visible: true },
        orderBy: { name: "asc" },
      }),
      prisma.board.findFirst({
        orderBy: { createdAt: "asc" },
        include: {
          columns: {
            orderBy: { position: "asc" },
            include: {
              cards: {
                orderBy: { position: "asc" },
                include: {
                  assignees: { select: { userId: true, createdAt: true } },
                  activities: { orderBy: { createdAt: "asc" } },
                },
              },
            },
          },
        },
      }),
      prisma.brandNote.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.meeting.findMany({
        orderBy: { startsAt: "asc" },
        include: {
          attendees: { select: { userId: true, createdAt: true } },
          actionItems: {
            orderBy: { position: "asc" },
            include: { assignees: { select: { userId: true, createdAt: true } } },
          },
        },
      }),
      prisma.contentPost.findMany({ orderBy: { scheduledAt: "asc" } }),
      prisma.suggestion.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

  const cards = board?.columns.reduce((n, c) => n + c.cards.length, 0) ?? 0;
  const counts: BackupCounts = {
    columns: board?.columns.length ?? 0,
    cards,
    notes: notes.length,
    meetings: meetings.length,
    contentPosts: contentPosts.length,
    suggestions: suggestions.length,
  };

  const snapshot = {
    version: BACKUP_VERSION,
    app: "593-panel",
    trigger,
    createdAt: new Date().toISOString(),
    counts,
    /** Kimlikleri okunabilir kılmak ve geri yüklemede eşlemek için. */
    refs: { users, teams, tenants },
    board,
    notes,
    meetings,
    contentPosts,
    suggestions,
  };
  return { snapshot, counts };
}

export type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>["snapshot"];

/* ───────────── Oluştur / listele / sil ───────────── */

export async function createBackup(opts: {
  trigger: BackupTrigger;
  createdById?: string | null;
  createdByEmail?: string | null;
}): Promise<SerializedBackup> {
  const { snapshot, counts } = await buildSnapshot(opts.trigger);
  const row = await prisma.backup.create({
    data: {
      trigger: opts.trigger,
      createdById: opts.createdById ?? null,
      createdByEmail: opts.createdByEmail?.trim().toLowerCase() || null,
      counts,
    },
    select: backupSelect,
  });

  const body = Buffer.from(JSON.stringify(snapshot), "utf8");
  try {
    await saveUpload(BACKUP_DIR, backupFile(row.id), body, "application/json");
  } catch (err) {
    // Dosya yazılamadıysa meta kaydı da kalmasın.
    await prisma.backup.delete({ where: { id: row.id } }).catch(() => undefined);
    throw err;
  }

  const updated = await prisma.backup.update({
    where: { id: row.id },
    data: { sizeBytes: body.byteLength },
    select: backupSelect,
  });
  return serializeBackup(updated);
}

export async function listBackups(limit = 100): Promise<SerializedBackup[]> {
  const rows = await prisma.backup.findMany({
    select: backupSelect,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(serializeBackup);
}

export async function readBackup(id: string): Promise<Buffer | null> {
  return readUpload(BACKUP_DIR, backupFile(id));
}

export async function deleteBackup(id: string): Promise<boolean> {
  const row = await prisma.backup.findUnique({ where: { id }, select: { id: true } });
  if (!row) return false;
  await deleteUpload(BACKUP_DIR, backupFile(id));
  await prisma.backup.delete({ where: { id } });
  return true;
}

/** Eski cron yedeklerini temizler; silinen sayıyı döner. */
export async function pruneCronBackups(keep = BACKUP_CRON_KEEP): Promise<number> {
  const stale = await prisma.backup.findMany({
    where: { trigger: "cron" },
    orderBy: { createdAt: "desc" },
    skip: keep,
    select: { id: true },
  });
  for (const row of stale) {
    await deleteBackup(row.id);
  }
  return stale.length;
}

/**
 * Günlük otomatik yedek — bugün (İstanbul) zaten cron yedeği varsa atlar.
 * Hem instrumentation zamanlayıcısı hem /api/cron/daily-backup çağırır;
 * DB kontrolü yeniden başlatma / çoklu çağrıda tekrarı engeller.
 */
export async function runScheduledBackup(): Promise<
  { skipped: true } | { skipped: false; backup: SerializedBackup; pruned: number }
> {
  const latest = await prisma.backup.findFirst({
    where: { trigger: "cron" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && istanbulYmd(latest.createdAt) === istanbulYmd()) {
    return { skipped: true };
  }
  const backup = await createBackup({ trigger: "cron" });
  const pruned = await pruneCronBackups();
  return { skipped: false, backup, pruned };
}

/* ───────────── Geri yükleme (durum panosu) ───────────── */

export type RestoreResult = {
  createdColumns: number;
  createdCards: number;
  skippedCards: number;
  createdAssignees: number;
  createdActivities: number;
};

type SnapshotBoard = NonNullable<Snapshot["board"]>;

function parseSnapshot(buf: Buffer): Snapshot {
  const parsed = JSON.parse(buf.toString("utf8")) as Partial<Snapshot>;
  if (parsed.app !== "593-panel" || typeof parsed.version !== "number") {
    throw new Error("Geçersiz yedek dosyası");
  }
  if (parsed.version > BACKUP_VERSION) {
    throw new Error(`Yedek sürümü (${parsed.version}) bu panelden yeni`);
  }
  return parsed as Snapshot;
}

const toDate = (v: unknown): Date | null =>
  typeof v === "string" || v instanceof Date ? new Date(v) : null;

/**
 * Yedekteki panoyu mevcut panoyla birleştirir — silinmiş kolon ve kartları
 * geri getirir, var olan hiçbir kaydı değiştirmez veya silmez. Artık var
 * olmayan kullanıcı / ekip / marka referansları boş bırakılır.
 */
export async function restoreBoardFromBackup(id: string): Promise<RestoreResult> {
  const buf = await readBackup(id);
  if (!buf) throw new Error("Yedek dosyası bulunamadı");
  const snapshot = parseSnapshot(buf);
  const src = snapshot.board as SnapshotBoard | null;
  if (!src) throw new Error("Yedekte pano verisi yok");

  const board = await ensureAgencyBoard();
  const result: RestoreResult = {
    createdColumns: 0,
    createdCards: 0,
    skippedCards: 0,
    createdAssignees: 0,
    createdActivities: 0,
  };

  const [users, teams, tenants, alerts, existingCards] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    prisma.team.findMany({ select: { id: true } }),
    prisma.tenant.findMany({ select: { id: true } }),
    prisma.alert.findMany({ select: { id: true } }),
    prisma.boardCard.findMany({ select: { id: true } }),
  ]);
  const userIds = new Set(users.map((u) => u.id));
  const teamIds = new Set(teams.map((t) => t.id));
  const tenantIds = new Set(tenants.map((t) => t.id));
  const alertIds = new Set(alerts.map((a) => a.id));
  const cardIds = new Set(existingCards.map((c) => c.id));
  const keep = (set: Set<string>, v: string | null | undefined) =>
    v && set.has(v) ? v : null;

  await prisma.$transaction(async (tx) => {
    // Kolon eşleme: id → mevcut; yoksa aynı adlı; yoksa yeni.
    const byId = new Map(board.columns.map((c) => [c.id, c.id]));
    const byName = new Map(
      board.columns.map((c) => [c.name.trim().toLowerCase(), c.id]),
    );
    let nextPos =
      board.columns.reduce((m, c) => Math.max(m, c.position), -1) + 1;
    const columnMap = new Map<string, string>();
    for (const col of src.columns) {
      const existing = byId.get(col.id) ?? byName.get(col.name.trim().toLowerCase());
      if (existing) {
        columnMap.set(col.id, existing);
        continue;
      }
      const created = await tx.boardColumn.create({
        data: {
          id: col.id,
          boardId: board.id,
          name: col.name,
          color: col.color ?? null,
          position: nextPos++,
        },
        select: { id: true },
      });
      columnMap.set(col.id, created.id);
      byName.set(col.name.trim().toLowerCase(), created.id);
      result.createdColumns += 1;
    }

    const cards: Prisma.BoardCardCreateManyInput[] = [];
    const assignees: Prisma.BoardCardAssigneeCreateManyInput[] = [];
    const activities: Prisma.BoardCardActivityCreateManyInput[] = [];
    for (const col of src.columns) {
      const columnId = columnMap.get(col.id)!;
      for (const card of col.cards) {
        if (cardIds.has(card.id)) {
          result.skippedCards += 1;
          continue;
        }
        cards.push({
          id: card.id,
          columnId,
          title: card.title,
          description: card.description ?? null,
          position: card.position,
          priority: card.priority,
          teamId: keep(teamIds, card.teamId),
          tenantId: keep(tenantIds, card.tenantId),
          dueAt: toDate(card.dueAt),
          labels: card.labels ?? [],
          images: card.images ?? [],
          sourceAlertId: keep(alertIds, card.sourceAlertId),
          createdById: keep(userIds, card.createdById),
          createdAt: toDate(card.createdAt) ?? undefined,
          updatedAt: toDate(card.updatedAt) ?? undefined,
        });
        for (const a of card.assignees ?? []) {
          if (!userIds.has(a.userId)) continue;
          assignees.push({
            cardId: card.id,
            userId: a.userId,
            createdAt: toDate(a.createdAt) ?? undefined,
          });
        }
        for (const act of card.activities ?? []) {
          activities.push({
            id: act.id,
            cardId: card.id,
            actorId: keep(userIds, act.actorId),
            type: act.type,
            message: act.message ?? null,
            meta: (act.meta ?? {}) as Prisma.InputJsonValue,
            createdAt: toDate(act.createdAt) ?? undefined,
          });
        }
      }
    }

    if (cards.length) {
      const r = await tx.boardCard.createMany({ data: cards, skipDuplicates: true });
      result.createdCards = r.count;
    }
    if (assignees.length) {
      const r = await tx.boardCardAssignee.createMany({
        data: assignees,
        skipDuplicates: true,
      });
      result.createdAssignees = r.count;
    }
    if (activities.length) {
      const r = await tx.boardCardActivity.createMany({
        data: activities,
        skipDuplicates: true,
      });
      result.createdActivities = r.count;
    }
  });

  return result;
}
