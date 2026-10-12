"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

export type LoginState = {
  step: "email" | "code";
  email: string;
  message: string;
  isError: boolean;
};

const emailSchema = z.email().trim().toLowerCase().max(254);
const codeSchema = z.string().trim().regex(/^[0-9]{6,10}$/);

// Invited owners don't have a user yet: create it (already confirmed, since logging in
// still requires the code sent to this email). A database trigger links the invitation.
// Returns false when it couldn't check, so a missing user isn't taken for "no access".
async function ensureInvitedUser(email: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) {
    console.error("SUPABASE_SECRET_KEY is not set; invited users cannot be created.");
    return false;
  }
  const { data: invite, error } = await admin
    .from("business_invites")
    .select("email")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Could not read invitations:", error.message);
    return false;
  }
  if (!invite) return true;

  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  // "email_exists": the user was already created on an earlier attempt.
  if (created.error && created.error.code !== "email_exists") {
    console.error("Could not create the invited user:", created.error.message);
    return false;
  }
  return true;
}

export async function requestCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { step: "email", email: "", message: "Escribe un correo válido.", isError: true };
  }
  const email = parsed.data;
  const checkedInvites = await ensureInvitedUser(email);

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error?.status === 429) {
    return {
      step: "email",
      email,
      message: "Ya pediste un código hace poco. Espera un minuto y vuelve a intentarlo.",
      isError: true,
    };
  }
  // "otp_disabled" means this email has no user, so no access (when the invitations could be
  // checked). Any other error means the email couldn't be sent: say so instead of "te llegó".
  if (error && !(error.code === "otp_disabled" && checkedInvites)) {
    console.error("Could not send the login code:", error.status, error.code, error.message);
    return {
      step: "email",
      email,
      message: "No pudimos enviar el correo. Intenta de nuevo en unos minutos.",
      isError: true,
    };
  }

  // Same answer whether or not the email has access, so the form doesn't reveal who does.
  return {
    step: "code",
    email,
    message: "Si tu correo tiene acceso, te llegó un código. Revisa también la carpeta de spam.",
    isError: false,
  };
}

export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const code = codeSchema.safeParse(formData.get("code"));
  if (!email.success) {
    return { step: "email", email: "", message: "Vuelve a escribir tu correo.", isError: true };
  }
  const retry = { step: "code" as const, email: email.data, isError: true };
  if (!code.success) {
    return { ...retry, message: "El código son solo números (6 dígitos)." };
  }

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.verifyOtp({ email: email.data, token: code.data, type: "email" });
  if (error) {
    return { ...retry, message: "El código no es correcto o ya venció. Usa el del último correo o pide otro." };
  }
  redirect("/panel");
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/panel/entrar");
}
