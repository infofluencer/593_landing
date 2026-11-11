# WhatsApp bildirim şablonları

Panel, her uyarı türü için ayrı bir onaylı şablon kullanır. Kullanılan set **`uyari_`**
önekli, emojisiz yedi şablondur (WABA `1263053265615370`, dil **tr**). Hepsi onaylı;
`uyari_alert` Meta tarafından **Marketing** kategorisine alındı, diğerleri **Utility**.
Gövdedeki `{{n}}` sırası koddaki parametre sırasıyla birebirdir
(`src/lib/panel/notify.ts` → `buildAlertTemplate`).

Ad öneki env ile değiştirilebilir: `WHATSAPP_TEMPLATE_PREFIX` (varsayılan `uyari_`).
Genel yedek: `WHATSAPP_ALERT_TEMPLATE` (varsayılan `uyari_alert`). Türe özel şablon
yoksa veya parametre uymazsa kod genel şablona düşer, o da olmazsa e-postaya.

Hesapta ayrıca eski `panel_` (emojili; yalnız odeme + butce) ve `hesap_` setleri var;
kullanılmıyorlar.

Ortak bileşenler — her şablonda:

- **Header (metin):** `593 Panel · Uyarı`
- **Footer:** `Uyarıyı panelden "Çözüldü" işaretleyince bildirim durur.`
  Kod bunu karşılar: elle "Çözüldü" işaretlenen marka + tür 24 saat susar (bkz. aşağıda).
- **Button (URL, dinamik):** `Markayı aç` → `https://admin.593emarketing.com/brands/{{1}}`
  (dinamik son ek = marka slug'ı)

---

## `uyari_odeme` — Reklam ödemesi / hesap sorunu
Tipler: `payment_meta`, `payment_google` → Meta / Google ekibi + marka sorumlusu
```
593 Panel hesabınız için ödeme durumu bildirimi

Marka: {{1}}
Platform: {{2}}
Hesap durumu: {{3}}
Detay: {{4}}
Kontrol zamanı: {{5}}

Bu bildirim, hesabınıza bağlı reklam hesabının ödeme durumu değiştiği için gönderildi.
```

## `uyari_harcama` — Harcama durdu
Tipler: `spend_stopped_meta`, `spend_stopped_google`
```
593 Panel hesabınız için harcama durumu bildirimi

Marka: {{1}}
Platform: {{2}}
Harcama olmayan gün: {{3}}
Son harcama: {{4}}
Kayıtlı sebep: {{5}}

Bu bildirim, hesabınıza bağlı reklam hesabında harcama kaydı oluşmadığı için gönderildi.
```

## `uyari_butce` — Bütçe aşıldı (panel test mesajı da bunu kullanır)
Tip: `budget_over` → marka sorumlusu
```
593 Panel hesabınız için bütçe durumu bildirimi

Marka: {{1}}
Dönem: {{2}}
Harcanan: {{3}}
Planlanan: {{4}}
Kullanım: {{5}}

Bu bildirim, hesabınıza bağlı markanın harcaması aylık planı geçtiği için gönderildi.
```

## `uyari_maliyet` — Lead / satış maliyeti hedefi aşıldı
Tip: `cpl_over` → marka sorumlusu
```
593 Panel hesabınız için maliyet durumu bildirimi

Marka: {{1}}
Metrik: {{2}}
Güncel değer: {{3}}
Hedef değer: {{4}}
Dönem: {{5}}

Bu bildirim, hesabınıza bağlı markanın maliyeti kayıtlı hedefi geçtiği için gönderildi.
```

## `uyari_veri` — Veri çekimi / erişim sorunu
Tipler: `sync_error`, `sync_error_meta`, `sync_error_ga4`, `missing_mapping*`,
`token_expired_meta`, `token_expired_google` → ilgili ekip + sorumlu
```
593 Panel hesabınız için sistem bildirimi

Marka: {{1}}
Entegrasyon: {{2}}
Hata: {{3}}
Gerekli işlem: {{4}}
Sorumlu ekip: {{5}}

Bu bildirim, hesabınıza bağlı veri entegrasyonundaki hata nedeniyle gönderildi.
```

## `uyari_olcum` — Ölçüm / kurulum sorunu
Tipler: `conv_dropout`, `setup_missing`, `site_tag_verify` → Analytics ekibi + sorumlu
```
593 Panel hesabınız için kurulum bildirimi

Marka: {{1}}
Konu: {{2}}
Hata: {{3}}
Gerekli işlem: {{4}}
Sorumlu ekip: {{5}}

Bu bildirim, hesabınıza bağlı ölçüm kurulumundaki hata nedeniyle gönderildi.
```

## `uyari_alert` — Genel yedek (Marketing)
```
593 Panel hesabınız için sistem bildirimi

Marka: {{1}}
Konu: {{2}}
Detay: {{3}}

Bu bildirim, hesabınıza bağlı bir kayıtta hata oluştuğu için gönderildi.
```

---

## Gönderim kuralları (`notifyAlert`)
- Bir uyarı aynı seviyede bir kez bildirilir; seviye yükselirse tekrar gider.
- **Susturma (24 saat):** aynı marka + tür elle "Çözüldü" işaretlendiyse veya son 24
  saatte zaten bildirildiyse yeni açılan uyarı bildirilmez (seviye yükselmedikçe).
  Süre dolup koşul sürüyorsa bir sonraki kontrolde gider.
- **Ortak token:** `token_expired_*` bir markada bildirildiyse 24 saat boyunca diğer
  markalar için tekrar edilmez (Meta/Google token'ı tüm markalarda ortak).
- Token kaynaklı çekim hatası yalnızca `token_expired_*` açar; ayrıca `sync_error*` açılmaz.
- Susturulan / atlanan gönderimler bildirim log'una `skipped` olarak düşer.

## Şablon değiştirme notları
- Onaylı şablonu düzenlemek yeniden incelemeye gönderir; yeni adla açmak daha güvenli.
- Parametreler satır sonu içeremez; kod boşluğa çevirir ve 300 karakterde keser.
- Gövde değişkenle başlayamaz/bitemez; iki değişken yan yana olmamalı.
- Pazarlama cümlesi eklenirse Meta kategoriyi Marketing'e çevirir (daha pahalı).
