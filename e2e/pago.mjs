// End-to-end check of paying online, against the local emulator, which also fakes Mercado
// Pago and Resend (see supabase/local/server.mjs). Needs .env.local with the local
// Mercado Pago and Resend values from .env.example.
// Env: CHROMIUM_PATH (default: the preinstalled Playwright Chromium), APP_URL (default http://localhost:3300).
import { chromium } from "playwright-core";
const exe = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = new URL("./screenshots/", import.meta.url).pathname;
const base = process.env.APP_URL ?? "http://localhost:3300";
const emulator = "http://127.0.0.1:54321";
(await import("node:fs")).mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-MX" });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
const step = (msg) => console.log("•", msg);
const text = async (selector) => (await page.locator(selector).first().innerText()).replace(/\s+/g, " ").trim();
const check = (ok, what) => {
  if (!ok) throw new Error(`Failed: ${what}`);
};

const dayInMexico = (offsetDays) =>
  String(Number(new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }).slice(8, 10)));

// Emails the fake Resend received (the business is told once per confirmed booking).
async function emailsSent(expected) {
  for (let i = 0; i < 20; i++) {
    const emails = await (await fetch(`${emulator}/resend/emails`)).json();
    if (emails.length >= expected) return emails;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return (await fetch(`${emulator}/resend/emails`)).json();
}

async function quote({ days, phone }) {
  await page.goto(`${base}/jbsbros`);
  await page.click("button:has-text('Carro normal')");
  await page.click("button:has-text('Lavado normal')");
  await page.click("button:has-text('Capital Norte')");
  await page
    .locator("section", { hasText: "Día y horario" })
    .locator(`button[aria-pressed]:has(span.text-lg:text-is("${dayInMexico(days)}"))`)
    .click();
  await page.locator("button.block:has-text('Tarde')").click();
  await page.fill("input[name=name]", "Ana López");
  await page.fill("input[name=phone]", phone);
  await page.fill("input[name=address]", "Av. Siempre Viva 742");
  await page.click("text=Ver resumen");
  await page.waitForSelector("text=¿Cuánto quieres pagar ahora?");
}

// 1. Deposit, approved; Mercado Pago's webhook confirms it.
await quote({ days: 2, phone: "3312345678" });
step("choices: " + JSON.stringify(await page.locator("section", { hasText: "¿Cuánto quieres pagar ahora?" }).locator("button").allInnerTexts()));
await page.click("button:has-text('con Mercado Pago')");
step("without accepting terms: " + (await text("p[aria-live]")));
await page.check("input[name=acceptTerms]");
await shot("20-pago-resumen");
step("pay button: " + (await text("button:has-text('con Mercado Pago')")));
await page.click("button:has-text('con Mercado Pago')");
await page.waitForURL(/\/mercadopago\/checkout\//);
step("checkout: " + (await text("h1")) + " · " + (await text("p")));
await page.click("button:has-text('Pagar (aprobado)')");
await page.waitForURL(/\/jbsbros\/reserva\//);
await page.waitForSelector("text=¡Listo! Tu reserva está confirmada");
const folio = (await text("section")).match(/JBS-\d+/)?.[0];
step("confirmed: " + (await text("section")) + " | " + (await text("section >> nth=1")));
const wa = await page.locator("a:has-text('por WhatsApp')").getAttribute("href");
check(wa.startsWith("https://wa.me/52") && decodeURIComponent(wa).includes(folio), "WhatsApp message has the folio");
console.log(decodeURIComponent(wa.split("?text=")[1]));
await shot("21-pago-confirmado");
await page.reload();
await page.waitForSelector("text=¡Listo! Tu reserva está confirmada");
let emails = await emailsSent(1);
step(`business emails: ${emails.length} · ${emails[0]?.subject}`);
check(emails.length === 1, "one email for the first booking");

// 2. Everything at once; no webhook, so the return page asks Mercado Pago itself.
await quote({ days: 3, phone: "3398765432" });
await page.click("button:has-text('Pagar todo')");
await page.check("input[name=acceptTerms]");
step("pay button: " + (await text("button:has-text('con Mercado Pago')")));
await page.click("button:has-text('con Mercado Pago')");
await page.waitForURL(/\/mercadopago\/checkout\//);
await page.click("button:has-text('Pagar sin aviso (aprobado)')");
await page.waitForSelector("text=¡Listo! Tu reserva está confirmada");
step("paid in full: " + (await text("section >> nth=1")));
check((await text("section >> nth=1")).includes("pagado completo"), "shows it was paid in full");
emails = await emailsSent(2);
check(emails.length === 2, "one email for the second booking");

// 3. Rejected card: the hold stays, and the customer can try again.
await quote({ days: 4, phone: "3300000002" });
await page.check("input[name=acceptTerms]");
await page.click("button:has-text('con Mercado Pago')");
await page.waitForURL(/\/mercadopago\/checkout\//);
await page.click("button:has-text('Pagar (rechazado)')");
await page.waitForSelector("text=Tu pago no se completó");
step("rejected: " + (await text("section")));
await shot("22-pago-rechazado");
await page.click("a:has-text('Pagar con Mercado Pago')");
await page.waitForURL(/\/mercadopago\/checkout\//);
await page.click("button:has-text('Pagar (aprobado)')");
await page.waitForSelector("text=¡Listo! Tu reserva está confirmada");
step("second try confirmed");
emails = await emailsSent(3);
check(emails.length === 3, "one email per confirmed booking");

// 4. Forged notifications are refused.
const forged = await fetch(`${base}/api/webhooks/mercadopago?data.id=9000001&type=payment`, {
  method: "POST",
  headers: { "x-signature": "ts=1,v1=abc", "x-request-id": "x", "content-type": "application/json" },
  body: "{}",
});
step(`forged webhook: HTTP ${forged.status}`);
check(forged.status === 401, "forged webhook refused");

// 5. A booking link that doesn't exist.
const missing = await page.goto(`${base}/jbsbros/reserva/00000000-0000-4000-8000-000000000000`);
step(`unknown booking: HTTP ${missing.status()}`);

console.log("page errors:", errors.length ? errors : "none");
await browser.close();
if (errors.length) process.exit(1);
