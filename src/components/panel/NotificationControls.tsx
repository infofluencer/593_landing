"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { btnPrimary, btnSecondary, fieldClass } from "@/components/panel/ds/buttons";

async function readError(res: Response, fallback: string): Promise<string> {
  const j = (await res.json().catch(() => null)) as { error?: string } | null;
  return j?.error || fallback;
}

/** WhatsApp ana anahtarı. Açmadan önce kaç uyarının gidebileceğini sorar. */
export function WhatsAppToggle({
  enabled,
  configured,
  pendingCount,
}: {
  enabled: boolean;
  configured: boolean;
  pendingCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    if (
      next &&
      !window.confirm(
        `WhatsApp bildirimleri açılacak. Bekleyen ${pendingCount} uyarı sonraki senkronda alıcılarına gidebilir. Devam edilsin mi?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/panel/notify/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappEnabled: next }),
      });
      if (!res.ok) {
        setError(await readError(res, "Ayar kaydedilemedi"));
        return;
      }
      router.refresh();
    } catch {
      setError("Sunucuya ulaşılamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="WhatsApp bildirimleri"
        disabled={busy || (!configured && !enabled)}
        onClick={() => void toggle()}
        className={enabled ? btnPrimary : btnSecondary}
      >
        <span
          aria-hidden
          className={`size-2 rounded-full ${enabled ? "bg-panel-ok" : "bg-zinc-400"}`}
        />
        {enabled ? "Açık — kapat" : "Kapalı — aç"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-panel-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Tek numaraya şablonlu test mesajı. Ana anahtar kapalıyken de çalışır. */
export function TestSendForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/panel/notify/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        setResult({ ok: false, text: await readError(res, "Test mesajı gönderilemedi") });
        return;
      }
      setResult({ ok: true, text: "Meta mesajı kabul etti. Telefona düştüğünü kontrol edin." });
      router.refresh();
    } catch {
      setResult({ ok: false, text: "Sunucuya ulaşılamadı" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-2">
      <label htmlFor="wa-test-phone" className="block text-sm font-medium text-panel-fg">
        Test mesajı gönder
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="wa-test-phone"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+90 5xx xxx xx xx"
          autoComplete="off"
          className={`${fieldClass} w-full sm:w-64`}
        />
        <button type="submit" disabled={busy || !configured} className={btnSecondary}>
          <Send className="size-4" aria-hidden />
          {busy ? "Gönderiliyor…" : "Gönder"}
        </button>
      </div>
      {result ? (
        <p
          role="status"
          className={`text-sm ${result.ok ? "text-panel-ok" : "text-panel-critical"}`}
        >
          {result.text}
        </p>
      ) : null}
    </form>
  );
}

/** Bekleyen tek uyarıyı alıcılarına elle iletir. */
export function SendAlertButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!window.confirm("Bu uyarı marka sorumlusuna ve ilgili ekibe gönderilsin mi?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/panel/notify/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      if (!res.ok) {
        setError(await readError(res, "Gönderilemedi"));
        return;
      }
      const j = (await res.json()) as { notified?: boolean };
      if (!j.notified) setError("İletilemedi; sebebi gönderim kaydında.");
      router.refresh();
    } catch {
      setError("Sunucuya ulaşılamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" disabled={busy} onClick={() => void send()} className={btnSecondary}>
        {busy ? "Gönderiliyor…" : "Gönder"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-panel-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}
