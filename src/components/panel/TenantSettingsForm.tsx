"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantType } from "@prisma/client";

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
}: {
  initial: TenantSettingsInitial;
  /** Required on staff host (admin.*) where there is no x-tenant-slug. */
  tenantSlug: string;
  rootDomain: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [clientPending, setClientPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState({
    email: initial.clientUsers[0]?.email ?? "",
    name: initial.clientUsers[0]?.name ?? "",
    password: "",
  });

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
      const res = await fetch("/api/panel/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          name: form.name.trim(),
          slug: form.slug.trim().toLowerCase(),
          metaAccountId: form.metaAccountId.trim() || null,
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
            slug değişince Dokploy / DNS’i de güncelle.
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
            <Field label="Meta account ID">
              <input
                className={inputClass}
                value={form.metaAccountId}
                onChange={(e) => setField("metaAccountId", e.target.value)}
                placeholder="act_… — boşsa act_manual_{slug}"
              />
            </Field>
            <Field label="Tip (KPI modeli)">
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) =>
                  setField("type", e.target.value as TenantType)
                }
              >
                <option value="ecommerce">E-ticaret (ROAS / satış)</option>
                <option value="lead">Lead / form (CPL)</option>
              </select>
            </Field>
            <Field label="Website (Playwright test URL)">
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
            Google eşleştirmeleri
          </h3>
          <p className="text-xs text-zinc-500">
            DB öncelikli; boşsa kod map yedek. Sihirbazdaki alanlarla aynı.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Google Ads customer ID">
              <input
                className={inputClass}
                value={form.mapping.adsCustomerId}
                onChange={(e) =>
                  setField("mapping", {
                    ...form.mapping,
                    adsCustomerId: e.target.value,
                  })
                }
                placeholder="123-456-7890"
              />
            </Field>
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
                placeholder="properties/123456"
              />
            </Field>
            <Field label="GTM (GTM-XXXX veya accountId/containerId)">
              <input
                className={inputClass}
                value={form.mapping.gtmContainerId}
                onChange={(e) =>
                  setField("mapping", {
                    ...form.mapping,
                    gtmContainerId: e.target.value,
                  })
                }
                placeholder="GTM-NDHZKCHJ"
              />
            </Field>
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
            <Field label="Merchant ID (e-ticaret, sayısal)">
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
