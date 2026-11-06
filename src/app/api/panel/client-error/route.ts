import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * POST — panelin hata ekranı (error.tsx) tarayıcıda yakaladığı hatayı buraya
 * yollar; sunucu loguna tek satır JSON yazılır. Tarayıcı hataları başka hiçbir
 * yerde kalmadığı için tek iz bu. Yalnızca oturum açmış kullanıcılar.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  console.error(
    "[client-error]",
    JSON.stringify({
      at: new Date().toISOString(),
      user: session.user.email ?? session.user.id,
      role: session.user.role,
      digest: clip(body.digest, 64),
      message: clip(body.message, 1000),
      stack: clip(body.stack, 4000),
      url: clip(body.url, 500),
      userAgent: clip(request.headers.get("user-agent"), 300),
    }),
  );

  return NextResponse.json({ ok: true });
}
