/**
 * Playwright site tag verification.
 * GTM Admin API'de etiket olması ≠ sitede çalışıyor.
 * Consent senaryoları: default (dokunulmaz) / accept / reject.
 */

export type SiteVerifyScenarioId = "default" | "accept" | "reject";

export type TagSignals = {
  gtmScript: boolean;
  gtmContainerMatch: boolean;
  dataLayer: boolean;
  gaCollect: boolean;
  metaPixel: boolean;
  consentBannerSeen: boolean;
  consentClicked: boolean;
};

export type ScenarioResult = {
  id: SiteVerifyScenarioId;
  label: string;
  ok: boolean;
  signals: TagSignals;
  notes: string[];
  networkHits: string[];
};

export type SiteVerifyResult = {
  status: "pass" | "fail" | "partial" | "unknown" | "error";
  summary: string;
  scenarios: ScenarioResult[];
  findings: {
    url: string;
    expectedGtmPublicId: string | null;
    browserError?: string;
  };
  error: string | null;
};

const ACCEPT_SELECTORS = [
  "#onetrust-accept-btn-handler",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  "button#accept-cookies",
  '[data-testid="uc-accept-all-button"]',
  'button:has-text("Tümünü Kabul Et")',
  'button:has-text("Tümünü kabul et")',
  'button:has-text("Kabul Et")',
  'button:has-text("Kabul et")',
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("I agree")',
  'button:has-text("Allow all")',
];

const REJECT_SELECTORS = [
  "#onetrust-reject-all-handler",
  "#CybotCookiebotDialogBodyButtonDecline",
  '[data-testid="uc-deny-all-button"]',
  'button:has-text("Reddet")',
  'button:has-text("Tümünü Reddet")',
  'button:has-text("Reject all")',
  'button:has-text("Reject All")',
  'button:has-text("Decline")',
  'button:has-text("Only necessary")',
];

function normalizeUrl(website: string): string {
  const t = website.trim();
  if (!t) throw new Error("website boş");
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function extractGtmPublicId(mappingId: string | null | undefined): string | null {
  if (!mappingId) return null;
  // "123/456" → unknown public id; "GTM-XXXX" direct
  if (/^GTM-/i.test(mappingId)) return mappingId.toUpperCase();
  return null;
}

function classifyHits(
  urls: string[],
  expectedGtm: string | null,
): Pick<
  TagSignals,
  "gtmScript" | "gtmContainerMatch" | "gaCollect" | "metaPixel"
> {
  const joined = urls.join("\n").toLowerCase();
  const gtmScript =
    /googletagmanager\.com\/gtm\.js/.test(joined) ||
    /googletagmanager\.com\/gtag\/js/.test(joined);
  const gtmContainerMatch = expectedGtm
    ? joined.includes(expectedGtm.toLowerCase())
    : gtmScript;
  const gaCollect =
    /google-analytics\.com\/(g\/)?collect/.test(joined) ||
    /analytics\.google\.com\/g\/collect/.test(joined) ||
    /\/g\/collect\?/.test(joined);
  const metaPixel =
    /facebook\.com\/tr/.test(joined) ||
    /connect\.facebook\.net\/.*\/fbevents\.js/.test(joined);

  return { gtmScript, gtmContainerMatch, gaCollect, metaPixel };
}

async function tryClick(
  page: {
    locator: (s: string) => {
      first: () => {
        isVisible: (o: { timeout: number }) => Promise<boolean>;
        click: (o?: { timeout?: number }) => Promise<void>;
      };
    };
  },
  selectors: string[],
): Promise<boolean> {
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 800 })) {
        await loc.click({ timeout: 2000 });
        return true;
      }
    } catch {
      // try next
    }
  }
  return false;
}

/**
 * Run Playwright checks. Returns unknown/error if browser cannot start
 * (e.g. browsers not installed) — never invents a fake pass.
 */
