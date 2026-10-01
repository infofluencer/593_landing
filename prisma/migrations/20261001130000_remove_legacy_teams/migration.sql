-- Sabit listede olmayan eski ekipler (örn. Hesap yönetimi). Kart teamId → NULL, üyelikler cascade.
DELETE FROM "Team"
WHERE "slug" NOT IN ('sosyal-medya', 'meta', 'analytics', 'grafik-tasarim', 'google');

-- Demo "593 Team" hesabı
DELETE FROM "User" WHERE "email" = 'team@593emarketing.com';
