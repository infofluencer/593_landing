-- Durum panosu: "İncelemede" kolonunun hemen önüne "Revize" kolonu ekle.
-- Idempotent: board'da zaten "Revize" kolonu varsa veya "İncelemede" yoksa hiçbir şey yapmaz.
DO $$
DECLARE
  b RECORD;
  review_pos INTEGER;
BEGIN
  FOR b IN SELECT "id" FROM "Board" LOOP
    IF EXISTS (
      SELECT 1 FROM "BoardColumn"
      WHERE "boardId" = b."id" AND lower("name") LIKE 'revize%'
    ) THEN
      CONTINUE;
    END IF;

    SELECT "position" INTO review_pos FROM "BoardColumn"
    WHERE "boardId" = b."id" AND "name" ILIKE '%ncelemede%'
    ORDER BY "position" ASC
    LIMIT 1;

    IF review_pos IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE "BoardColumn"
    SET "position" = "position" + 1
    WHERE "boardId" = b."id" AND "position" >= review_pos;

    INSERT INTO "BoardColumn" ("id", "boardId", "name", "position", "color")
    VALUES ('col_revize_' || substr(md5(b."id"), 1, 12), b."id", 'Revize', review_pos, '#7c3aed');
  END LOOP;
END $$;
