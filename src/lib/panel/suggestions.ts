import type { SuggestionKind, SuggestionStatus } from "@prisma/client";

export const SUGGESTION_KINDS: Array<{ value: SuggestionKind; label: string }> = [
  { value: "idea", label: "Öneri" },
  { value: "request", label: "İstek" },
  { value: "bug", label: "Hata" },
];

export const SUGGESTION_STATUSES: Array<{ value: SuggestionStatus; label: string }> = [
  { value: "new", label: "Yeni" },
  { value: "reviewing", label: "İnceleniyor" },
  { value: "done", label: "Yapıldı" },
  { value: "rejected", label: "Yapılmayacak" },
];

export const SUGGESTION_BODY_MAX = 2000;

export const suggestionSelect = {
  id: true,
  kind: true,
  body: true,
  status: true,
  createdAt: true,
  author: { select: { id: true, name: true, email: true } },
} as const;

export type SerializedSuggestion = {
  id: string;
  kind: SuggestionKind;
  body: string;
  status: SuggestionStatus;
  createdAt: string;
  author: { id: string; name: string | null; email: string } | null;
};

export function serializeSuggestion(s: {
  id: string;
  kind: SuggestionKind;
  body: string;
  status: SuggestionStatus;
  createdAt: Date;
  author: { id: string; name: string | null; email: string } | null;
}): SerializedSuggestion {
  return { ...s, createdAt: s.createdAt.toISOString() };
}
