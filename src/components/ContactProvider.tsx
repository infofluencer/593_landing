"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";

type ContactContextValue = {
  open: () => void;
  close: () => void;
};

const ContactContext = createContext<ContactContextValue | null>(null);

export function useContact() {
  const ctx = useContext(ContactContext);
  if (!ctx) {
    throw new Error("useContact must be used within ContactProvider");
  }
  return ctx;
}

export default function ContactProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <ContactContext.Provider value={{ open: openModal, close: closeModal }}>
      {children}
      <ContactModal open={open} onClose={closeModal} />
    </ContactContext.Provider>
  );
}

function ContactModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    firstFieldRef.current?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      root.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setStatus("idle");
      setError("");
    }
  }, [open]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: String(data.get("firstName") ?? "").trim(),
          lastName: String(data.get("lastName") ?? "").trim(),
          company: String(data.get("company") ?? "").trim(),
          phone: String(data.get("phone") ?? "").trim(),
          website: String(data.get("website") ?? "").trim(),
        }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(payload?.error || "Gönderilemedi.");
      }
      setStatus("sent");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Bir sorun oluştu. Lütfen tekrar deneyin.",
      );
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-t-3xl border border-white/10 bg-[#1c1818] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] sm:rounded-3xl">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(233,24,37,0.16),transparent_55%)]"
        />
        <div className="relative px-5 pb-[max(1.5rem,var(--safe-b))] pt-5 sm:px-7 sm:pb-7 sm:pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                İletişim
              </p>
              <h2
                id={titleId}
                className="mt-2 font-display text-[1.65rem] font-bold leading-none tracking-[-0.05em] text-[#f4f1ea] sm:text-[1.85rem]"
              >
                Kısa bir brifle başlayalım.
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="-mr-1 inline-flex size-11 items-center justify-center rounded-full text-white/50 transition hover:text-[#f4f1ea]"
            >
              <span aria-hidden className="relative block size-4">
                <span className="absolute left-0 top-1/2 h-[1.5px] w-full -translate-y-1/2 rotate-45 rounded-full bg-current" />
                <span className="absolute left-0 top-1/2 h-[1.5px] w-full -translate-y-1/2 -rotate-45 rounded-full bg-current" />
              </span>
            </button>
          </div>

          {status === "sent" ? (
            <div className="mt-8">
              <p className="text-[15px] leading-7 text-white/65">
                Talebiniz bize ulaştı. En kısa sürede sizinle iletişime
                geçeceğiz.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 flex min-h-[3.25rem] w-full items-center justify-center rounded-full bg-[#f4f1ea] px-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition hover:bg-[#e91825] hover:text-white"
              >
                Kapat
              </button>
            </div>
          ) : (
            <form className="mt-7 space-y-3.5" onSubmit={onSubmit}>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <Field
                  ref={firstFieldRef}
                  name="firstName"
                  label="İsim"
                  autoComplete="given-name"
                />
                <Field
                  name="lastName"
                  label="Soyisim"
                  autoComplete="family-name"
                />
              </div>
              <Field
                name="company"
                label="Firma ismi"
                autoComplete="organization"
              />
              <Field
                name="phone"
                label="Telefon"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
              />
              <div aria-hidden className="hidden">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" name="website" />
                </label>
              </div>

              {status === "error" ? (
                <p className="text-[13px] text-[#e91825]">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={status === "sending"}
                className="mt-2 flex min-h-[3.25rem] w-full items-center justify-center rounded-full bg-[#f4f1ea] px-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition hover:bg-[#e91825] hover:text-white disabled:cursor-wait disabled:opacity-70"
              >
                {status === "sending" ? "Gönderiliyor…" : "Gönder"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  autoComplete,
  inputMode,
  ref,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  ref?: Ref<HTMLInputElement>;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
        {label}
      </span>
      <input
        ref={ref}
        id={id}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="min-h-12 w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 text-[15px] text-[#f4f1ea] outline-none transition placeholder:text-white/25 focus:border-[#e91825]/70"
      />
    </label>
  );
}
