import { issueEmailToken } from "./auth";
import { appUrl, resetEmail, sendMail, verificationEmail } from "./mail";

type Recipient = { id: string; username: string; email: string };

/**
 * Issues a fresh verification link and mails it. Send failures are swallowed
 * on purpose: signup should not fail because an SMTP provider hiccuped, and
 * the user can ask for a new link from the banner at any time.
 */
export async function sendVerification(user: Recipient): Promise<void> {
  try {
    const token = await issueEmailToken(user.id, "verify");
    const link = `${appUrl()}/verify/${token}`;
    await sendMail({ to: user.email, ...verificationEmail(user.username, link) });
  } catch (err) {
    console.error("Verification email failed", err);
  }
}

/** Same contract as above, for the forgot-password flow. */
export async function sendPasswordReset(user: Recipient): Promise<void> {
  try {
    const token = await issueEmailToken(user.id, "reset");
    const link = `${appUrl()}/reset/${token}`;
    await sendMail({ to: user.email, ...resetEmail(user.username, link) });
  } catch (err) {
    console.error("Password reset email failed", err);
  }
}
