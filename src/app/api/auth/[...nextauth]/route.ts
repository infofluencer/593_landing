import type { NextRequest } from "next/server";
import { handlers } from "@/auth";

/**
 * Auth.js builds absolute URLs from AUTH_URL / forwarded host.
 * Without a per-request bind, multi-tenant hosts (demo.localhost) collapse to
 * the process listen address (localhost) and break cookies / redirects.
 */
function bindRequestAuthUrl(req: NextRequest) {
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (!host) return;
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");
  process.env.AUTH_URL = `${proto}://${host}`;
  process.env.AUTH_TRUST_HOST = "true";
}

export async function GET(req: NextRequest) {
  bindRequestAuthUrl(req);
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  bindRequestAuthUrl(req);
  return handlers.POST(req);
}
