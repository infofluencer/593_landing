import { chromium } from "playwright";
import { prisma } from "@/lib/db";
const OUT = "/private/tmp/claude-501/-Users-yusuf-Desktop-593/e8870013-f990-4fa0-bb76-e905bb34b53b/scratchpad/shots";
(async () => {
  const u = await prisma.user.findUnique({ where: { email: "bahex@593emarketing.com" }, select: { passwordPlain: true } });
  await prisma.$disconnect();
  const pass = u?.passwordPlain;
  if (!pass) throw new Error("no password");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto("http://bahex.localhost:3006/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "bahex@593emarketing.com");
  await page.fill('input[type="password"]', pass);
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
  console.log("after login", page.url());
  for (const path of ["/", "/meta", "/google", "/ga4", "/budget", "/faturalar"]) {
    const t0 = Date.now();
    const res = await page.goto(`http://bahex.localhost:3006${path}?period=1`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(800);
    const name = path === "/" ? "home" : path.slice(1);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log(path, res?.status(), `${Date.now() - t0}ms`, "title:", await page.title());
  }
  await browser.close();
})().catch((e) => { console.error("ERR", e); process.exit(1); });
