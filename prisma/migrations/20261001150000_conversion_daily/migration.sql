-- Dönüşüm satırları artık günlük (Google Ads segments.date) ve kesirli.
ALTER TABLE "Conversion" ALTER COLUMN "count" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "Conversion" ALTER COLUMN "count" SET DEFAULT 0;
ALTER TABLE "Conversion" ADD COLUMN "value" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Conversion" ADD COLUMN "category" TEXT;

-- Eski satırlar: tüm sync penceresinin toplamı tek tarihe yazılmıştı (dönem filtresiyle
-- yanlış sonuç verir). Meta türleri artık MetaInsight'tan hesaplanıyor. Sonraki sync
-- Google Ads satırlarını günlük olarak yeniden yazar.
DELETE FROM "Conversion";

-- Google Ads: ikincil dönüşümler dahil toplam (teşhis) + hesap saat dilimi.
ALTER TABLE "GoogleAdsMetric" ADD COLUMN "allConversions" DECIMAL(14,4) NOT NULL DEFAULT 0;
ALTER TABLE "TenantMapping" ADD COLUMN "adsTimezone" TEXT;

-- GA4 artık günlük satır (date boyutu) — eski tek "720 gün özeti" satırları silinir,
-- sonraki tam sync günlük olarak yeniden yazar.
DELETE FROM "Ga4Metric";
ALTER TABLE "Ga4Metric" ADD COLUMN "keyEvents" DECIMAL(14,4);
