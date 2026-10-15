import "server-only";
import nodemailer from "nodemailer";
import { PRODUCT_NAME } from "@/config/product";
import type { Email } from "./booking-email";

const RESEND_API_URL = "https://api.resend.com/emails";

// The business's Gmail and its app password (the owner chose Gmail: free, and it can write
// to anyone). Google shows the password in groups of four; the spaces don't count.
export function getGmailConfig(): { user: string; password: string } | null {
  const user = process.env.GMAIL_USER?.trim();
  const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  return user && password ? { user, password } : null;
}

export function gmailTransport({ user, password }: { user: string; password: string }) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

// Sends an email from the business's Gmail or, without it, through Resend (whose test
// sender only reaches the Resend account's own email; the local emulator fakes it). Never
// throws: a failed email must not undo a booking.
export async function sendEmail(to: string[], email: Email): Promise<boolean> {
  if (to.length === 0) return false;
  const gmail = getGmailConfig();
  if (gmail) {
    try {
      await gmailTransport(gmail).sendMail({ from: { name: PRODUCT_NAME, address: gmail.user }, to, ...email });
      return true;
    } catch (error) {
      console.error("Gmail could not send the email:", error instanceof Error ? error.message : error);
      return false;
    }
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("No email settings (GMAIL_USER or RESEND_API_KEY); email not sent:", email.subject);
    return false;
  }
  try {
    const response = await fetch(process.env.RESEND_API_URL?.trim() || RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${PRODUCT_NAME} <onboarding@resend.dev>`, to, ...email }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Resend answered", response.status, (await response.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (error) {
    console.error("Could not reach Resend:", error);
    return false;
  }
}
