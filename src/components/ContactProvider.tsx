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
  type ReactNode,
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
      <ContactChat open={open} onClose={closeModal} />
    </ContactContext.Provider>
  );
}

type Step = "name" | "company" | "phone" | "sending" | "done" | "error";

type ChatMsg = {
  id: string;
  from: "bot" | "user";
  text: string;
  time: string;
};

function nowTime() {
  return new Date().toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

const PLACEHOLDERS: Record<"name" | "company" | "phone", string> = {
  name: "Adınız ve soyadınız",
  company: "Firma adınız",
  phone: "Telefon numaranız",
};

function ContactChat({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const msgId = useRef(0);

  const [step, setStep] = useState<Step>("name");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [answers, setAnswers] = useState({
    firstName: "",
    lastName: "",
    company: "",
    phone: "",
  });
  const [boot, setBoot] = useState(0);
  const [locked, setLocked] = useState(false);

  const push = useCallback((from: "bot" | "user", text: string) => {
    msgId.current += 1;
    setMessages((prev) => [
      ...prev,
      { id: `m${msgId.current}`, from, text, time: nowTime() },
    ]);
  }, []);

  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";

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
    if (!open) return;

    msgId.current = 0;
    setMessages([]);
    setDraft("");
    setError("");
    setHoneypot("");
    setAnswers({ firstName: "", lastName: "", company: "", phone: "" });
    setStep("name");
    setBoot(0);
    setLocked(false);

    const timers = [
      window.setTimeout(() => {
        push("bot", "Merhaba 👋");
        setBoot(1);
      }, 280),
      window.setTimeout(() => {
        push(
          "bot",
          "593 E-Marketing ailesine hoş geldiniz. Size özel bir teklif hazırlamak için birkaç bilgi alalım.",
        );
        setBoot(2);
      }, 900),
      window.setTimeout(() => {
        push("bot", "Öncelikle nasıl hitap etmemizi istersiniz?");
        setBoot(3);
      }, 1600),
    ];

    return () => timers.forEach(clearTimeout);
  }, [open, push]);

  useEffect(() => {
    if (!open || boot < 3) return;
    const t = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 80);
    return () => clearTimeout(t);
  }, [open, boot, step]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, step, error]);

  async function submitContact(payload: typeof answers) {
    setStep("sending");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, website: honeypot }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Gönderilemedi.");
      }
      push(
        "bot",
        "Teşekkürler! Talebiniz bize ulaştı. En kısa sürede sizinle iletişime geçeceğiz.",
      );
      setStep("done");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Bir sorun oluştu. Lütfen tekrar deneyin.";
      setError(msg);
      push("bot", "Bir sorun oluştu. Bilgilerinizi kontrol edip tekrar deneyin.");
      setStep("error");
    }
  }

  function onSend(e?: FormEvent) {
    e?.preventDefault();
    if (locked || step === "sending" || step === "done" || boot < 3) return;

    const value = draft.trim();
    if (!value) return;

    if (step === "name") {
      const { firstName, lastName } = splitName(value);
      if (!firstName) return;
      push("user", value);
      setDraft("");
      setLocked(true);
      const next = { ...answers, firstName, lastName };
      setAnswers(next);
      window.setTimeout(() => {
        push("bot", `Memnun oldum ${firstName}. Firma adınız nedir?`);
        setStep("company");
        setLocked(false);
      }, 420);
      return;
    }

    if (step === "company") {
      push("user", value);
      setDraft("");
      setLocked(true);
      const next = { ...answers, company: value };
      setAnswers(next);
      window.setTimeout(() => {
        push("bot", "Harika. Size ulaşabileceğimiz telefon numaranız?");
        setStep("phone");
        setLocked(false);
      }, 420);
      return;
    }

    if (step === "phone" || step === "error") {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 10) {
        setError("Geçerli bir telefon numarası girin.");
        return;
      }
      setError("");
      push("user", value);
      setDraft("");
      const next = { ...answers, phone: value };
      setAnswers(next);
      void submitContact(next);
    }
  }

  if (!open) return null;

  const inputStep =
    step === "error"
      ? "phone"
      : step === "name" || step === "company" || step === "phone"
        ? step
        : null;
  const showComposer = inputStep !== null && boot >= 3;
  const canType = showComposer && !locked;

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

      <div className="relative flex h-[min(100dvh,42rem)] w-full max-w-[24.5rem] flex-col overflow-hidden rounded-t-[1.75rem] border border-white/10 bg-[#1c1818] shadow-[0_32px_90px_-28px_rgba(0,0,0,0.9)] sm:h-[min(88dvh,40rem)] sm:rounded-[1.75rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at top right, rgba(233,24,37,0.14), transparent 55%),
              radial-gradient(circle at 20% 80%, rgba(244,241,234,0.04), transparent 40%),
              repeating-linear-gradient(
                -18deg,
                transparent,
                transparent 12px,
                rgba(244,241,234,0.018) 12px,
                rgba(244,241,234,0.018) 13px
              )
            `,
          }}
        />

        <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#141111]/90 px-3 py-3 backdrop-blur-md sm:px-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Geri"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white/55 transition hover:bg-white/5 hover:text-[#f4f1ea]"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
              <path
                d="M15 5 8 12l7 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className="min-w-0 flex-1 text-center">
            <h2
              id={titleId}
              className="font-logo text-[15px] font-bold tracking-[0.04em] text-[#f4f1ea]"
            >
              593 E-MARKETING
            </h2>
            <p className="mt-0.5 flex items-center justify-center gap-1.5 text-[11px] text-white/45">
              <span
                aria-hidden
                className="inline-block size-1.5 rounded-full bg-[#22c55e]"
              />
              Online · Genelde aynı gün yanıt veriyoruz
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white/40 transition hover:bg-white/5 hover:text-[#f4f1ea]"
          >
            <span aria-hidden className="relative block size-3.5">
              <span className="absolute left-0 top-1/2 h-[1.5px] w-full -translate-y-1/2 rotate-45 rounded-full bg-current" />
              <span className="absolute left-0 top-1/2 h-[1.5px] w-full -translate-y-1/2 -rotate-45 rounded-full bg-current" />
            </span>
          </button>
        </header>

        <div
          ref={listRef}
          className="relative z-10 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3.5 py-4 sm:px-4"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={[
                "contact-chat-in flex",
                m.from === "user" ? "justify-end" : "justify-start",
              ].join(" ")}
            >
              <div
                className={[
                  "max-w-[85%] rounded-[1.15rem] px-3.5 py-2.5 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.7)]",
                  m.from === "user"
                    ? "rounded-br-md bg-[#e91825] text-[#f4f1ea]"
                    : "rounded-bl-md border border-white/8 bg-[#2a2424] text-[#f4f1ea]",
                ].join(" ")}
              >
                <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap">
                  {m.text}
                </p>
                <p
                  className={[
                    "mt-1 text-[10px] tabular-nums",
                    m.from === "user" ? "text-white/65" : "text-white/35",
                  ].join(" ")}
                >
                  {m.time}
                </p>
              </div>
            </div>
          ))}

          {step === "sending" ? (
            <div className="flex justify-start">
              <div className="rounded-[1.15rem] rounded-bl-md border border-white/8 bg-[#2a2424] px-3.5 py-3 text-[13px] text-white/50 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.7)]">
                Gönderiliyor…
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative z-10 shrink-0 border-t border-white/10 bg-[#141111]/95 px-3 pb-[max(0.85rem,var(--safe-b))] pt-2.5 backdrop-blur-md sm:px-3.5">
          {showComposer ? (
            <form
              className="flex items-end gap-2"
              onSubmit={onSend}
              autoComplete="on"
            >
              <div aria-hidden className="hidden">
                <label>
                  Website
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    name="website"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </label>
              </div>

              <label className="sr-only" htmlFor={`${titleId}-input`}>
                {PLACEHOLDERS[inputStep]}
              </label>
              <input
                ref={inputRef}
                id={`${titleId}-input`}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (error) setError("");
                }}
                type={inputStep === "phone" ? "tel" : "text"}
                inputMode={inputStep === "phone" ? "tel" : "text"}
                autoComplete={
                  inputStep === "name"
                    ? "name"
                    : inputStep === "company"
                      ? "organization"
                      : "tel"
                }
                disabled={locked}
                placeholder={PLACEHOLDERS[inputStep]}
                className="min-h-11 flex-1 rounded-full border border-white/12 bg-white/[0.04] px-4 text-[15px] text-[#f4f1ea] outline-none transition placeholder:text-white/30 focus:border-[#e91825]/70 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!canType || !draft.trim()}
                aria-label="Gönder"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#f4f1ea] text-[#141111] transition enabled:hover:bg-[#e91825] enabled:hover:text-white disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" className="size-[1.15rem]" fill="none" aria-hidden>
                  <path
                    d="M4.5 11.5 19 4.5l-4.2 15.2-3.3-5.6-7-2.5Z"
                    fill="currentColor"
                  />
                  <path
                    d="M11.5 14.1 19 4.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    opacity="0.35"
                  />
                </svg>
              </button>
            </form>
          ) : step === "done" ? (
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 w-full items-center justify-center rounded-full bg-[#f4f1ea] px-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition hover:bg-[#e91825] hover:text-white"
            >
              Kapat
            </button>
          ) : step === "sending" ? (
            <div className="flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-[13px] text-white/45">
              Gönderiliyor…
            </div>
          ) : (
            <div className="flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-[13px] text-white/35">
              Bir saniye…
            </div>
          )}

          {error ? (
            <p className="mt-2 text-center text-[12px] text-[#e91825]">{error}</p>
          ) : showComposer ? (
            <p className="mt-1.5 text-center text-[11px] text-white/30">
              Enter ile gönder
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
