// Builds the body for PATCH /v1/projects/{ref}/config/auth from the files in this
// folder. Run by .github/workflows/auth-config.yml; prints JSON to stdout.
import { readFileSync } from "node:fs";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");

const settings = JSON.parse(read("./settings.json"));
const product = JSON.parse(read("../../src/config/product.json"));

settings.mailer_templates_magic_link_content = read("./magic-link.html");

// Custom SMTP through Resend. Without it Supabase only emails the project's team.
const resendApiKey = process.env.RESEND_API_KEY;
if (resendApiKey) {
  Object.assign(settings, {
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: resendApiKey,
    // Resend's test sender. Replace with an address on our own domain once we have one.
    smtp_admin_email: "onboarding@resend.dev",
    smtp_sender_name: product.name,
  });
}

process.stdout.write(JSON.stringify(settings));
