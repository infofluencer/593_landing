-- Sabit ajans ekipleri: Sosyal Medya, Meta, Analytics, Grafik Tasarım, Google.
ALTER TABLE "Team" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Kreatif → Grafik Tasarım (üyelik + kart bağları korunur)
UPDATE "Team"
SET "name" = 'Grafik Tasarım', "slug" = 'grafik-tasarim'
WHERE "slug" IN ('kreatif', 'creative')
  AND NOT EXISTS (SELECT 1 FROM "Team" WHERE "slug" = 'grafik-tasarim');

INSERT INTO "Team" ("id", "name", "slug", "description", "color", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('team_sosyal_medya', 'Sosyal Medya', 'sosyal-medya', 'İçerik planı, paylaşım ve topluluk yönetimi', '#E1306C', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('team_meta', 'Meta', 'meta', 'Meta reklam operasyonları', '#0866FF', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('team_analytics', 'Analytics', 'analytics', 'GA4, GTM, ölçümleme', '#E37400', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('team_grafik_tasarim', 'Grafik Tasarım', 'grafik-tasarim', 'Kreatif, görsel ve video üretimi', '#7C3AED', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('team_google', 'Google', 'google', 'Google Ads & Search', '#34A853', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "color" = EXCLUDED."color",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;
