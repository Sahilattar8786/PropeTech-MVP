import { createHash, randomBytes } from "node:crypto";
import { getAppUrl, siteConfig } from "@/lib/config/site";
import { hashPassword } from "@/server/auth/password";
import { connectDB } from "@/server/db/connect";
import { AppError } from "@/server/lib/errors";
import { User } from "@/server/models";
import { sendEmail } from "@/server/services/notifications/email.service";

const TTL_MS = 60 * 60_000;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Always resolves the same way whether or not the account exists (no enumeration). */
export async function requestPasswordReset(email: string) {
  await connectDB();
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return;
  const token = randomBytes(32).toString("base64url");
  await User.updateOne({ _id: user._id }, { $set: { passwordResetTokenHash: hash(token), passwordResetExpiresAt: new Date(Date.now() + TTL_MS) } });
  await sendEmail({
    to: user.email,
    subject: `Reset your ${siteConfig.name} password`,
    text: `Hi ${user.name},\n\nReset your password using this link (valid for 1 hour):\n${getAppUrl()}/reset-password?token=${token}\n\nIf you didn't request this, you can ignore this email.`,
  });
}

export async function resetPassword(token: string, password: string) {
  await connectDB();
  const user = await User.findOne({ passwordResetTokenHash: hash(token), passwordResetExpiresAt: { $gt: new Date() } }).select("+passwordResetTokenHash");
  if (!user) throw new AppError("BAD_REQUEST", "This reset link is invalid or has expired");
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(password) }, $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } },
  );
  return { email: user.email };
}