export async function runSiteVerification(opts: {
  website: string;
  gtmContainerId?: string | null;
  /** mock mode: return deterministic not-pass without browser */
  mock?: boolean;
}): Promise<SiteVerifyResult> {
  const url = normalizeUrl(opts.website);
  const expectedGtm =
    extractGtmPublicId(opts.gtmContainerId) ||
    (opts.gtmContainerId && /^GTM-/i.test(opts.gtmContainerId)
      ? opts.gtmContainerId
      : null);

  if (opts.mock) {
    return {
      status: "unknown",
      summary:
        "Mock / PANEL_DATA_MODE≠live — site testi çalıştırılmadı. GTM config ≠ sitede çalışıyor.",
      scenarios: [],
      findings: { url, expectedGtmPublicId: expectedGtm },
      error: null,
    };
  }

  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (err) {
    return {
      status: "unknown",
      summary: "Playwright paketi yok — site doğrulanamadı.",
      scenarios: [],
      findings: {
        url,
        expectedGtmPublicId: expectedGtm,
        browserError: err instanceof Error ? err.message : String(err),
      },
      error: "playwright import failed",
    };
  }

  const scenarios: ScenarioResult[] = [];
  let browserError: string | undefined;

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage"],
    });

    const runScenario = async (
      id: SiteVerifyScenarioId,
      label: string,
      consent: "none" | "accept" | "reject",
    ): Promise<ScenarioResult> => {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (compatible; 593SiteVerify/1.0; +https://593emarketing.com)",
        locale: "tr-TR",
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();
      const hits: string[] = [];
      page.on("request", (req) => {
        const u = req.url();
        if (
          /googletagmanager|google-analytics|analytics\.google|facebook\.com\/tr|fbevents/i.test(
            u,
          )
        ) {
          hits.push(u.split("?")[0]!.slice(0, 180));
        }
      });

      const notes: string[] = [];
      let consentBannerSeen = false;
      let consentClicked = false;

      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
        await page.waitForTimeout(2500);

        // Detect common banner text
        const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(
          0,
          4000,
        );
        consentBannerSeen = /cookie|çerez|kvkk|gdpr|consent|izin/i.test(bodyText);

        if (consent === "accept") {
          consentClicked = await tryClick(page, ACCEPT_SELECTORS);
          if (!consentClicked) notes.push("Kabul butonu bulunamadı");
          await page.waitForTimeout(3000);
        } else if (consent === "reject") {
          consentClicked = await tryClick(page, REJECT_SELECTORS);
          if (!consentClicked) notes.push("Reddet butonu bulunamadı");
          await page.waitForTimeout(3000);
        } else {
          await page.waitForTimeout(2000);
        }

        const net = classifyHits(hits, expectedGtm);
        const dataLayer = await page.evaluate(() => {
          const w = window as unknown as { dataLayer?: unknown[] };
          return Array.isArray(w.dataLayer) && w.dataLayer.length > 0;
        });

        const signals: TagSignals = {
          ...net,
          dataLayer,
          consentBannerSeen,
          consentClicked,
        };

        // Pass criteria by scenario:
        // accept → expect GTM (and ideally GA or Meta) after consent
        // reject → GTM may load; GA/Meta ideally absent (note only)
        // default → observe only; GTM script presence is informative
        let ok = false;
        if (consent === "accept") {
          ok = signals.gtmScript || signals.dataLayer;
          if (!ok) notes.push("Kabul sonrası GTM/dataLayer görülmedi");
          if (ok && !signals.gaCollect && !signals.metaPixel) {
            notes.push("GTM var ama GA/Meta hit henüz yok (kısmi)");
          }
        } else if (consent === "reject") {
          // Reject scenario is observational — ok if page loads; warn if pixels fire hard
          ok = true;
          if (signals.gaCollect || signals.metaPixel) {
            notes.push(
              "Red sonrası ölçüm hit’i görüldü — consent uygulaması şüpheli",
            );
            ok = false;
          } else {
            notes.push("Red sonrası GA/Meta hit yok (beklenen davranış)");
          }
        } else {
          ok = signals.gtmScript || signals.dataLayer;
          if (!ok) {
            notes.push(
              "Varsayılan yüklemede GTM görülmedi (consent engeli olabilir)",
            );
          }
        }

        const uniqHits = [...new Set(hits)].slice(0, 12);
        await context.close();
        return { id, label, ok, signals, notes, networkHits: uniqHits };
      } catch (err) {
        await context.close().catch(() => {});
        return {
          id,
          label,
          ok: false,
          signals: {
            gtmScript: false,
            gtmContainerMatch: false,
            dataLayer: false,
            gaCollect: false,
            metaPixel: false,
            consentBannerSeen: false,
            consentClicked: false,
          },
          notes: [err instanceof Error ? err.message : String(err)],
          networkHits: [],
        };
      }
    };

    scenarios.push(
      await runScenario("default", "Varsayılan (çerez dokunulmaz)", "none"),
    );
    scenarios.push(
      await runScenario("accept", "Tümünü kabul et", "accept"),
    );
    scenarios.push(
      await runScenario("reject", "Reddet / yalnızca gerekli", "reject"),
    );

    await browser.close();
  } catch (err) {
    browserError = err instanceof Error ? err.message : String(err);
    return {
      status: "unknown",
      summary:
        "Tarayıcı başlatılamadı — site doğrulanamadı (Playwright browser kurulu mu?).",
      scenarios: [],
      findings: {
        url,
        expectedGtmPublicId: expectedGtm,
        browserError,
      },
      error: browserError,
    };
  }

  const accept = scenarios.find((s) => s.id === "accept");
  const reject = scenarios.find((s) => s.id === "reject");
  const def = scenarios.find((s) => s.id === "default");

  let status: SiteVerifyResult["status"] = "fail";
  let summary = "";

  if (accept?.ok && reject?.ok) {
    status = "pass";
    summary =
      "Kabul sonrası etiketler görünüyor; red sonrası ölçüm hit’i yok — site testi geçti.";
  } else if (accept?.ok && !reject?.ok) {
    status = "partial";
    summary =
      "Kabul sonrası GTM/ölçüm var; red senaryosu şüpheli veya buton bulunamadı.";
  } else if (def?.ok || accept?.ok) {
    status = "partial";
    summary =
      "Kısmi sinyal var; consent senaryoları tam geçmedi. GTM config ≠ kesin çalışıyor.";
  } else {
    status = "fail";
    summary =
      "Sitede GTM/dataLayer doğrulanamadı. Config’de etiket olsa bile sitede çalışmıyor olabilir.";
  }

  return {
    status,
    summary,
    scenarios,
    findings: { url, expectedGtmPublicId: expectedGtm, browserError },
    error: null,
  };
}
