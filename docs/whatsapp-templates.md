# WhatsApp bildirim şablonları

Panel, her uyarı türü için ayrı bir onaylı şablon kullanır. Şablonlar **WhatsApp
Manager → Message templates** altında aşağıdaki adlarla, **Utility** kategorisinde,
**Türkçe (tr)** dilinde oluşturulur. Gövdedeki `{{n}}` sırası koddaki parametre
sırasıyla birebirdir (`src/lib/panel/notify.ts` → `buildAlertTemplate`).

Ortak ayarlar — her şablonda:

- **Header (metin):** `593 Panel · Uyarı`
- **Footer:** `Uyarıyı panelden "Çözüldü" işaretleyince bildirim durur.`
- **Button (URL, dinamik):** metin `Markayı aç`, URL `https://admin.593emarketing.com/brands/{{1}}`
  (dinamik son ek = marka slug'ı; kod otomatik gönderir)

Ad öneki env ile değiştirilebilir: `WHATSAPP_TEMPLATE_PREFIX` (varsayılan `panel_`).
Türe özel şablon Meta'da yoksa kod otomatik olarak genel `panel_alert`'e düşer.

---

## 1. `panel_odeme` — Reklam ödemesi / hesap sorunu
Tipler: `payment_meta`, `payment_google` → Meta / Google ekibi + marka sorumlusu

```
🔴 Reklam ödemesi sorunu — {{1}}

Platform: {{2}}
Hesap durumu: {{3}}
{{4}}

Reklamlar durmuş olabilir. Ödeme yöntemini ve hesap durumunu hemen kontrol edin.
Kontrol zamanı: {{5}}
```
Örnek: `BAHEX İNSTA` · `Meta` · `Ödenmemiş bakiye` · `Ödeme riski — kart reddedildi` · `19.10 14:05`

## 2. `panel_harcama` — Harcama durdu
Tipler: `spend_stopped_meta`, `spend_stopped_google`

```
⏸️ Harcama durdu — {{1}}

Platform: {{2}}
{{3}} gündür harcama yok · son harcama {{4}}
Tespit edilen sebep: {{5}}

Planlı bütçesi olan bir markada reklam çıkmıyor; kampanya durumunu ve hesabı kontrol edin.
```
Örnek: `BAHEX İNSTA` · `Google Ads` · `12` · `07.10` · `Aktif kampanya yok`

## 3. `panel_butce` — Bütçe aşıldı
Tip: `budget_over` → marka sorumlusu

```
💸 Bütçe aşıldı — {{1}}

Dönem: {{2}}
Harcanan: {{3}}
Planlanan: {{4}}
Kullanım: {{5}}

Harcama planı geçti; kampanya bütçelerini düşürün ya da planı güncelleyin.
```
Örnek: `BAHEX İNSTA` · `Ekim 2026` · `₺61.200` · `₺60.000` · `%102`

## 4. `panel_maliyet` — Lead / satış maliyeti hedefi aşıldı
Tip: `cpl_over` → marka sorumlusu

```
📈 Maliyet hedefi aşıldı — {{1}}

{{2}}: {{3}}
Hedef: {{4}}
Dönem: {{5}}

Kampanya ve kreatif performansını gözden geçirin; hedef dışı harcama birikiyor.
```
Örnek: `BAHEX İNSTA` · `Lead maliyeti` · `₺58` · `₺40` · `Ekim 2026`

## 5. `panel_veri` — Veri çekimi / erişim sorunu
Tipler: `sync_error`, `sync_error_meta`, `sync_error_ga4`, `missing_mapping`
(Google Ads), `missing_mapping_meta`, `missing_mapping_ga4`, `missing_mapping_gtm`,
`missing_mapping_gsc`, `token_expired_meta`, `token_expired_google` → ilgili ekip

```
🔌 Veri çekilemiyor — {{1}}

Platform: {{2}}
Sorun: {{3}}
Yapılacak: {{4}}
Sorumlu ekip: {{5}}

Panelde bu platformun rakamları güncellenmiyor; müşteri eski veri görüyor.
```
Örnek: `BAHEX İNSTA` · `Google Ads` · `API erişim süresi doldu / token geçersiz` · `Google OAuth yetkisini yenileyin (refresh token)` · `Google ekibi`

## 6. `panel_olcum` — Ölçüm / kurulum sorunu
Tipler: `conv_dropout`, `setup_missing`, `site_tag_verify` → Analytics ekibi

```
🎯 Ölçüm sorunu — {{1}}

Konu: {{2}}
Detay: {{3}}
Yapılacak: {{4}}
Sorumlu ekip: {{5}}

Dönüşümler sayılmıyor ya da kurulum eksik; optimizasyon yanlış veriyle ilerler.
```
Örnek: `BAHEX İNSTA` · `Kurulum eksik` · `Meta CAPI: olaylar yalnızca tarayıcıdan geliyor` · `Marka detayındaki kurulum kontrol listesinden eksikleri tamamlayın` · `Analytics ekibi`

## 7. `panel_alert` — Genel (yedek + test mesajı)
Türe özel şablon bulunamazsa ve Ekip sayfasındaki "Test mesajı gönder" için.

```
ℹ️ {{1}}

{{2}}
{{3}}
```
Örnek: `593 Panel` · `Test bildirimi · Ajans` · `WhatsApp bildirim kanalı çalışıyor.`

---

## Onay notları
- Parametreler satır sonu içeremez; kod boşluğa çevirir ve 300 karakterde keser.
- Utility kategorisi işlem/uyarı bildirimi içindir; pazarlama cümlesi eklenirse Meta
  kategoriyi Marketing'e çevirir (daha pahalı). Metinleri olduğu gibi kullanın.
- Örnek değerleri Meta ister; yukarıdaki örnekleri girin.
- Uygulama geliştirme modundaysa yalnızca "test numaraları"na gider; Live mod için
  işletme doğrulaması gerekir.
