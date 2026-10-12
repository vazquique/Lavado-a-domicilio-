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

export async function requestCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { step: "email", email: "", message: "Escribe un correo válido.", isError: true };
  }
  const email = parsed.data;

  // Invited owners don't have a user yet: create it (already confirmed, since logging in
  // still requires the code sent to this email). A database trigger links the invitation.
  const admin = createAdminClient();
  if (admin) {
    const { data: invite } = await admin
      .from("business_invites")
      .select("email")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (invite) {
      await admin.auth.admin.createUser({ email, email_confirm: true });
    }
  } else {
    console.error("SUPABASE_SECRET_KEY is not set; invited users cannot be created.");
  }

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
