import "server-only";
import { PRODUCT_NAME } from "@/config/product";
import type { Email } from "./booking-email";

const RESEND_API_URL = "https://api.resend.com/emails";

// Sends an email through Resend. Never throws: a failed email must not undo a booking.
// Until we have our own domain, Resend's test sender can only write to the email of the
// Resend account (the owner's).
export async function sendEmail(to: string[], email: Email): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set; email not sent:", email.subject);
    return false;
  }
  if (to.length === 0) return false;
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
