"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantType } from "@prisma/client";
import { TenantSyncActions } from "@/components/panel/SyncButton";
import {
  brandMapHintsFor,
  draftMetaAccountId,
} from "@/lib/panel/brand-map-hints";

type MappingFields = {
  adsCustomerId: string;
  ga4PropertyId: string;
  gtmContainerId: string;
  gscSiteUrl: string;
  merchantId: string;
};

type FormState = {
  name: string;
  slug: string;
  metaAccountId: string;
  type: TenantType;
  website: string;
  monthlyBudget: string;
  mapping: MappingFields;
  clientEmail: string;
  clientPassword: string;
  clientName: string;
};

const STEPS = [
  "Kimlik",
  "Meta & tip",
  "Google",
  "Müşteri",
  "Veri çek",
] as const;

const empty: FormState = {
  name: "",
  slug: "",
  metaAccountId: "",
  type: "lead",
  website: "",
  monthlyBudget: "",
  mapping: {
    adsCustomerId: "",
    ga4PropertyId: "",
    gtmContainerId: "",
    gscSiteUrl: "",
    merchantId: "",
  },
  clientEmail: "",
  clientPassword: "",
  clientName: "",
};

function slugifyDraft(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function applyMapHints(form: FormState): FormState {
  const slug = form.slug.trim() || slugifyDraft(form.name);
  const hints = brandMapHintsFor({ slug, name: form.name });
  return {
    ...form,
    slug,
    metaAccountId: form.metaAccountId.trim()
      ? draftMetaAccountId(form.metaAccountId)
      : hints.metaAccountId || "",
    mapping: {
      adsCustomerId:
        form.mapping.adsCustomerId.trim() || hints.adsCustomerId || "",
      ga4PropertyId:
        form.mapping.ga4PropertyId.trim() || hints.ga4PropertyId || "",
      gtmContainerId:
        form.mapping.gtmContainerId.trim() || hints.gtmContainerId || "",
      gscSiteUrl: form.mapping.gscSiteUrl,
      merchantId: form.mapping.merchantId,
    },
  };
}

export default function AddBrandWizard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(empty);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const hints = useMemo(
    () =>
      brandMapHintsFor({
        slug: form.slug.trim() || slugifyDraft(form.name),
        name: form.name,
      }),
    [form.slug, form.name],
  );

  function reset() {
    setStep(0);
    setForm(empty);
    setError(null);
    setPending(false);
    setCreatedSlug(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function createTenant(): Promise<string | null> {
    setPending(true);
    setError(null);
    const prepared = applyMapHints(form);
    setForm(prepared);
    try {
      const res = await fetch("/api/panel/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prepared.name.trim(),
          slug: prepared.slug.trim() || undefined,
          metaAccountId: prepared.metaAccountId.trim() || null,
          type: prepared.type,
          website: prepared.website.trim() || null,
          monthlyBudget: prepared.monthlyBudget
            ? Number(prepared.monthlyBudget)
            : null,
          mapping: {
            adsCustomerId: prepared.mapping.adsCustomerId || null,
            ga4PropertyId: prepared.mapping.ga4PropertyId || null,
            gtmContainerId: prepared.mapping.gtmContainerId || null,
            gscSiteUrl: prepared.mapping.gscSiteUrl || null,
            merchantId: prepared.mapping.merchantId || null,
          },
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        tenant?: { slug: string };
      };
      if (!res.ok || !json.tenant?.slug) {
        setError(json.error || "Marka oluşturulamadı");
        return null;
      }
      return json.tenant.slug;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function createClientUser(slug: string): Promise<boolean> {
    const email = form.clientEmail.trim();
    const password = form.clientPassword;
    if (!email && !password) return true;
    if (!email || !password) {
      setError(
        "Müşteri için e-posta ve şifre birlikte gerekli (veya ikisini de boş bırakın)",
      );
      return false;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/panel/tenants/${encodeURIComponent(slug)}/client-user`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            name: form.clientName.trim() || null,
          }),
        },
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(json.error || "Müşteri hesabı oluşturulamadı");
        return false;
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function onNext() {
    setError(null);
    if (step === 0) {
      if (!form.name.trim()) {
        setError("Marka adı gerekli");
        return;
      }
      const next = applyMapHints({
        ...form,
        slug: form.slug.trim() || slugifyDraft(form.name),
      });
      setForm(next);
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!form.metaAccountId.trim() && !hints.metaAccountId) {
        setError(
          "Meta reklam hesabı (act_…) girin veya kod map’e ekleyin — yoksa Meta sync çalışmaz.",
        );
        return;
      }
      if (!form.metaAccountId.trim() && hints.metaAccountId) {
        setForm((f) => ({ ...f, metaAccountId: hints.metaAccountId! }));
      } else if (form.metaAccountId.trim()) {
        setForm((f) => ({
          ...f,
          metaAccountId: draftMetaAccountId(f.metaAccountId),
        }));
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      setForm((f) => applyMapHints(f));
      setStep(3);
      return;
    }
    if (step === 3) {
      const slug = createdSlug ?? (await createTenant());
      if (!slug) return;
      setCreatedSlug(slug);
      const ok = await createClientUser(slug);
      if (!ok) return;
      setStep(4);
      router.refresh();
    }
  }

  function onBack() {
    setError(null);
    if (step > 0 && step < 4) setStep(step - 1);
  }

  function fillFromMap(field: "meta" | "ads" | "ga4" | "gtm") {
    if (field === "meta" && hints.metaAccountId) {
      setField("metaAccountId", hints.metaAccountId);
    }
    if (field === "ads" && hints.adsCustomerId) {
      setField("mapping", {
        ...form.mapping,
        adsCustomerId: hints.adsCustomerId,
      });
    }
    if (field === "ga4" && hints.ga4PropertyId) {
      setField("mapping", {
        ...form.mapping,
        ga4PropertyId: hints.ga4PropertyId,
      });
    }
    if (field === "gtm" && hints.gtmContainerId) {
      setField("mapping", {
        ...form.mapping,
        gtmContainerId: hints.gtmContainerId,
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="rounded-md bg-[#e91825] px-3.5 py-2 text-sm font-medium text-white transition hover:bg-[#c91420]"
      >
        Yeni marka
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-brand-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="add-brand-title"
                  className="text-base font-semibold text-zinc-900"
                >
                  Yeni marka
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Adım {step + 1}/{STEPS.length}: {STEPS[step]}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="text-xs text-zinc-400 hover:text-zinc-700"
              >
                Kapat
              </button>
            </div>

            <ol className="mt-4 flex flex-wrap gap-1.5">
              {STEPS.map((label, i) => (
                <li
                  key={label}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    i === step
                      ? "bg-zinc-900 text-white"
                      : i < step
                        ? "bg-zinc-200 text-zinc-700"
                        : "bg-zinc-50 text-zinc-400"
                  }`}
                >
                  {label}
                </li>
              ))}
            </ol>

            <div className="mt-5 space-y-3">
              {step === 0 ? (
                <>
                  <p className="text-xs text-zinc-500">
                    Slug panel adresi olur (
                    <code className="text-zinc-600">slug.alanadiniz.com</code>
                    ). Kod map varsa sonraki adımlarda Meta / Google ID’leri
                    önerilir.
                  </p>
                  <Field label="Marka adı">
                    <input
                      className={inputClass}
                      value={form.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setForm((f) => ({
                          ...f,
                          name,
                          slug:
                            !f.slug || f.slug === slugifyDraft(f.name)
                              ? slugifyDraft(name)
                              : f.slug,
                        }));
                      }}
                      placeholder="Örn. Mareen"
                      autoFocus
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
                      placeholder="mareen"
                    />
                  </Field>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <p className="text-xs text-zinc-500">
                    Meta BM altındaki reklam hesabı (
                    <code className="text-zinc-600">act_…</code>). System user
                    bu hesaba atanmış olmalı. DB’ye yazılır; kod map yedek.
                  </p>
                  <Field label="Meta reklam hesabı (act_…)">
                    <input
                      className={inputClass}
                      value={form.metaAccountId}
                      onChange={(e) =>
                        setField("metaAccountId", e.target.value)
                      }
                      onBlur={() =>
                        setField(
                          "metaAccountId",
                          draftMetaAccountId(form.metaAccountId),
                        )
                      }
                      placeholder={hints.metaAccountId || "act_123…"}
                    />
                  </Field>
                  {hints.metaAccountId ? (
                    <HintRow
                      text={`Map önerisi: ${hints.metaAccountId}`}
                      onUse={() => fillFromMap("meta")}
                    />
                  ) : (
                    <p className="text-[11px] text-amber-700">
                      Bu slug için Meta map yok — act_’yi elle girin veya BM’de
                      hesabı bağlayıp map’i güncelleyin.
                    </p>
                  )}
                  <Field label="Tip (rapor modeli)">
                    <select
                      className={inputClass}
                      value={form.type}
                      onChange={(e) =>
                        setField("type", e.target.value as TenantType)
                      }
                    >
                      <option value="ecommerce">
                        E-ticaret (satış / getiri)
                      </option>
                      <option value="lead">Lead / form (iletişim)</option>
                    </select>
                  </Field>
                  <Field label="Website">
                    <input
                      className={inputClass}
                      value={form.website}
                      onChange={(e) => setField("website", e.target.value)}
                      placeholder="https://…"
                    />
                  </Field>
                  <Field label="Aylık bütçe (TRY)">
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      value={form.monthlyBudget}
                      onChange={(e) =>
                        setField("monthlyBudget", e.target.value)
                      }
                    />
                  </Field>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <p className="text-xs text-zinc-500">
                    Google tarafı MCC altındaki müşteri ID’leri. Boş
                    bırakılabilir; kod map varsa sync yine dener.
                  </p>
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
                      onUse={() => fillFromMap("ads")}
                    />
                  ) : null}
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
                      placeholder={
                        hints.ga4PropertyId || "properties/123456789"
                      }
                    />
                  </Field>
                  {hints.ga4PropertyId ? (
                    <HintRow
                      text={`Map: ${hints.ga4PropertyId}`}
                      onUse={() => fillFromMap("ga4")}
                    />
                  ) : null}
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
                      onUse={() => fillFromMap("gtm")}
                    />
                  ) : null}
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
                      placeholder="Sayısal ID"
                    />
                  </Field>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <p className="text-xs text-zinc-500">
                    Opsiyonel — marka subdomain’ine giriş için müşteri
                    kullanıcısı. Atlamak için boş bırakın.
                  </p>
                  <Field label="Müşteri adı">
                    <input
                      className={inputClass}
                      value={form.clientName}
                      onChange={(e) => setField("clientName", e.target.value)}
                    />
                  </Field>
                  <Field label="E-posta">
                    <input
                      className={inputClass}
                      type="email"
                      value={form.clientEmail}
                      onChange={(e) => setField("clientEmail", e.target.value)}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Şifre (min. 8)">
                    <input
                      className={inputClass}
                      type="password"
                      value={form.clientPassword}
                      onChange={(e) =>
                        setField("clientPassword", e.target.value)
                      }
                      autoComplete="new-password"
                    />
                  </Field>
                </>
              ) : null}

              {step === 4 && createdSlug ? (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-700">
                    <span className="font-medium text-zinc-900">
                      {form.name}
                    </span>{" "}
                    hazır (
                    <code className="text-xs text-zinc-500">{createdSlug}</code>
                    ).
                  </p>
                  <ol className="list-decimal space-y-1 pl-4 text-xs text-zinc-600">
                    <li>
                      <strong className="font-medium text-zinc-800">Meta</strong>{" "}
                      — kampanya + kreatif (720 gün)
                    </li>
                    <li>
                      <strong className="font-medium text-zinc-800">
                        Google
                      </strong>{" "}
                      — Ads / GA4 / GTM / GSC
                    </li>
                    <li>Marka subdomain’den müşteri girişini deneyin</li>
                  </ol>
                  <TenantSyncActions tenantSlug={createdSlug} />
                  <a
                    href={`/settings?tenant=${encodeURIComponent(createdSlug)}`}
                    className="inline-block text-xs font-medium text-[#e91825] hover:underline"
                  >
                    Ayarlara git →
                  </a>
                </div>
              ) : null}

              {error ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={step === 4 ? close : onBack}
                disabled={pending || step === 0}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
              >
                {step === 4 ? "Listeye dön" : "Geri"}
              </button>
              {step < 4 ? (
                <button
                  type="button"
                  onClick={onNext}
                  disabled={pending}
                  className="rounded-md bg-[#e91825] px-3.5 py-1.5 text-sm font-medium text-white hover:bg-[#c91420] disabled:opacity-50"
                >
                  {pending
                    ? "Kaydediliyor…"
                    : step === 3
                      ? "Oluştur"
                      : "İleri"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Tamam
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function HintRow({ text, onUse }: { text: string; onUse: () => void }) {
  return (
    <div className="-mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
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
