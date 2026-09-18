import {
  Brush,
  CheckCircle2,
  Circle,
  Eye,
  Handshake,
  Loader,
  type LucideIcon,
} from "lucide-react";
import { Ga4Mark, GoogleAdsMark, MetaMark } from "@/components/panel/ds/BrandMarks";

type MarkProps = { className?: string };

/** Takım slug/adına göre platform ikonu. */
export function TeamPlatformIcon({
  name,
  slug,
  className = "size-3.5",
}: {
  name?: string | null;
  slug?: string | null;
  className?: string;
}) {
  const key = `${slug ?? ""} ${name ?? ""}`.toLocaleLowerCase("tr");

  if (key.includes("meta")) {
    return <MetaMark className={className} />;
  }
  if (key.includes("google") && !key.includes("analytic")) {
    return <GoogleAdsMark className={className} />;
  }
  if (key.includes("analytic") || key.includes("ga4")) {
    return <Ga4Mark className={className} />;
  }
  if (key.includes("kreatif") || key.includes("creative")) {
    return <Brush className={className} aria-hidden strokeWidth={2} />;
  }
  if (
    key.includes("hesap") ||
    key.includes("account") ||
    key.includes("yonet")
  ) {
    return <Handshake className={className} aria-hidden strokeWidth={2} />;
  }
  return <DefaultTeamIcon className={className} />;
}

function DefaultTeamIcon({ className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <circle cx="12" cy="12" r="8" opacity="0.35" />
    </svg>
  );
}

export function getColumnStatusMeta(name: string): {
  Icon: LucideIcon;
  tone: string;
  bg: string;
} {
  const n = name.toLocaleLowerCase("tr");
  if (n.includes("tamam")) {
    return {
      Icon: CheckCircle2,
      tone: "text-emerald-700",
      bg: "bg-emerald-100",
    };
  }
  if (n.includes("incele")) {
    return { Icon: Eye, tone: "text-amber-700", bg: "bg-amber-100" };
  }
  if (n.includes("devam")) {
    return { Icon: Loader, tone: "text-blue-700", bg: "bg-blue-100" };
  }
  return { Icon: Circle, tone: "text-zinc-500", bg: "bg-zinc-100" };
}

/** Avatar rengi — id’den stabil. */
export function avatarTone(id: string): string {
  const tones = [
    "bg-sky-600",
    "bg-violet-600",
    "bg-teal-600",
    "bg-rose-600",
    "bg-amber-600",
    "bg-indigo-600",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % tones.length;
  return tones[h]!;
}
