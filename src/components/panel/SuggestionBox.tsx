"use client";

import type { SuggestionKind, SuggestionStatus } from "@prisma/client";
import {
  Bug,
  CheckCircle2,
  Lightbulb,
  Lock,
  MessageSquarePlus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { btnPrimary } from "@/components/panel/ds/buttons";
import {
  SUGGESTION_BODY_MAX,
  SUGGESTION_KINDS,
  SUGGESTION_STATUSES,
  type SerializedSuggestion,
} from "@/lib/panel/suggestions";

const KIND_META: Record<SuggestionKind, { Icon: LucideIcon; chip: string }> = {
  idea: { Icon: Lightbulb, chip: "bg-amber-50 text-amber-800 ring-amber-200" },
  request: { Icon: MessageSquarePlus, chip: "bg-sky-50 text-sky-800 ring-sky-200" },
  bug: { Icon: Bug, chip: "bg-rose-50 text-rose-700 ring-rose-200" },
};

const STATUS_STYLE: Record<SuggestionStatus, string> = {
  new: "bg-[#e91825] text-white",
  reviewing: "bg-amber-100 text-amber-900",
  done: "bg-emerald-100 text-emerald-800",
  rejected: "bg-zinc-200 text-zinc-600",
};

const kindLabel = (k: SuggestionKind) =>
  SUGGESTION_KINDS.find((x) => x.value === k)?.label ?? k;

export default function SuggestionBox({
  canView,
  initial,
}: {
  canView: boolean;
  initial: SerializedSuggestion[];
}) {
  const [kind, setKind] = useState<SuggestionKind>("idea");
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<SuggestionStatus | "all">("new");

  async function submit() {
    setError(null);
    setSent(false);
    setSending(true);
    try {
      const res = await fetch("/api/panel/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, body: text, anonymous }),
      });
      const j = (await res.json().catch(() => null)) as {
        suggestion?: SerializedSuggestion;
        error?: string;
      } | null;
      if (!res.ok) {
        setError(j?.error || "Gönderilemedi");
        return;
      }
      setText("");
      setSent(true);
      // Admin kendi gönderdiğini listede hemen görsün.
      if (canView && j?.suggestion) setItems((prev) => [j.suggestion!, ...prev]);
    } finally {
      setSending(false);
    }
  }

  async function setStatus(id: string, status: SuggestionStatus) {
    setError(null);
    const res = await fetch(`/api/panel/suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const j = (await res.json().catch(() => null)) as {
      suggestion?: SerializedSuggestion;
      error?: string;
    } | null;
    if (!res.ok || !j?.suggestion) {
      setError(j?.error || "Güncellenemedi");
      return;
    }
    setItems((prev) => prev.map((s) => (s.id === id ? j.suggestion! : s)));
  }

  async function remove(id: string) {
    if (!confirm("Bu öneri silinsin mi?")) return;
    setError(null);
    const res = await fetch(`/api/panel/suggestions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Silinemedi");
      return;
    }
    setItems((prev) => prev.filter((s) => s.id !== id));
  }

  const counts = useMemo(() => {
    const c: Record<SuggestionStatus | "all", number> = {
      all: items.length,
      new: 0,
      reviewing: 0,
      done: 0,
      rejected: 0,
    };
    for (const s of items) c[s.status] += 1;
    return c;
  }, [items]);

  const visible = filter === "all" ? items : items.filter((s) => s.status === filter);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e91825]/10 text-[#e91825]">
            <Lightbulb className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Öneri kutusu</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Panelle ilgili fikirlerini, isteklerini ya da gördüğün hataları yaz.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tür">
            {SUGGESTION_KINDS.map(({ value, label }) => {
              const { Icon } = KIND_META[value];
              const on = kind === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setKind(value)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition ${
                    on
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                  }`}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>

          <div>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSent(false);
              }}
              rows={5}
              maxLength={SUGGESTION_BODY_MAX}
              placeholder={
                kind === "bug"
                  ? "Hangi sayfada, ne yaparken oldu? Ne bekliyordun, ne oldu?"
                  : kind === "request"
                    ? "Hangi özelliği istiyorsun, işini nasıl kolaylaştırır?"
                    : "Aklındaki fikri yaz…"
              }
              className="w-full resize-y rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
            />
            <p className="mt-1 text-right text-[11px] tabular-nums text-zinc-400">
              {text.length}/{SUGGESTION_BODY_MAX}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="size-4 rounded border-zinc-300 accent-[#141111]"
              />
              Adım görünmesin (anonim)
            </label>
            <button
              type="button"
              disabled={sending || text.trim().length < 3}
              onClick={() => void submit()}
              className={`${btnPrimary} ml-auto disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {sending ? "Gönderiliyor…" : "Gönder"}
            </button>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Lock className="size-3.5" aria-hidden />
            Gönderilenleri yalnızca yöneticiler görür.
            {anonymous ? " Anonim gönderide adın hiç kaydedilmez." : ""}
          </p>

          {sent ? (
            <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="size-4" aria-hidden />
              Teşekkürler, iletildi.
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}
        </div>
      </section>

      {canView ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="mr-2 text-sm font-semibold text-zinc-800">Gelenler</h3>
            {(
              [{ value: "all" as const, label: "Tümü" }, ...SUGGESTION_STATUSES]
            ).map(({ value, label }) => {
              const on = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(value)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition ${
                    on
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  {label}
                  <span
                    className={`tabular-nums ${on ? "text-white/70" : "text-zinc-400"}`}
                  >
                    {counts[value]}
                  </span>
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
              {filter === "new" ? "Yeni öneri yok." : "Bu durumda öneri yok."}
            </p>
          ) : (
            <ul className="space-y-3">
              {visible.map((s) => {
                const { Icon, chip } = KIND_META[s.kind];
                return (
                  <li
                    key={s.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${chip}`}
                      >
                        <Icon className="size-3" aria-hidden />
                        {kindLabel(s.kind)}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {s.author ? (s.author.name || s.author.email) : "Anonim"} ·{" "}
                        {new Date(s.createdAt).toLocaleString("tr-TR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => void remove(s.id)}
                        className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Sil
                      </button>
                    </div>
                    <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                      {s.body}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3">
                      {SUGGESTION_STATUSES.map(({ value, label }) => {
                        const on = s.status === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={on}
                            onClick={() => (on ? undefined : void setStatus(s.id, value))}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                              on
                                ? STATUS_STYLE[value]
                                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
