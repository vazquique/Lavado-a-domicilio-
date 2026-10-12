import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = ["email", "magiclink"];

// Target of the "Entrar" button in the login email (token_hash link). Works even if
// the email is opened in a different browser than the one that asked for the code.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL("/panel", request.url));
  }

  return NextResponse.redirect(new URL("/panel/entrar?error=enlace", request.url));
}
