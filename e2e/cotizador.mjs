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
const serviceStep = page.locator("section", { has: page.locator("h2", { hasText: /Servicio$/ }) });
step("services for car: " + (await serviceStep.innerText()).replace(/\s+/g, " "));
await page.click("button:has-text('Lavado normal')");
step("bar after base: " + (await bar()));
// Extras stay folded until the customer asks for them.
step("extras folded: " + (await page.locator("button[aria-expanded=false]:has-text('¿Le agregamos algo')").innerText()).replace(/\s+/g, " "));
await page.click("button:has-text('¿Le agregamos algo')");
await page.click("button[role=checkbox]:has-text('Restauración de faros')");
step("bar after extra: " + (await bar()));
step("car drawing: " + (await page.locator("svg[role=img].car-diagram").first().getAttribute("aria-label")));
// "¿Qué es esto?" explains the service in plain words, with its steps.
const faros = page.locator("div.rounded-2xl", { hasText: "Restauración de faros" }).first();
await faros.locator("button[aria-expanded]").click();
step("explainer: " + (await faros.locator("p.leading-relaxed").innerText()).slice(0, 60) + "… steps: " + (await faros.locator("ol li").count()));
// Its own before/after picture: the tool on the handle wipes from one to the other.
const slider = faros.locator("[role=slider]");
await slider.focus();
await page.keyboard.press("Home");
step("before/after: " + (await slider.getAttribute("aria-valuetext")));
await page.keyboard.press("ArrowRight");
step("before/after →: " + (await slider.getAttribute("aria-valuetext")));
await faros.locator("button[aria-expanded]").click();
step("tabs: " + JSON.stringify(await page.locator("[role=tab]").allInnerTexts()));
await page.click("[role=tab]:has-text('Interior')");
step("interior extras: " + JSON.stringify(await page.locator("[role=tabpanel] button span.font-medium").allInnerTexts()));
await page.click("[role=tab]:has-text('Exterior')");
await page.click("button:has-text('Capital Norte')");

// Day buttons by day number (today disappears once no time can be reached in time).
const dayInMexico = (offsetDays) =>
  String(Number(new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }).slice(8, 10)));
const dayStep = page.locator("section", { has: page.locator("h2", { hasText: "Día y hora" }) });
const dayButton = (offsetDays) => dayStep.locator(`button[aria-pressed]:has(span.text-lg:text-is("${dayInMexico(offsetDays)}"))`);
// Each slot with its times ("10:20, ocupado" when taken), or why it has none.
const dayTimes = () =>
  dayStep.locator("[role=group]").evaluateAll((groups) =>
    groups.map((group) => {
      const times = [...group.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"));
      return `${group.getAttribute("aria-label")}: ${times.length ? times.join(" | ") : group.querySelector("p span:last-child")?.textContent}`;
    }),
  );

// Tomorrow: 10:20 is taken (seeded), the rest is free.
await dayButton(1).click();
step("tomorrow times: " + JSON.stringify(await dayTimes()));
const taken = dayStep.locator("button[aria-label='10:20, ocupado']");
if (!(await taken.isDisabled())) throw new Error("A taken time can be picked");
await dayStep.locator("[role=group][aria-label=Tarde] button[aria-label='14:40']").click();
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
const summary = page.locator("h2", { hasText: "Tu cotización" }).locator("xpath=following-sibling::section[1]");
step("summary: " + (await summary.innerText()).replace(/\s+/g, " "));
// With Mercado Pago set up, the summary asks for payment and keeps WhatsApp for questions.
const wa = await page.locator("a[href^='https://wa.me']").first().getAttribute("href");
step("whatsapp link: " + wa.slice(0, 40) + "…");
console.log(decodeURIComponent(wa.split("?text=")[1]));
await shot("03-resumen");

await page.click("text=Cambiar algo");
await page.waitForSelector("text=Tu vehículo");
step("back keeps choices, bar: " + (await bar()));

// Full detailing needs the whole slot: tomorrow's morning can't take it.
await page.click("button:has-text('Full detailing')");
await dayButton(1).click();
step("full detailing tomorrow: " + JSON.stringify(await dayTimes()));
step("bar with full detailing: " + (await bar()));
step("extras hidden with full detailing: " + ((await page.locator("text=Extras (opcional)").count()) === 0));

// Today: only times at least 2 hours away; the day is hidden when none is left.
if ((await dayButton(0).count()) === 0) {
  step("today: hidden (no time can be reached in time)");
} else {
  await dayButton(0).click();
  step("today: " + JSON.stringify(await dayTimes()));
}

await page.click("button:has-text('Mi colonia no está')");
const ask = await page.locator("a:has-text('Pregúntanos por WhatsApp')").getAttribute("href");
step("zone ask link: " + decodeURIComponent(ask));
await shot("04-otra-colonia");

console.log("page errors:", errors.length ? errors : "none");
await browser.close();
