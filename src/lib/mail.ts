/**
 * Outbound email, one function and two backends.
 *
 * With `RESEND_API_KEY` set, mail goes out over Resend's REST API (plain
 * `fetch`, no SDK dependency). Without it, the message is logged to the server
 * console instead, so local development and self-hosting work with zero
 * configuration: the verification and reset links are right there in the
 * terminal. A missing key is a deliberate mode, not an error.
 */
import { APP_NAME } from "./brand";

export type Mail = {
  to: string;
  subject: string;
  text: string;
};

/** Where links in outbound mail point. */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function fromAddress(): string {
  return process.env.MAIL_FROM ?? `${APP_NAME} <onboarding@resend.dev>`;
}

export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    console.info(
      `\n--- email (no RESEND_API_KEY, not sent) ---\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n--- end email ---\n`,
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
    }),
  });

  if (!res.ok) {
    // Surfaced to the caller, which decides whether the user sees it. Password
    // reset in particular must not reveal that a send failed for one address
    // and not another.
    throw new Error(`Email send failed (${res.status})`);
  }
}

export function verificationEmail(username: string, link: string): Omit<Mail, "to"> {
  return {
    subject: `Confirm your ${APP_NAME} email`,
    text: `Hi ${username},

Confirm this address to finish setting up your ${APP_NAME} account:

${link}

The link is good for 24 hours. If you didn't create an account, ignore this
message and nothing will happen.`,
  };
}

export function resetEmail(username: string, link: string): Omit<Mail, "to"> {
  return {
    subject: `Reset your ${APP_NAME} password`,
    text: `Hi ${username},

Someone asked to reset the password on your ${APP_NAME} account. Use this link
to choose a new one:

${link}

The link is good for one hour and can only be used once. If this wasn't you,
ignore this message: your password stays as it is.`,
  };
}
