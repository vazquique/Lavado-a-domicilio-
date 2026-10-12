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

// Same call the login page makes. If it works, the owner gets a real login email.
const otp = await fetch(`${base}/auth/v1/otp`, {
  method: "POST",
  headers: { apikey: publishable, "Content-Type": "application/json" },
  body: JSON.stringify({ email: ownerEmail, create_user: false }),
});
console.log("5. Send login code:", otp.status, mask(await otp.text()));

if (!RESEND_API_KEY) {
  console.log("6. RESEND_API_KEY is not set");
} else if (otp.ok) {
  // Supabase handed the email to Resend: see what Resend did with it.
  const list = await fetch("https://api.resend.com/emails?limit=5", {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  const body = await list.json().catch(() => ({}));
  console.log("6. Resend recent emails:", list.status, list.ok ? "" : mask(JSON.stringify(body)));
  for (const email of body.data ?? []) {
    const toOwner = [email.to].flat().some((to) => String(to).toLowerCase() === ownerEmail);
    console.log("  ", email.created_at, "| to owner:", toOwner, "| status:", email.last_event);
  }
} else {
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
  console.log("6. Resend direct send:", send.status, mask(body));
  if (body.includes("own email address")) {
    console.log("   Resend account email is the owner's:", body.toLowerCase().includes(ownerEmail));
  }
}
