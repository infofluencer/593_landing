-- Panel verisi yedekleri (JSON dosyası S3'te, meta burada)
CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "counts" JSONB NOT NULL DEFAULT '{}',
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Backup_createdAt_idx" ON "Backup"("createdAt");

ALTER TABLE "Backup" ADD CONSTRAINT "Backup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
