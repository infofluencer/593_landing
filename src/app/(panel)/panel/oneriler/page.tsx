import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SuggestionBox from "@/components/panel/SuggestionBox";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/panel/host";
import { can } from "@/lib/panel/permissions";
import {
  serializeSuggestion,
  suggestionSelect,
} from "@/lib/panel/suggestions";

/** Öneri kutusu — herkes gönderir, gelenleri yalnızca admin görür. */
export default async function SuggestionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) redirect("/");

  const h = await headers();
  if (h.get("x-panel-mode") !== "staff") {
    redirect("/login?error=AccessDenied");
  }

  const canView = can(session.user.role, "suggestions.view");
  const suggestions = canView
    ? (
        await prisma.suggestion.findMany({
          select: suggestionSelect,
          orderBy: { createdAt: "desc" },
          take: 300,
        })
      ).map(serializeSuggestion)
    : [];

  return <SuggestionBox canView={canView} initial={suggestions} />;
}
