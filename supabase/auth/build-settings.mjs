// Builds the bodies for PATCH /v1/projects/{ref}/config/auth from the files in this
// folder. Run by .github/workflows/auth-config.yml; prints JSON to stdout.
//
//   node supabase/auth/build-settings.mjs settings   -> site URL, sign-ups, code length, SMTP, email limit
//   node supabase/auth/build-settings.mjs email      -> Spanish login email (needs custom SMTP)
import { readFileSync } from "node:fs";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");

const SUBJECT = "Tu código de acceso: {{ .Token }}";

function settings() {
  const body = JSON.parse(read("./settings.json"));
  const product = JSON.parse(read("../../src/config/product.json"));
  // Custom SMTP. Without it Supabase only emails the project's team and doesn't allow
  // changing the email templates on the free plan. The business's Gmail (with an app
  // password) can write to anyone; Resend's test sender only to the Resend account's owner.
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  const resendApiKey = process.env.RESEND_API_KEY;
  if (gmailUser && gmailPassword) {
    Object.assign(body, {
      smtp_host: "smtp.gmail.com",
      smtp_port: "465",
      smtp_user: gmailUser,
      smtp_pass: gmailPassword,
      smtp_admin_email: gmailUser,
      smtp_sender_name: product.name,
      // Supabase starts at 2 emails per hour for the whole project. Gmail allows about
      // 500 a day; each login sends one.
      rate_limit_email_sent: 30,
    });
  } else if (resendApiKey) {
    Object.assign(body, {
      smtp_host: "smtp.resend.com",
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: resendApiKey,
      // Resend's test sender. Replace with an address on our own domain once we have one.
      smtp_admin_email: "onboarding@resend.dev",
      smtp_sender_name: product.name,
      // Supabase starts at 2 emails per hour for the whole project. Resend's free plan
      // allows 100 a day; each login sends one.
      rate_limit_email_sent: 30,
    });
  }
  return body;
}

function email() {
  return {
    mailer_subjects_magic_link: SUBJECT,
    mailer_templates_magic_link_content: read("./magic-link.html"),
  };
}

const part = process.argv[2];
if (part !== "settings" && part !== "email") {
  console.error("Usage: build-settings.mjs settings|email");
  process.exit(1);
}
process.stdout.write(JSON.stringify(part === "settings" ? settings() : email()));
