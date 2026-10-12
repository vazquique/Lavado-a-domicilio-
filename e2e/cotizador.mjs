// End-to-end check against the local Supabase emulator (see CLAUDE.md, "Probar la interfaz").
// Env: CHROMIUM_PATH (default: the preinstalled Playwright Chromium), APP_URL (default http://localhost:3300).
import { chromium } from "playwright-core";
const exe = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = new URL("./screenshots/", import.meta.url).pathname;
const base = process.env.APP_URL ?? "http://localhost:3300";
(await import("node:fs")).mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-MX" });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const shot = (name, fullPage = true) => page.screenshot({ path: `${outDir}/${name}.png`, fullPage });
const step = (msg) => console.log("•", msg);
const bar = () => page.locator("form#booking-form > div.fixed").innerText().then((t) => t.replace(/\s+/g, " ").trim());

await page.goto(`${base}/jbsbros`);
await page.waitForSelector("text=Tu vehículo");
await shot("01-inicio", false);

await page.click("button:has-text('Carro normal')");
step("services for car: " + (await page.locator("section", { hasText: "Servicio" }).first().innerText()).replace(/\s+/g, " "));
await page.click("button:has-text('Lavado normal')");
step("bar after base: " + (await bar()));
await page.click("button[role=checkbox]:has-text('Restauración de faros')");
step("bar after extra: " + (await bar()));
await page.click("button:has-text('Capital Norte')");

// Day buttons by day number (today disappears once no slot can be reached in time).
const dayInMexico = (offsetDays) =>
  String(Number(new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }).slice(8, 10)));
const dayButton = (offsetDays) =>
  page.locator("section", { hasText: "Día y horario" }).locator(`button[aria-pressed]:has(span.text-lg:text-is("${dayInMexico(offsetDays)}"))`);

// Tomorrow: the morning is full (3 of 3 places taken).
await dayButton(1).click();
const slotTexts = await page.locator("section", { hasText: "Día y horario" }).locator("button.block").allInnerTexts();
step("tomorrow slots: " + JSON.stringify(slotTexts.map((t) => t.replace(/\s+/g, " "))));
await page.locator("button.block:has-text('Tarde')").click();
await shot("02-eleccion");

await page.click("text=Ver resumen");
await page.waitForSelector("text=Escribe tu nombre", { timeout: 3000 }).catch(() => {});
step("validation without data: " + (await page.evaluate(() => document.querySelector("input[name=name]").validationMessage || "server")));

await page.fill("input[name=name]", "Ana López");
await page.fill("input[name=phone]", "33 1234 5678");
await page.fill("input[name=address]", "Av. Siempre Viva 742");
await page.fill("input[name=references]", "Portón negro");
await page.click("text=Ver resumen");
await page.waitForSelector("text=Tu cotización");
step("summary: " + (await page.locator("section").first().innerText()).replace(/\s+/g, " "));
const wa = await page.locator("a:has-text('Enviar por WhatsApp')").getAttribute("href");
step("whatsapp link: " + wa.slice(0, 40) + "…");
console.log(decodeURIComponent(wa.split("?text=")[1]));
await shot("03-resumen");

await page.click("text=Cambiar algo");
await page.waitForSelector("text=Tu vehículo");
step("back keeps choices, bar: " + (await bar()));

// Full detailing needs the whole slot: tomorrow's morning can't take it.
await page.click("button:has-text('Full detailing')");
await dayButton(1).click();
const fullSlots = await page.locator("section", { hasText: "Día y horario" }).locator("button.block").allInnerTexts();
step("full detailing tomorrow: " + JSON.stringify(fullSlots.map((t) => t.replace(/\s+/g, " "))));
step("bar with full detailing: " + (await bar()));
step("extras hidden with full detailing: " + ((await page.locator("text=Extras (opcional)").count()) === 0));

// Today: slots that start in less than 2 hours; the day is hidden when none is left.
if ((await dayButton(0).count()) === 0) {
  step("today: hidden (no slot can be reached in time)");
} else {
  await dayButton(0).click();
  const todaySlots = await page.locator("section", { hasText: "Día y horario" }).locator("button.block").allInnerTexts();
  step("today: " + JSON.stringify(todaySlots.map((t) => t.replace(/\s+/g, " "))));
}

await page.click("button:has-text('Mi colonia no está')");
const ask = await page.locator("a:has-text('Pregúntanos por WhatsApp')").getAttribute("href");
step("zone ask link: " + decodeURIComponent(ask));
await shot("04-otra-colonia");

console.log("page errors:", errors.length ? errors : "none");
await browser.close();
