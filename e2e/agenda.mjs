// End-to-end check of the panel's agenda against the local Supabase emulator (see CLAUDE.md).
// Run after e2e/seed-cotizador.mjs. Env: CHROMIUM_PATH, APP_URL (default http://localhost:3300).
import { chromium } from "playwright-core";
const exe = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = new URL("./screenshots/", import.meta.url).pathname;
const base = process.env.APP_URL ?? "http://localhost:3300";
(await import("node:fs")).mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-MX" });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
const step = (msg) => console.log("•", msg);
const notice = () => page.locator("section[aria-live] > p.rounded-lg").first().innerText();
const inMexico = (offsetDays) =>
  new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

// Sign in with the emulator's code.
await page.goto(`${base}/panel`);
await page.fill("#email", "vazquique@gmail.com");
await page.click("button[type=submit]");
await page.waitForSelector("#code");
await page.fill("#code", "123456");
await page.click("button[type=submit]");
await page.waitForURL(`${base}/panel`);
await page.waitForSelector("text=Agenda");
step("panel home: " + (await page.locator("a[href='/panel/agenda']").innerText()).replace(/\s+/g, " "));

await page.click("a[href='/panel/agenda']");
await page.waitForSelector("button[aria-pressed=true]");
step("selected day: " + (await page.locator("button[aria-pressed=true]").getAttribute("aria-label")));
await shot("20-agenda-hoy");

// Tomorrow has the seeded booking at 10:20; the other times show as free, ready to add.
const tomorrow = inMexico(1);
await page.goto(`${base}/panel/agenda?dia=${tomorrow}`);
await page.waitForSelector("article");
step("tomorrow: " + (await page.locator("section[aria-live] h2 + p").innerText()));
const morningRows = await page
  .locator("section[aria-live] > div", { has: page.locator("h3", { hasText: "Mañana" }) })
  .locator(":scope > div, :scope > article")
  .evaluateAll((rows) => rows.map((row) => row.innerText.replace(/\s+/g, " ").slice(0, 40)));
step("tomorrow morning by time: " + JSON.stringify(morningRows));

// Tapping a free time opens the form with that time already picked.
await page.click("a[aria-label='Agregar reserva a las 11:40']");
await page.waitForSelector("text=Agregar reserva");
await page.waitForSelector("button[aria-label='Mañana, 11:40'][aria-pressed=true]");
step("add from a free time: 11:40 picked, 10:20 taken: " + (await page.locator("button[aria-label='Mañana, 10:20, ocupado']").isDisabled()));

// Add a booking that came by WhatsApp, for the day after tomorrow.
const day = inMexico(2);
await page.goto(`${base}/panel/agenda/nueva?dia=${day}`);
await page.waitForSelector("text=Agregar reserva");
await page.fill("#customerName", "Carlos Pérez");
await page.fill("#customerPhone", "33 2222 3333");
await page.fill("#address", "Av. Patria 100, Zapopan");
await page.fill("#references", "Casa blanca");
await page.click("label:has-text('Lavado normal')");
await page.click("label:has-text('Restauración de faros')");
await page.selectOption("#zoneId", { label: "Capital Norte" });
await page.click("button[aria-label='Tarde, 16:20']");
await page.fill("#notes", "Me escribió por WhatsApp");
step("total shown: " + (await page.locator("form .sticky span.text-xl").innerText()));
await shot("21-agregar-reserva");
await page.click("button:has-text('Guardar reserva')");
await page.waitForURL(/\/panel\/agenda\?dia=/);
await page.waitForSelector("article");
step("after saving: " + (await notice()));

const card = page.locator("article", { hasText: "Carlos Pérez" });
step("card: " + (await card.innerText()).replace(/\s+/g, " ").slice(0, 160));
if (!(await card.innerText()).startsWith("16:20")) throw new Error("The card doesn't show its time");
const reminder = await card.locator("a:has-text('Recordatorio')").getAttribute("href");
step("reminder: " + decodeURIComponent(reminder.split("text=")[1]).split("\n").slice(0, 3).join(" | "));
await shot("22-dia-con-reserva");

await card.locator("button:has-text('Ya pagó')").click();
await page.waitForSelector("text=Saldo pagado.");
step("balance: " + (await notice()));
await card.locator("button:has-text('Terminado')").click();
await page.waitForSelector("article:has-text('Carlos Pérez') >> text=Terminada");
step("done: " + (await notice()));
await card.locator("button:has-text('Deshacer')").click();
await page.waitForSelector("article:has-text('Carlos Pérez') >> text=Confirmada");
step("undone: " + (await notice()));

// Move it to 9:00 the day after (free) and follow it there.
const later = inMexico(3);
await card.locator("button:has-text('Reagendar')").click();
await card.locator("input[type=date]").fill(later);
await card.locator("button[aria-label='Mañana, 9:00']").click();
await card.locator("button:has-text('Mover reserva')").click();
await page.waitForSelector("text=Listo, quedó para el");
await page.waitForSelector(`button[aria-pressed=true][aria-label^='${new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", weekday: "long" }).format(new Date(`${later}T12:00:00Z`))}']`);
await page.waitForSelector("article:has-text('Carlos Pérez')");
step("moved: " + (await notice()) + " · now showing " + (await page.locator("button[aria-pressed=true]").getAttribute("aria-label")));
await shot("23-reagendada");

// A taken time can't take it.
const moved = page.locator("article", { hasText: "Carlos Pérez" });
step("moved card: " + (await moved.innerText()).replace(/\s+/g, " ").slice(0, 40));
await moved.locator("button:has-text('Reagendar')").click();
await moved.locator("input[type=date]").fill(tomorrow);
const takenTime = moved.locator("button[aria-label='Mañana, 10:20, ocupado']");
await takenTime.waitFor();
step("tomorrow 10:20 can't be picked: " + (await takenTime.isDisabled()));
await moved.locator("button:text-is('Cancelar')").click();

// Cancel it: it goes to "Canceladas" and frees its place.
await moved.locator("button:has-text('Cancelar reserva')").click();
await moved.locator("button:has-text('Sí, cancelar')").click();
await page.waitForSelector("details:has-text('Canceladas y sin pagar') >> text=Carlos Pérez", { state: "attached" });
step("cancelled: " + (await notice()));

// The month view moves between months.
const monthTitle = page.locator("section h2").first();
const thisMonth = await monthTitle.innerText();
await page.click("a[aria-label='Mes siguiente']");
await page.waitForFunction((before) => document.querySelector("section h2")?.textContent !== before, thisMonth);
step(`next month: ${thisMonth} → ${await monthTitle.innerText()}`);
await shot("24-mes-siguiente");

console.log(errors.length ? "page errors: " + errors.join("\n") : "page errors: none");
await browser.close();
if (errors.length) process.exit(1);
