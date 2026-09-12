"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantType } from "@prisma/client";
import { TenantSyncActions } from "@/components/panel/SyncButton";
import {
  brandMapHintsFor,
  draftMetaAccountId,
} from "@/lib/panel/brand-map-hints";
import { isPlaceholderMetaAccountId } from "@/lib/panel/mapping-placeholders";

export type TenantSettingsInitial = {
  name: string;
  slug: string;
  metaAccountId: string;
  type: TenantType;
  website: string;
  monthlyBudget: string;
  timezone: string;
  currency: string;
  mapping: {
    adsCustomerId: string;
    ga4PropertyId: string;
    gtmContainerId: string;
    gscSiteUrl: string;
    merchantId: string;
  };
  thresholds: {
    budgetPaceWarnPct: string;
    convDropoutDays: string;
    minSpendForAlert: string;
  };
  clientUsers: Array<{ email: string; name: string | null }>;
};

export default function TenantSettingsForm({
  initial,
  tenantSlug,
  rootDomain,
  allowDelete = false,
}: {
  initial: TenantSettingsInitial;
  /** Required on staff host (admin.*) where there is no x-tenant-slug. */
  tenantSlug: string;
  rootDomain: string;
  /** DB’de gerçek tenant varsa silmeye izin ver. */
  allowDelete?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [clientPending, setClientPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState({
    email: initial.clientUsers[0]?.email ?? "",
    name: initial.clientUsers[0]?.name ?? "",
    password: "",
  });

  const hints = useMemo(
    () =>
      brandMapHintsFor({
        slug: form.slug.trim() || tenantSlug,
        name: form.name,
      }),
    [form.slug, form.name, tenantSlug],
  );

  const metaLooksPlaceholder = isPlaceholderMetaAccountId(form.metaAccountId);

  function setField<K extends keyof TenantSettingsInitial>(
    key: K,
    value: TenantSettingsInitial[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const meta = draftMetaAccountId(form.metaAccountId) || null;
      const res = await fetch("/api/panel/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          name: form.name.trim(),
          slug: form.slug.trim().toLowerCase(),
          metaAccountId: meta,
          type: form.type,
          website: form.website || null,
          monthlyBudget: form.monthlyBudget
            ? Number(form.monthlyBudget)
            : null,
          timezone: form.timezone,
          currency: form.currency,
          mapping: {
            adsCustomerId: form.mapping.adsCustomerId || null,
            ga4PropertyId: form.mapping.ga4PropertyId || null,
            gtmContainerId: form.mapping.gtmContainerId || null,
            gscSiteUrl: form.mapping.gscSiteUrl || null,
            merchantId: form.mapping.merchantId || null,
          },
          thresholds: {
            budgetPaceWarnPct: Number(form.thresholds.budgetPaceWarnPct) || 85,
            convDropoutDays: Number(form.thresholds.convDropoutDays) || 3,
            minSpendForAlert: Number(form.thresholds.minSpendForAlert) || 100,
          },
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        slugChanged?: boolean;
        slug?: string;
      };
      if (!res.ok) {
        setMessage(json.error || "Kayıt başarısız");
      } else {
        setMessage(
          json.slugChanged
            ? `Kaydedildi — slug değişti. Panel: ${json.slug}.${rootDomain}`
            : "Kaydedildi",
        );
        if (json.slugChanged && json.slug) {
          router.replace(`/settings?tenant=${encodeURIComponent(json.slug)}`);
        }
        router.refresh();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Network error");
    } finally {
      setPending(false);
    }
  }

  async function onSaveClient(e: React.FormEvent) {
    e.preventDefault();
    setClientPending(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/panel/tenants/${encodeURIComponent(tenantSlug)}/client-user`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: clientForm.email.trim(),
            password: clientForm.password,
            name: clientForm.name.trim() || null,
          }),
        },
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setMessage(json.error || "Müşteri kaydı başarısız");
      } else {
        setMessage("Müşteri hesabı kaydedildi");
        setClientForm((f) => ({ ...f, password: "" }));
        router.refresh();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Network error");
    } finally {
      setClientPending(false);
    }
  }

  async function onDeleteBrand() {
    if (confirmSlug.trim().toLowerCase() !== tenantSlug) {
      setDeleteMessage("Silmek için slug’ı aynen yazın");
      return;
    }
    const ok = window.confirm(
      `"${form.name}" markasını ve tüm panel verisini kalıcı silmek istiyor musunuz? Bu geri alınamaz.`,
    );
    if (!ok) return;

    setDeletePending(true);
    setDeleteMessage(null);
    try {
      const res = await fetch("/api/panel/tenant", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          confirmSlug: confirmSlug.trim().toLowerCase(),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setDeleteMessage(json.error || "Silme başarısız");
        return;
      }
      router.push("/settings");
      router.refresh();
    } catch (err) {
      setDeleteMessage(err instanceof Error ? err.message : "Network error");
    } finally {
      setDeletePending(false);
    }
  }

  const panelHint = `${form.slug.trim() || tenantSlug}.${rootDomain}`;

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-8">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-800">Kimlik</h3>
          <p className="text-xs text-zinc-500">
            Panel adresi:{" "}
            <code className="text-zinc-600">{panelHint}</code>
            {" — "}
            slug değişince DNS / Dokploy’u da güncelleyin.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Marka adı">
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </Field>
            <Field label="Slug (subdomain)">
              <input
                className={inputClass}
                value={form.slug}
                onChange={(e) =>
                  setField(
                    "slug",
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, ""),
                  )
                }
                required
              />
            </Field>
            <Field label="Tip (rapor modeli)">
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) =>
                  setField("type", e.target.value as TenantType)
                }
              >
                <option value="ecommerce">E-ticaret (satış / getiri)</option>
                <option value="lead">Lead / form (iletişim)</option>
              </select>
            </Field>
            <Field label="Website">
              <input
                className={inputClass}
                value={form.website}
                onChange={(e) => setField("website", e.target.value)}
                placeholder="https://ornek.com"
              />
            </Field>
            <Field label="Aylık bütçe (TRY)">
              <input
                className={inputClass}
                type="number"
                min={0}
                step={1}
                value={form.monthlyBudget}
                onChange={(e) => setField("monthlyBudget", e.target.value)}
              />
            </Field>
            <Field label="Para birimi">
              <input
                className={inputClass}
                value={form.currency}
                onChange={(e) => setField("currency", e.target.value)}
              />
            </Field>
            <Field label="Timezone">
              <input
                className={inputClass}
                value={form.timezone}
                onChange={(e) => setField("timezone", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-800">
            Meta (Facebook / Instagram)
          </h3>
          <p className="text-xs text-zinc-500">
            Ajans BM + system user ile çekilir. Buradaki{" "}
            <code className="text-zinc-600">act_…</code> önceliklidir; boş /
            sahteyse kod map yedek olur.
          </p>
          <Field label="Meta reklam hesabı (act_…)">
            <input
              className={inputClass}
              value={form.metaAccountId}
              onChange={(e) => setField("metaAccountId", e.target.value)}
              onBlur={() =>
                setField(
                  "metaAccountId",
                  draftMetaAccountId(form.metaAccountId) || form.metaAccountId,
                )
              }
              placeholder={hints.metaAccountId || "act_123…"}
            />
          </Field>
          {hints.metaAccountId ? (
            <HintRow
              text={`Kod map: ${hints.metaAccountId}`}
              onUse={() => setField("metaAccountId", hints.metaAccountId!)}
            />
          ) : (
            <p className="text-[11px] text-amber-700">
              Bu slug için Meta map yok — act_ doğru değilse sync boş kalır.
            </p>
          )}
          {metaLooksPlaceholder ? (
            <p className="text-[11px] text-amber-700">
              Kayıtlı Meta ID placeholder görünüyor — gerçek act_ yazın veya
              map’ten doldurun.
            </p>
          ) : null}
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-800">
            Google eşleştirmeleri
          </h3>
          <p className="text-xs text-zinc-500">
            MCC altındaki hesaplar. DB öncelikli; boşsa ilgili kod map yedek.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Field label="Google Ads müşteri ID">
                <input
                  className={inputClass}
                  value={form.mapping.adsCustomerId}
                  onChange={(e) =>
                    setField("mapping", {
                      ...form.mapping,
                      adsCustomerId: e.target.value,
                    })
                  }
                  placeholder={hints.adsCustomerId || "1234567890"}
                />
              </Field>
              {hints.adsCustomerId ? (
                <HintRow
                  text={`Map: ${hints.adsCustomerId}`}
                  onUse={() =>
                    setField("mapping", {
                      ...form.mapping,
                      adsCustomerId: hints.adsCustomerId!,
                    })
                  }
                />
              ) : null}
            </div>
            <div className="space-y-1">
              <Field label="GA4 property">
                <input
                  className={inputClass}
                  value={form.mapping.ga4PropertyId}
                  onChange={(e) =>
                    setField("mapping", {
                      ...form.mapping,
                      ga4PropertyId: e.target.value,
                    })
                  }
                  placeholder={hints.ga4PropertyId || "properties/123456"}
                />
              </Field>
              {hints.ga4PropertyId ? (
                <HintRow
                  text={`Map: ${hints.ga4PropertyId}`}
                  onUse={() =>
                    setField("mapping", {
                      ...form.mapping,
                      ga4PropertyId: hints.ga4PropertyId!,
                    })
                  }
                />
              ) : null}
            </div>
            <div className="space-y-1">
              <Field label="GTM container">
                <input
                  className={inputClass}
                  value={form.mapping.gtmContainerId}
                  onChange={(e) =>
                    setField("mapping", {
                      ...form.mapping,
                      gtmContainerId: e.target.value,
                    })
                  }
                  placeholder={hints.gtmContainerId || "GTM-XXXX"}
                />
              </Field>
              {hints.gtmContainerId ? (
                <HintRow
                  text={`Map: ${hints.gtmContainerId}`}
                  onUse={() =>
                    setField("mapping", {
                      ...form.mapping,
                      gtmContainerId: hints.gtmContainerId!,
                    })
                  }
                />
              ) : null}
            </div>
            <Field label="Search Console site URL">
              <input
                className={inputClass}
                value={form.mapping.gscSiteUrl}
                onChange={(e) =>
                  setField("mapping", {
                    ...form.mapping,
                    gscSiteUrl: e.target.value,
                  })
                }
                placeholder="https://ornek.com/"
              />
            </Field>
            <Field label="Merchant Center ID (e-ticaret)">
              <input
                className={inputClass}
                value={form.mapping.merchantId}
                onChange={(e) =>
                  setField("mapping", {
                    ...form.mapping,
                    merchantId: e.target.value,
                  })
                }
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-800">Uyarı eşikleri</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Bütçe tempo uyarı %">
              <input
                className={inputClass}
                type="number"
                min={1}
                max={200}
                value={form.thresholds.budgetPaceWarnPct}
                onChange={(e) =>
                  setField("thresholds", {
                    ...form.thresholds,
                    budgetPaceWarnPct: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Dönüşüm kesintisi (gün)">
              <input
                className={inputClass}
                type="number"
                min={1}
                max={31}
                value={form.thresholds.convDropoutDays}
                onChange={(e) =>
                  setField("thresholds", {
                    ...form.thresholds,
                    convDropoutDays: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Min harcama (uyarı için)">
              <input
                className={inputClass}
                type="number"
                min={0}
                value={form.thresholds.minSpendForAlert}
                onChange={(e) =>
                  setField("thresholds", {
                    ...form.thresholds,
                    minSpendForAlert: e.target.value,
                  })
                }
              />
            </Field>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-[#e91825] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#c91420] disabled:opacity-50"
          >
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {message ? (
            <p className="text-xs text-zinc-500">{message}</p>
          ) : null}
        </div>
      </form>

      <section className="space-y-3 border-t border-zinc-100 pt-8">
        <h3 className="text-sm font-semibold text-zinc-800">Veri çek</h3>
        <p className="text-xs text-zinc-500">
          Bu marka için Meta ve Google’ı ayrı ayrı yenileyin. Meta: kampanya +
          kreatif (720 gün). Google: Ads / GA4 / GTM / GSC.
        </p>
        <TenantSyncActions tenantSlug={tenantSlug} />
      </section>

      <form
        onSubmit={onSaveClient}
        className="space-y-4 border-t border-zinc-100 pt-8"
      >
        <h3 className="text-sm font-semibold text-zinc-800">Müşteri hesabı</h3>
        <p className="text-xs text-zinc-500">
          Marka subdomain girişi. Şifre en az 8 karakter; mevcut e-posta
          güncellenir / membership bağlanır.
        </p>
        {initial.clientUsers.length > 0 ? (
          <ul className="text-xs text-zinc-500">
            {initial.clientUsers.map((u) => (
              <li key={u.email}>
                Kayıtlı:{" "}
                <span className="font-medium text-zinc-700">{u.email}</span>
                {u.name ? ` (${u.name})` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-amber-700">Henüz müşteri membership yok.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Müşteri adı">
            <input
              className={inputClass}
              value={clientForm.name}
              onChange={(e) =>
                setClientForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </Field>
          <Field label="E-posta">
            <input
              className={inputClass}
              type="email"
              value={clientForm.email}
              onChange={(e) =>
                setClientForm((f) => ({ ...f, email: e.target.value }))
              }
              required
              autoComplete="off"
            />
          </Field>
          <Field label="Şifre (min. 8)">
            <input
              className={inputClass}
              type="password"
              value={clientForm.password}
              onChange={(e) =>
                setClientForm((f) => ({ ...f, password: e.target.value }))
              }
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={clientPending}
          className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          {clientPending ? "Kaydediliyor…" : "Müşteri hesabını kaydet"}
        </button>
      </form>

      {allowDelete ? (
        <section className="space-y-3 rounded-xl border border-red-200 bg-red-50/60 p-4">
          <div>
            <h3 className="text-sm font-semibold text-red-900">
              Tehlikeli alan · markayı sil
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-red-800/80">
              Bu markayı, sync verilerini, uyarıları ve müşteri üyeliklerini
              kalıcı siler. Meta BM hesabı silinmez; yalnızca panel kaydı gider.
              Geri alınamaz.
            </p>
          </div>
          <Field label={`Onay için slug yazın: ${tenantSlug}`}>
            <input
              className={inputClass}
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={tenantSlug}
              autoComplete="off"
            />
          </Field>
          <button
            type="button"
            disabled={
              deletePending ||
              confirmSlug.trim().toLowerCase() !== tenantSlug
            }
            onClick={() => void onDeleteBrand()}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800 disabled:opacity-50"
          >
            {deletePending ? "Siliniyor…" : "Markayı kalıcı sil"}
          </button>
          {deleteMessage ? (
            <p className="text-xs text-red-900/80">{deleteMessage}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function HintRow({ text, onUse }: { text: string; onUse: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
      <span>{text}</span>
      <button
        type="button"
        onClick={onUse}
        className="font-medium text-[#e91825] hover:underline"
      >
        Kullan
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none ring-[#e91825]/40 placeholder:text-zinc-600 focus:ring-2";
