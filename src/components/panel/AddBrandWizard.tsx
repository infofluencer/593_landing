"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantType } from "@prisma/client";
import { TenantSyncActions } from "@/components/panel/SyncButton";

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
  "Tip & bütçe",
  "Google eşleştirme",
  "Müşteri hesabı",
  "Sync",
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

export default function AddBrandWizard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(empty);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

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
    try {
      const res = await fetch("/api/panel/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          metaAccountId: form.metaAccountId.trim() || null,
          type: form.type,
          website: form.website.trim() || null,
          monthlyBudget: form.monthlyBudget
            ? Number(form.monthlyBudget)
            : null,
          mapping: {
            adsCustomerId: form.mapping.adsCustomerId || null,
            ga4PropertyId: form.mapping.ga4PropertyId || null,
            gtmContainerId: form.mapping.gtmContainerId || null,
            gscSiteUrl: form.mapping.gscSiteUrl || null,
            merchantId: form.mapping.merchantId || null,
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
      setError("Müşteri için e-posta ve şifre birlikte gerekli (veya ikisini de boş bırakın)");
      return false;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/panel/tenants/${encodeURIComponent(slug)}/client-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: form.clientName.trim() || null,
        }),
      });
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
      if (!form.slug.trim()) {
        setField("slug", slugifyDraft(form.name));
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
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
      return;
    }
  }

  function onBack() {
    setError(null);
    if (step > 0 && step < 4) setStep(step - 1);
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
                  <Field label="Meta account ID (opsiyonel)">
                    <input
                      className={inputClass}
                      value={form.metaAccountId}
                      onChange={(e) =>
                        setField("metaAccountId", e.target.value)
                      }
                      placeholder="act_… — boşsa manuel ID atanır"
                    />
                  </Field>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <Field label="Tip (KPI modeli)">
                    <select
                      className={inputClass}
                      value={form.type}
                      onChange={(e) =>
                        setField("type", e.target.value as TenantType)
                      }
                    >
                      <option value="ecommerce">E-ticaret</option>
                      <option value="lead">Lead / form</option>
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
                    Ayarlar’a da yazılır; kod map yalnızca yedek. Boş bırakılabilir.
                  </p>
                  {(
                    [
                      ["adsCustomerId", "Google Ads customer ID"],
                      ["ga4PropertyId", "GA4 property ID"],
                      ["gtmContainerId", "GTM (GTM-… veya numeric)"],
                      ["gscSiteUrl", "Search Console site URL"],
                      ["merchantId", "Merchant Center ID"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        className={inputClass}
                        value={form.mapping[key]}
                        onChange={(e) =>
                          setField("mapping", {
                            ...form.mapping,
                            [key]: e.target.value,
                          })
                        }
                      />
                    </Field>
                  ))}
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <p className="text-xs text-zinc-500">
                    Opsiyonel — marka subdomain girişi için müşteri kullanıcısı.
                    Atlamak için boş bırakın.
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
                    oluşturuldu (
                    <code className="text-xs text-zinc-500">{createdSlug}</code>
                    ). Meta / Google çekin, sonra subdomain’i kontrol edin.
                  </p>
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
                disabled={pending || (step === 0)}
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
