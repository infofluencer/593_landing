-- Aksiyon maddelerinde çoklu sorumlu
CREATE TABLE "MeetingActionItemAssignee" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingActionItemAssignee_pkey" PRIMARY KEY ("id")
);

-- Migrate single assignee → join rows
INSERT INTO "MeetingActionItemAssignee" ("id", "itemId", "userId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text), "id", "assigneeId", CURRENT_TIMESTAMP
FROM "MeetingActionItem"
WHERE "assigneeId" IS NOT NULL;

CREATE UNIQUE INDEX "MeetingActionItemAssignee_itemId_userId_key" ON "MeetingActionItemAssignee"("itemId", "userId");
CREATE INDEX "MeetingActionItemAssignee_userId_idx" ON "MeetingActionItemAssignee"("userId");

ALTER TABLE "MeetingActionItemAssignee" ADD CONSTRAINT "MeetingActionItemAssignee_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MeetingActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingActionItemAssignee" ADD CONSTRAINT "MeetingActionItemAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old single-assignee FK + column + index
DROP INDEX IF EXISTS "MeetingActionItem_assigneeId_idx";
ALTER TABLE "MeetingActionItem" DROP CONSTRAINT IF EXISTS "MeetingActionItem_assigneeId_fkey";
ALTER TABLE "MeetingActionItem" DROP COLUMN IF EXISTS "assigneeId";
