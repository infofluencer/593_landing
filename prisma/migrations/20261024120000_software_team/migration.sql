-- Sabit ekiplere Yazılım eklenir.
INSERT INTO "Team" ("id", "name", "slug", "description", "color", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('team_yazilim', 'Yazılım', 'yazilim', 'Web sitesi, entegrasyon ve panel geliştirme', '#0F766E', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "color" = EXCLUDED."color",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;
