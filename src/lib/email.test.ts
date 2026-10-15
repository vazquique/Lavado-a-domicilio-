import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PRODUCT_NAME } from "@/config/product";
import { getGmailConfig, sendEmail } from "./email";

// Gmail is never reached from the tests: nodemailer is replaced by a fake transport.
const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return { sendMail, createTransport: vi.fn((options: unknown) => (void options, { sendMail })) };
});
vi.mock("nodemailer", () => ({ default: { createTransport } }));

const email = { subject: "Nueva reserva JBS-1042", text: "Hola", html: "<p>Hola</p>" };

beforeEach(() => {
  sendMail.mockReset();
  createTransport.mockClear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendEmail", () => {
  test("with the business's Gmail, sends from it to anyone, through Gmail", async () => {
    vi.stubEnv("GMAIL_USER", " jbsbros.reservas@gmail.com ");
    vi.stubEnv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
    vi.stubEnv("RESEND_API_KEY", "re_123");
    sendMail.mockResolvedValue({ messageId: "1" });

    expect(await sendEmail(["omar@example.com"], email)).toBe(true);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: "jbsbros.reservas@gmail.com", pass: "abcdefghijklmnop" },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith({
      from: { name: PRODUCT_NAME, address: "jbsbros.reservas@gmail.com" },
      to: ["omar@example.com"],
      ...email,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("a Gmail error doesn't throw: the booking is already saved", async () => {
    vi.stubEnv("GMAIL_USER", "jbsbros.reservas@gmail.com");
    vi.stubEnv("GMAIL_APP_PASSWORD", "wrong");
    sendMail.mockRejectedValue(new Error("Invalid login: 535-5.7.8 Username and Password not accepted"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await sendEmail(["omar@example.com"], email)).toBe(false);
  });

  test("without Gmail, uses Resend", async () => {
    vi.stubEnv("GMAIL_USER", "");
    vi.stubEnv("GMAIL_APP_PASSWORD", "");
    vi.stubEnv("RESEND_API_KEY", "re_123");

    expect(await sendEmail(["dueno@example.com"], email)).toBe(true);
    expect(createTransport).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
  });

  test("nothing set up, or nobody to write to: nothing is sent", async () => {
    vi.stubEnv("GMAIL_USER", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await sendEmail(["dueno@example.com"], email)).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "re_123");
    expect(await sendEmail([], email)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

test("Gmail needs both the address and the app password", () => {
  vi.stubEnv("GMAIL_USER", "jbsbros.reservas@gmail.com");
  vi.stubEnv("GMAIL_APP_PASSWORD", "  ");
  expect(getGmailConfig()).toBeNull();
  vi.unstubAllEnvs();
});
