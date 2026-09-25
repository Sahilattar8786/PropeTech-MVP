import { logger } from "@/server/lib/logger";

/**
 * Email abstraction. No provider is wired up in the MVP: messages are logged so
 * flows like password reset work in development. Plug Resend/SES/Postmark in here.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  logger.info(`[email] to=${message.to} subject="${message.subject}"\n${message.text}`);
}
