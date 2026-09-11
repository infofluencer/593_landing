/**
 * List BM owned+client ad accounts and suggest panel slug → act_ map.
 *
 * Requires .env: META_BUSINESS_ID + META_SYSTEM_USER_TOKEN
 *
 *   npx tsx scripts/fetch-meta-ad-accounts.ts
 *   npx tsx scripts/fetch-meta-ad-accounts.ts --write   # update meta-ad-account-map.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { GOOGLE_ADS_CUSTOMER_BY_SLUG } from "../src/lib/panel/google-ads-customer-map";

type MetaAdAccount = {
  id: string;
  account_id: string;
  name: string;
  currency?: string;
  account_status?: number;
  source: "owned" | "client";
};

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  try {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env) || !process.env[k]) process.env[k] = v;
    }
  } catch {
    // ignore
  }
}

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function actId(row: { id?: string; account_id?: string }): string {
  if (row.id?.startsWith("act_")) return row.id;
  const digits = String(row.account_id || row.id || "").replace(/\D/g, "");
  return `act_${digits}`;
}

async function graphPages(
  path: string,
  token: string,
): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  let url: string | null =
    path.startsWith("http")
      ? path
      : `https://graph.facebook.com/v21.0/${path}${
          path.includes("?") ? "&" : "?"
        }access_token=${encodeURIComponent(token)}`;

  while (url) {
    const res = await fetch(url);
    const json = (await res.json()) as {
      data?: Array<Record<string, unknown>>;
      paging?: { next?: string };
      error?: { message?: string };
    };
    if (!res.ok || json.error) {
      throw new Error(json.error?.message || `Graph ${res.status}`);
    }
    out.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }
  return out;
}

/** Score how well a Meta account name matches a panel slug / label. */
function matchScore(accountName: string, slug: string): number {
  const a = norm(accountName);
  const s = norm(slug.replace(/-/g, " "));
  if (!a || !s) return 0;
  if (a === s) return 100;
  if (a.includes(s) || s.includes(a)) return 80;
  const aTokens = new Set(a.split(" ").filter((t) => t.length > 2));
  const sTokens = s.split(" ").filter((t) => t.length > 2);
  let hit = 0;
  for (const t of sTokens) if (aTokens.has(t) || a.includes(t)) hit++;
  if (sTokens.length && hit === sTokens.length) return 70;
  if (hit > 0) return 40 + hit * 10;
  return 0;
}

async function main() {
  loadEnvFile();
  const token = process.env.META_SYSTEM_USER_TOKEN?.trim();
  const bm = process.env.META_BUSINESS_ID?.trim();
  if (!token || !bm) {
    console.error(
      "META_SYSTEM_USER_TOKEN ve META_BUSINESS_ID gerekli (.env / Dokploy).",
    );
    process.exit(1);
  }
  if (!/^\d+$/.test(bm)) {
    console.error("META_BUSINESS_ID yalnızca rakam olmalı.");
    process.exit(1);
  }

  const fields = "id,account_id,name,currency,account_status";
  const ownedRaw = await graphPages(
    `${bm}/owned_ad_accounts?fields=${encodeURIComponent(fields)}&limit=100`,
    token,
  );
  const clientRaw = await graphPages(
    `${bm}/client_ad_accounts?fields=${encodeURIComponent(fields)}&limit=100`,
    token,
  );

  const seen = new Set<string>();
  const accounts: MetaAdAccount[] = [];
  for (const [source, rows] of [
    ["owned", ownedRaw],
    ["client", clientRaw],
  ] as const) {
    for (const row of rows) {
      const id = actId(row as { id?: string; account_id?: string });
      if (seen.has(id)) continue;
      seen.add(id);
      accounts.push({
        id,
        account_id: String(
          (row as { account_id?: string }).account_id || id.replace(/\D/g, ""),
        ),
        name: String((row as { name?: string }).name || id),
        currency: (row as { currency?: string }).currency,
        account_status: (row as { account_status?: number }).account_status,
        source,
      });
    }
  }

  console.log(`BM ${bm} → ${accounts.length} ad account\n`);
  for (const a of accounts) {
    console.log(
      `${a.source.padEnd(6)} ${a.id}  ${a.name}  (${a.currency || "?"})`,
    );
  }

  const panelSlugs = Object.keys(GOOGLE_ADS_CUSTOMER_BY_SLUG);
  const bySlug: Record<string, string> = {};
  const byName: Record<string, string> = {};
  const usedActs = new Set<string>();

  for (const slug of panelSlugs) {
    let best: { id: string; name: string; score: number } | null = null;
    for (const a of accounts) {
      if (usedActs.has(a.id)) continue;
      const score = matchScore(a.name, slug);
      if (score < 40) continue;
      if (!best || score > best.score) {
        best = { id: a.id, name: a.name, score };
      }
    }
    if (best) {
      bySlug[slug] = best.id;
      byName[norm(best.name)] = best.id;
      usedActs.add(best.id);
      console.log(`\nmap  ${slug} ← ${best.id} (${best.name}, score=${best.score})`);
    } else {
      console.log(`\nskip ${slug} — eşleşen Meta hesabı yok`);
    }
  }

  const unmatched = accounts.filter((a) => !usedActs.has(a.id));
  if (unmatched.length) {
    console.log("\n--- Eşleşmeyen Meta hesapları ---");
    for (const a of unmatched) {
      console.log(`  ${a.id}  ${a.name}`);
      byName[norm(a.name)] = a.id;
    }
  }

  const write = process.argv.includes("--write");
  if (!write) {
    console.log("\nMap dosyasını güncellemek için: --write");
    return;
  }

  const mapPath = resolve(
    process.cwd(),
    "src/lib/panel/meta-ad-account-map.ts",
  );
  let src = readFileSync(mapPath, "utf8");

  const slugBlock = Object.entries(bySlug)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, id]) => `  ${JSON.stringify(slug)}: ${JSON.stringify(id)},`)
    .join("\n");

  const nameBlock = Object.entries(byName)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, id]) => `  ${JSON.stringify(name)}: ${JSON.stringify(id)},`)
    .join("\n");

  src = src.replace(
    /export const META_AD_ACCOUNT_BY_SLUG: Record<string, string> = \{[\s\S]*?\n\};/,
    `export const META_AD_ACCOUNT_BY_SLUG: Record<string, string> = {\n${slugBlock}\n};`,
  );
  src = src.replace(
    /export const META_AD_ACCOUNT_BY_NAME: Record<string, string> = \{[\s\S]*?\n\};/,
    `export const META_AD_ACCOUNT_BY_NAME: Record<string, string> = {\n${nameBlock}\n};`,
  );

  writeFileSync(mapPath, src);
  console.log(
    `\nWrote ${Object.keys(bySlug).length} slug + ${Object.keys(byName).length} name entries → ${mapPath}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
