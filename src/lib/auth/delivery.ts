import nodemailer from "nodemailer";
import { DEFAULT_SYSTEM_NAME, getSystemName } from "@/lib/brand/system-name";

export type DeliveryResult = {
  delivered: boolean;
  reason: "sent" | "not_configured" | "provider_failed";
  providerMessageId?: string | null;
};

export type EmailDelivery = {
  sendEmailVerification: (input: { to: string; verifyUrl: string }) => Promise<DeliveryResult>;
};

export const EMAIL_CONFIGURATION_HINT =
  "Set SMTP_HOST to smtp.gmail.com, SMTP_PORT to 465, and set SMTP_USER, SMTP_PASS, and EMAIL_FROM. An invitation is reported as sent only after Gmail accepts it.";

const GMAIL_HOST = "smtp.gmail.com";
const GMAIL_PORT = 465;

type SmtpSettings = {
  host: typeof GMAIL_HOST;
  port: typeof GMAIL_PORT;
  user: string;
  pass: string;
  from: string;
};

export function readSmtpSettings(env: NodeJS.ProcessEnv = process.env): SmtpSettings | null {
  const host = env.SMTP_HOST?.trim();
  const port = Number(env.SMTP_PORT?.trim());
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (host !== GMAIL_HOST || port !== GMAIL_PORT || !user || !pass || !from) {
    return null;
  }
  return { host, port, user, pass, from };
}

export function emailProviderConfigured(): boolean {
  return readSmtpSettings() !== null;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function messageHtml(text: string): string {
  const linked = escapeHtml(text).replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}">${url}</a>`,
  );
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f7f4ef"><div style="max-width:560px;font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#12304a">${linked.replace(/\n/g, "<br>")}</div></body></html>`;
}

export async function sendCareCircleEmail(input: {
  to: string;
  subject: string;
  text: string;
  systemName?: string;
}): Promise<DeliveryResult> {
  const settings = readSmtpSettings();
  if (!settings) {
    return { delivered: false, reason: "not_configured" };
  }
  const systemName = input.systemName?.trim() || DEFAULT_SYSTEM_NAME;
  const text = `${input.text}\n\nThis message was sent to ${input.to} by ${systemName}.`;
  try {
    const transport = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: true,
      auth: { user: settings.user, pass: settings.pass },
    });
    await transport.sendMail({
      from: { name: systemName, address: settings.user },
      replyTo: settings.user,
      envelope: { from: settings.user, to: input.to },
      to: input.to,
      subject: input.subject,
      text,
      html: messageHtml(text),
    });
    return { delivered: true, reason: "sent" };
  } catch {
    console.error("smtp_send_failed");
    return { delivered: false, reason: "provider_failed" };
  }
}

export const unconfiguredEmailDelivery: EmailDelivery = {
  async sendEmailVerification() {
    return { delivered: false, reason: "not_configured" };
  },
};

export function createEmailDelivery(): EmailDelivery {
  return {
    async sendEmailVerification({ to, verifyUrl }) {
      const systemName = await getSystemName();
      return sendCareCircleEmail({
        to,
        systemName,
        subject: `Verify your ${systemName} email`,
        text: [
          `Confirm your email address for ${systemName}.`,
          "",
          verifyUrl,
          "",
          "This link can be used once. If you did not create this account, you can ignore this message.",
        ].join("\n"),
      });
    },
  };
}

export function verificationDeliveryMessage(input: { email: DeliveryResult; systemName?: string }): string {
  if (input.email.delivered) {
    return "Your account is waiting for verification. Use the message sent to your email.";
  }
  const systemName = input.systemName?.trim() || DEFAULT_SYSTEM_NAME;
  return `Your account was created and is waiting for verification. ${systemName} could not send an email because email delivery is not configured.`;
}
