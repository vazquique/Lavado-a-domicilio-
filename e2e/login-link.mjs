// End-to-end check against the local Supabase emulator (see CLAUDE.md, "Probar la interfaz").
// Env: CHROMIUM_PATH (default: the preinstalled Playwright Chromium), APP_URL (default http://localhost:3300).
import { chromium } from "playwright-core";
const exe = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = new URL("./screenshots/", import.meta.url).pathname;
const base = process.env.APP_URL ?? "http://localhost:3300";
(await import("node:fs")).mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: exe });
// Ask for the code in one browser...
const first = await (await browser.newContext()).newPage();
await first.goto(`${base}/panel/entrar`);
await first.fill("#email", "vazquique@gmail.com");
await first.click("button[type=submit]");
await first.waitForSelector("#code");
// ...and open the email button in another one (like Gmail's in-app browser).
const other = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await other.goto(`${base}/auth/confirm?token_hash=local-link&type=email`);
await other.waitForSelector("text=Servicios y precios");
console.log("• email button logs in from another browser:", new URL(other.url()).pathname);
await other.goto(`${base}/auth/confirm?token_hash=local-link&type=email`);
await other.waitForSelector("text=Ese enlace ya no sirve");
console.log("• reused link ->", new URL(other.url()).pathname + new URL(other.url()).search);
await other.screenshot({ path: `${outDir}/12-enlace-vencido.png` });
await browser.close();
