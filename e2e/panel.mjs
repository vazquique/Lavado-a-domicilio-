// End-to-end check against the local Supabase emulator (see CLAUDE.md, "Probar la interfaz").
// Env: CHROMIUM_PATH (default: the preinstalled Playwright Chromium), APP_URL (default http://localhost:3300).
import { chromium } from "playwright-core";
const exe = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = new URL("./screenshots/", import.meta.url).pathname;
const base = process.env.APP_URL ?? "http://localhost:3300";
(await import("node:fs")).mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on("dialog", (dialog) => dialog.accept());
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
const step = (msg) => console.log("•", msg);

await page.goto(`${base}/panel`);
step(`redirected to ${new URL(page.url()).pathname}`);
await shot("01-entrar");

await page.fill("#email", "vazquique@gmail.com");
await page.click("button[type=submit]");
await page.waitForSelector("#code");
step("code step shown: " + (await page.locator("form p").first().innerText()));
await shot("02-codigo");

await page.fill("#code", "000000");
await page.click("button[type=submit]");
await page.waitForSelector("text=El código no es correcto");
step("wrong code rejected");

await page.fill("#code", "123456");
await page.click("button[type=submit]");
await page.waitForURL(`${base}/panel`);
await page.waitForSelector("text=Servicios y precios");
await page.waitForTimeout(1500);
step("logged in, h1s on page: " + JSON.stringify(await page.locator("h1").allInnerTexts()));
await shot("03-panel");

await page.click("text=Servicios y precios");
await page.waitForSelector("text=Principales");
await shot("04-servicios");
const rines = page.locator("details", { hasText: "Detallado de rines y llantas" }).first();
await rines.locator("summary").click();
const inputs = rines.locator("input[name^=price_]");
await inputs.nth(0).fill("150");
await inputs.nth(1).fill("180");
await inputs.nth(2).fill("230,50");
await rines.locator("button[type=submit]").click();
await rines.locator("text=escribe una cantidad").waitFor();
step("bad price rejected: " + (await rines.locator("[aria-live]").innerText()));
step("typed values kept after error: " + (await inputs.nth(0).inputValue()));
await inputs.nth(2).fill("200");
await rines.locator("button[type=submit]").click();
await rines.locator("text=Guardado.").waitFor();
step("prices saved");
await shot("05-servicios-guardado");

await page.goto(`${base}/panel/negocio`);
await page.waitForSelector("#whatsappPhone");
await shot("06-negocio");
await page.fill("#whatsappPhone", "33 1459");
await page.click("form >> text=Guardar");
await page.waitForSelector("text=WhatsApp: escribe los 10 dígitos");
step("bad WhatsApp rejected");
await page.fill("#whatsappPhone", "+52 33 1459 6017");
await page.locator("select[name=depositType]").selectOption("percent");
await page.fill("input[name=depositValue]", "50");
await page.click("form >> text=Guardar");
await page.waitForSelector("text=Guardado.");
step("business settings saved");

// Upload a logo (generated PNG)
const png = (await import("node:fs")).readFileSync(new URL("./fixtures/logo.png", import.meta.url));
await page.setInputFiles("input[type=file]", { name: "logo.png", mimeType: "image/png", buffer: png });
await page.waitForSelector("text=Logo actualizado.");
step("logo uploaded");
await shot("07-negocio-logo");

await page.goto(`${base}/panel/horarios`);
await page.waitForSelector("text=Franjas y lugares");
await page.fill("#blocked-date", "2026-12-25");
await page.fill("#blocked-reason", "Navidad");
await page.click("text=Bloquear día");
await page.waitForSelector("text=viernes, 25 de diciembre de 2026");
step("blocked date added");
await shot("08-horarios");

await page.goto(`${base}/panel/zonas`);
await page.click("summary:has-text('Agregar colonia o zona')");
await page.fill("#name-new", "Tesistán");
await page.fill("#surcharge-new", "50");
await page.locator("details form button[type=submit]").click();
await page.waitForSelector("text=Agregada.");
await page.waitForSelector("input[value='Tesistán']");
step("zone added");
const tesistan = page.locator("form", { has: page.locator("input[value='Tesistán']") });
await tesistan.locator("text=Borrar").click();
await page.waitForFunction(() => !document.querySelector("input[value='Tesistán']"));
step("zone deleted");
await shot("09-zonas");

await page.goto(`${base}/panel/vehiculos`);
await page.waitForSelector("input[value='Carro normal']");
await shot("10-vehiculos");

await page.goto(`${base}/jbsbros`);
await page.click("button:has-text('Carro normal')");
await page.click("button:has-text('Lavado normal')");
await page.waitForSelector("text=Detallado de rines y llantas");
step("public page extra: " + (await page.locator("button", { hasText: "Detallado de rines" }).innerText()).replace(/\s+/g, " "));
step("logo on public page: " + (await page.locator("img[alt^='Logo de']").count()));
await shot("11-publica");

await page.goto(`${base}/panel`);
await page.click("text=Salir");
await page.waitForURL(`${base}/panel/entrar`);
await page.goto(`${base}/panel/servicios`);
step("after logout, /panel/servicios -> " + new URL(page.url()).pathname);

console.log("page errors:", errors.length ? errors : "none");
await browser.close();
