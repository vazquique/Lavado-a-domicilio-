// Finds out why the panel login email isn't arriving. This repository's logs are
// public, so it prints only yes/no facts, counts and error messages with emails masked.
const { SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID: ref, RESEND_API_KEY } = process.env;
const SLUG = "jbsbros";

const mask = (text) => String(text).replace(/[^\s@"'()<>,:]+@[^\s@"'()<>,:]+/g, "<email>");
const hide = (value) => value && console.log(`::add-mask::${value}`);

const management = (path) =>
  fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
    headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}` },
  });

const keysResponse = await management("/api-keys?reveal=true");
const keys = keysResponse.ok ? await keysResponse.json() : [];
const publishable = keys.find((key) => key.type === "publishable")?.api_key;
const secret = keys.find((key) => key.type === "secret")?.api_key;
hide(publishable);
hide(secret);
console.log("1. API keys:", keysResponse.status, "| publishable:", Boolean(publishable), "| secret:", Boolean(secret));
if (!publishable || !secret) process.exit(1);

const base = `https://${ref}.supabase.co`;
const asAdmin = { apikey: secret };
const rest = async (path) => {
  const response = await fetch(`${base}/rest/v1/${path}`, { headers: asAdmin });
  if (!response.ok) throw new Error(`${path.split("?")[0]}: ${response.status} ${mask(await response.text())}`);
  return response.json();
};

// The owner is whoever is invited to the business or already became its member.
const [business] = await rest(`businesses?select=id&slug=eq.${SLUG}`);
if (!business) {
  console.log("2. Business not found:", SLUG);
  process.exit(1);
}
const invites = await rest(`business_invites?select=email&business_id=eq.${business.id}`);
const members = await rest(`business_members?select=user_id&business_id=eq.${business.id}`);
const memberIds = new Set(members.map((member) => member.user_id));

const usersResponse = await fetch(`${base}/auth/v1/admin/users?per_page=100`, { headers: asAdmin });
const users = usersResponse.ok ? ((await usersResponse.json()).users ?? []) : [];
const ownerEmail = (invites[0]?.email ?? users.find((user) => memberIds.has(user.id))?.email)?.toLowerCase();
hide(ownerEmail);
const owner = users.find((user) => user.email?.toLowerCase() === ownerEmail);
console.log("2. Business:", SLUG, "| pending invites:", invites.length, "| members:", members.length);
console.log(
  "3. Users:", usersResponse.status, "| total:", users.length,
  "| owner user exists:", Boolean(owner),
  "| confirmed:", Boolean(owner?.email_confirmed_at),
  "| is member:", Boolean(owner && memberIds.has(owner.id)),
  "| signed in before:", Boolean(owner?.last_sign_in_at),
);
if (!ownerEmail) process.exit(1);

if (!owner && invites.length > 0) {
  // What the login page does for an invited owner without a user; a trigger links the invite.
  const create = await fetch(`${base}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...asAdmin, "Content-Type": "application/json" },
    body: JSON.stringify({ email: ownerEmail, email_confirm: true }),
  });
  const failure = create.ok ? "" : mask(await create.text());
  const membersNow = await rest(`business_members?select=user_id&business_id=eq.${business.id}`);
  console.log("3b. Create owner user:", create.status, failure, "| members now:", membersNow.length);
}

const configResponse = await management("/config/auth");
const config = configResponse.ok ? await configResponse.json() : {};
hide(config.smtp_pass);
console.log(
  "4. Auth config:", configResponse.status,
  "| email logins:", config.external_email_enabled,
  "| smtp:", config.smtp_host, config.smtp_port, config.smtp_user,
  "| sender:", mask(config.smtp_admin_email), "| password set:", Boolean(config.smtp_pass),
  "| emails per hour:", config.rate_limit_email_sent, "| seconds between emails:", config.smtp_max_frequency,
);

// A real sign-in like the email's "Entrar" button, without sending an email: proves the
// site logs the owner in and the panel finds the business. Done before step 6 because a
// new link replaces the owner's pending code, so the email sent last is the one that works.
const site = config.site_url;
const link = await fetch(`${base}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { ...asAdmin, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "magiclink", email: ownerEmail }),
});
const tokenHash = (await link.json().catch(() => ({}))).hashed_token;
hide(tokenHash);
const confirm = await fetch(`${site}/auth/confirm?token_hash=${tokenHash}&type=magiclink`, { redirect: "manual" });
const cookies = confirm.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
const panel = await fetch(`${site}/panel`, { headers: { cookie: cookies.join("; ") }, redirect: "manual" });
const panelHtml = panel.status === 200 ? await panel.text() : "";
// Close that session again (scope "local": only this one).
const sessionCookie = cookies.filter((cookie) => new RegExp(`^sb-${ref}-auth-token(\\.\\d+)?=`).test(cookie)).sort();
let session = null;
try {
  const encoded = sessionCookie.map((cookie) => cookie.slice(cookie.indexOf("=") + 1)).join("");
  session = JSON.parse(Buffer.from(encoded.replace(/^base64-/, ""), "base64url"));
} catch {
  // No session cookie, or a format this check doesn't know.
}
const logout = session
  ? (await fetch(`${base}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: { apikey: publishable, Authorization: `Bearer ${session.access_token}` },
    })).status
  : "no session";
console.log(
  "5. Sign in like the email button:", link.status,
  "| goes to:", new URL(confirm.headers.get("location") ?? "/", site).pathname,
  "| session:", Boolean(session), "| panel:", panel.status,
  "| shows the business:", panelHtml.includes("Ver mi página como cliente"), "| signed out:", logout,
);

// Supabase sends one email per minute per user, and the link above counts as one.
await new Promise((resolve) => setTimeout(resolve, 61_000));

// Same call the login page makes. If it works, the owner gets a real login email.
const otp = await fetch(`${base}/auth/v1/otp`, {
  method: "POST",
  headers: { apikey: publishable, "Content-Type": "application/json" },
  body: JSON.stringify({ email: ownerEmail, create_user: false }),
});
console.log("6. Send login code:", otp.status, mask(await otp.text()));

if (!RESEND_API_KEY) {
  console.log("7. RESEND_API_KEY is not set");
} else if (!otp.ok && otp.status !== 429) {
  // Supabase couldn't send it: try Resend directly to see Resend's own error.
  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "onboarding@resend.dev",
      to: ownerEmail,
      subject: "Prueba de correo del panel",
      text: "Si te llegó este correo, Resend sí puede enviarte mensajes.",
    }),
  });
  const body = await send.text();
  console.log("7. Resend direct send:", send.status, mask(body));
  if (body.includes("own email address")) {
    console.log("   Resend account email is the owner's:", body.toLowerCase().includes(ownerEmail));
  }
}
