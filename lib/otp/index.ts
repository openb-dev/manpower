import { createHash, randomInt } from "node:crypto";

export interface OtpSendResult {
  success: boolean;
  delivered: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

export interface OtpProvider {
  sendOtp(
    identifier: string,
    code: string,
    companyName: string,
    channel?: "EMAIL" | "WHATSAPP"
  ): Promise<OtpSendResult>;
}

export interface DispatchResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

// --------------------------------------------------------------------------
// Real Email Dispatchers: SMTP (Nodemailer), Resend API, SendGrid API
// --------------------------------------------------------------------------

async function sendSmtpEmail(
  to: string,
  code: string,
  companyName: string
): Promise<DispatchResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return { success: false, error: "SMTP credentials not configured" };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const from =
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    `"${companyName} Recruitment" <${user}>`;

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject: `${code} is your ${companyName} verification code`,
      text: `Your ${companyName} verification code is: ${code}. Valid for 5 minutes. Do not share this OTP with anyone.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
          <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 24px;">
            <div style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: 900; font-size: 14px; padding: 6px 12px; border-radius: 8px;">NK</div>
            <h2 style="margin: 12px 0 4px; font-size: 20px; font-weight: 700; color: #0f172a;">${companyName} Verification Code</h2>
            <p style="margin: 0; font-size: 13px; color: #64748b;">Candidate Recruitment & Onboarding Portal</p>
          </div>
          <p style="font-size: 14px; color: #334155; line-height: 1.5; margin-bottom: 20px;">
            Please enter the following 6-digit verification code to authenticate your candidate account:
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <div style="display: inline-block; font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; background: #eff6ff; border: 1px solid #bfdbfe; padding: 14px 28px; border-radius: 12px;">
              ${code}
            </div>
          </div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
            ⏱ This code is valid for <strong>5 minutes</strong>. If you did not request this verification code, please ignore this email or contact support.
          </p>
          <div style="border-top: 1px solid #f1f5f9; margin-top: 28px; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
            &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.
          </div>
        </div>
      `,
    });

    return { success: true, messageId: info.messageId, provider: "SMTP" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "SMTP" };
  }
}

async function sendResendEmail(
  to: string,
  code: string,
  companyName: string
): Promise<DispatchResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const from =
    process.env.EMAIL_FROM || `"${companyName}" <onboarding@resend.dev>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `${code} is your ${companyName} verification code`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
            <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">${companyName} Verification Code</h2>
            <p style="font-size: 14px; color: #334155; line-height: 1.5;">Your 6-digit authentication code is:</p>
            <div style="text-align: center; margin: 24px 0;">
              <div style="display: inline-block; font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; background: #eff6ff; border: 1px solid #bfdbfe; padding: 14px 28px; border-radius: 12px;">
                ${code}
              </div>
            </div>
            <p style="font-size: 12px; color: #64748b;">Valid for 5 minutes. Do not share this code.</p>
          </div>
        `,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.message || "Resend API error", provider: "Resend" };
    }
    return { success: true, messageId: data.id, provider: "Resend" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "Resend" };
  }
}

async function sendSendGridEmail(
  to: string,
  code: string,
  companyName: string
): Promise<DispatchResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return { success: false, error: "SENDGRID_API_KEY not configured" };
  }

  const fromEmail = process.env.EMAIL_FROM || "no-reply@nkenterprise.com";

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: companyName },
        subject: `${code} is your ${companyName} verification code`,
        content: [
          {
            type: "text/plain",
            value: `Your ${companyName} verification code is: ${code}. Valid for 5 minutes.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: errText, provider: "SendGrid" };
    }
    return { success: true, messageId: `sg-${Date.now()}`, provider: "SendGrid" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "SendGrid" };
  }
}

// --------------------------------------------------------------------------
// Real WhatsApp Dispatchers: Meta Cloud API, Twilio WhatsApp, Fast2SMS, Webhook
// --------------------------------------------------------------------------

function formatIndianPhone(phone: string): { e164: string; national10: string } {
  const digits = phone.replace(/\D/g, "");
  const national10 =
    digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.slice(-10);
  const e164 = `91${national10}`;
  return { e164, national10 };
}

export function normalizeOtpIdentifier(identifier: string, channel?: "EMAIL" | "WHATSAPP") {
  const raw = String(identifier || "").trim();
  if (channel === "EMAIL" || raw.includes("@")) return raw.toLowerCase();
  return formatIndianPhone(raw).national10;
}

export function isEmailDeliveryConfigured() {
  return Boolean(
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ||
      process.env.RESEND_API_KEY ||
      process.env.SENDGRID_API_KEY
  );
}

export function isMobileDeliveryConfigured() {
  return Boolean(
    (process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) ||
      (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) ||
      process.env.WHATSAPP_WEBHOOK_URL ||
      process.env.MSG91_AUTH_KEY ||
      process.env.TWO_FACTOR_API_KEY ||
      process.env.FAST2SMS_API_KEY
  );
}

async function sendMetaWhatsApp(
  recipient: string,
  code: string,
  companyName: string
): Promise<DispatchResult> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { success: false, error: "Meta WhatsApp Cloud API credentials not configured" };
  }

  const { e164 } = formatIndianPhone(recipient);
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;

  try {
    let payload: any;
    if (templateName) {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: e164,
        type: "template",
        template: {
          name: templateName,
          language: { code: process.env.WHATSAPP_LANGUAGE_CODE || "en" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: code }],
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: code }],
            },
          ],
        },
      };
    } else {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: e164,
        type: "text",
        text: {
          preview_url: false,
          body: `*${companyName}* Verification Code:\n\n*${code}*\n\nThis 6-digit code is valid for 5 minutes. Do not share this code with anyone.`,
        },
      };
    }

    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data.error?.message || "WhatsApp Cloud API error";
      return { success: false, error: errMsg, provider: "Meta WhatsApp" };
    }

    const messageId = data.messages?.[0]?.id || `meta-${Date.now()}`;
    return { success: true, messageId, provider: "Meta WhatsApp" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "Meta WhatsApp" };
  }
}

async function sendTwilioWhatsApp(
  recipient: string,
  code: string,
  companyName: string
): Promise<DispatchResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  const { e164 } = formatIndianPhone(recipient);
  const from = fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`;
  const to = `whatsapp:+${e164}`;

  try {
    const bodyParams = new URLSearchParams();
    bodyParams.append("From", from);
    bodyParams.append("To", to);
    bodyParams.append(
      "Body",
      `*${companyName}* Candidate Verification Code: *${code}*. Valid for 5 minutes. Do not share this code.`
    );

    const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: bodyParams.toString(),
      }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.message || "Twilio API error", provider: "Twilio" };
    }
    return { success: true, messageId: data.sid, provider: "Twilio WhatsApp" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "Twilio WhatsApp" };
  }
}

async function sendFast2Sms(
  recipient: string,
  code: string,
  companyName: string
): Promise<DispatchResult> {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    return { success: false, error: "FAST2SMS_API_KEY not configured" };
  }

  const { national10 } = formatIndianPhone(recipient);

  try {
    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(
      apiKey
    )}&variables_values=${encodeURIComponent(code)}&route=otp&numbers=${national10}`;

    const res = await fetch(url, { method: "GET" });
    const data = await res.json().catch(() => ({}));

    if (!data.return) {
      return { success: false, error: data.message?.[0] || "Fast2SMS error", provider: "Fast2SMS" };
    }
    return {
      success: true,
      messageId: data.request_id || `fast2sms-${Date.now()}`,
      provider: "Fast2SMS",
    };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "Fast2SMS" };
  }
}

async function sendMsg91Otp(recipient: string, code: string): Promise<DispatchResult> {
  const authKey = process.env.MSG91_AUTH_KEY;
  if (!authKey) {
    return { success: false, error: "MSG91_AUTH_KEY not configured" };
  }

  const { e164 } = formatIndianPhone(recipient);
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const sender = process.env.MSG91_SENDER_ID || "NKENTP";

  try {
    const payload: Record<string, unknown> = {
      mobile: e164,
      otp: code,
      otp_expiry: 5,
      sender,
    };
    if (templateId) payload.template_id = templateId;

    const res = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || String(data.type || "").toLowerCase() === "error") {
      return {
        success: false,
        error: data.message || data.msg || "MSG91 OTP API error",
        provider: "MSG91",
      };
    }
    return {
      success: true,
      messageId: String(data.request_id || data.message || `msg91-${Date.now()}`),
      provider: "MSG91",
    };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "MSG91" };
  }
}

async function sendTwoFactorOtp(
  recipient: string,
  code: string,
  channel: "SMS" | "WHATSAPP" = "WHATSAPP"
): Promise<DispatchResult> {
  const apiKey = process.env.TWO_FACTOR_API_KEY;
  if (!apiKey) {
    return { success: false, error: "TWO_FACTOR_API_KEY not configured" };
  }

  const { e164, national10 } = formatIndianPhone(recipient);
  const template = process.env.TWO_FACTOR_TEMPLATE || "OTP1";
  const path =
    channel === "WHATSAPP"
      ? `https://2factor.in/API/V1/${encodeURIComponent(apiKey)}/WHATSAPP/+${e164}/${encodeURIComponent(code)}`
      : `https://2factor.in/API/V1/${encodeURIComponent(apiKey)}/SMS/${national10}/${encodeURIComponent(code)}/${encodeURIComponent(template)}`;

  try {
    const res = await fetch(path, { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (String(data.Status || "").toUpperCase() !== "SUCCESS") {
      return {
        success: false,
        error: data.Details || "2Factor OTP API error",
        provider: "2Factor",
      };
    }
    return {
      success: true,
      messageId: String(data.Details || `2factor-${Date.now()}`),
      provider: "2Factor",
    };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "2Factor" };
  }
}

async function sendCustomWebhookWhatsApp(
  recipient: string,
  code: string,
  companyName: string
): Promise<DispatchResult> {
  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
  if (!webhookUrl) {
    return { success: false, error: "WHATSAPP_WEBHOOK_URL not configured" };
  }

  const { e164 } = formatIndianPhone(recipient);
  const secretKey = process.env.WHATSAPP_WEBHOOK_KEY || "";

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secretKey ? { Authorization: `Bearer ${secretKey}`, "x-api-key": secretKey } : {}),
      },
      body: JSON.stringify({
        to: e164,
        code,
        companyName,
        message: `*${companyName}* Verification Code: *${code}*. Valid for 5 minutes.`,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error || "Custom WhatsApp gateway error", provider: "Custom Webhook" };
    }
    return { success: true, messageId: data.id || `webhook-${Date.now()}`, provider: "Custom Webhook" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "Custom Webhook" };
  }
}

// --------------------------------------------------------------------------
// Real Integrated OTP Provider (Auto-detects active WhatsApp & Email channels)
// --------------------------------------------------------------------------

function ok(result: DispatchResult): OtpSendResult {
  return {
    success: true,
    delivered: true,
    messageId: result.messageId,
    provider: result.provider,
  };
}

export class RealIntegratedOtpProvider implements OtpProvider {
  async sendOtp(
    identifier: string,
    code: string,
    companyName: string,
    channel: "EMAIL" | "WHATSAPP" = "WHATSAPP"
  ): Promise<OtpSendResult> {
    const isEmail = channel === "EMAIL" || identifier.includes("@");
    const failures: string[] = [];

    if (isEmail) {
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const result = await sendSmtpEmail(identifier, code, companyName);
        if (result.success) {
          console.log(`[EMAIL DISPATCH] Sent OTP to ${identifier} via SMTP (${result.messageId})`);
          return ok(result);
        }
        failures.push(`SMTP: ${result.error}`);
      }

      if (process.env.RESEND_API_KEY) {
        const result = await sendResendEmail(identifier, code, companyName);
        if (result.success) {
          console.log(`[EMAIL DISPATCH] Sent OTP to ${identifier} via Resend (${result.messageId})`);
          return ok(result);
        }
        failures.push(`Resend: ${result.error}`);
      }

      if (process.env.SENDGRID_API_KEY) {
        const result = await sendSendGridEmail(identifier, code, companyName);
        if (result.success) {
          console.log(`[EMAIL DISPATCH] Sent OTP to ${identifier} via SendGrid (${result.messageId})`);
          return ok(result);
        }
        failures.push(`SendGrid: ${result.error}`);
      }

      if (failures.length) {
        return {
          success: false,
          delivered: false,
          error: `Email OTP APIs failed. ${failures.join(" | ")}`,
        };
      }

      console.log(
        `[OTP EMAIL NOTICE] No email API configured. Local code for ${identifier}: ${code}`
      );
      return { success: true, delivered: false, messageId: `local-email-${Date.now()}`, provider: "LOCAL" };
    }

    if (process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      const result = await sendMetaWhatsApp(identifier, code, companyName);
      if (result.success) {
        console.log(`[WHATSAPP DISPATCH] Sent OTP to +91 ${identifier} via Meta (${result.messageId})`);
        return ok(result);
      }
      failures.push(`Meta WhatsApp: ${result.error}`);
    }

    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) {
      const result = await sendTwilioWhatsApp(identifier, code, companyName);
      if (result.success) {
        console.log(`[WHATSAPP DISPATCH] Sent OTP to +91 ${identifier} via Twilio (${result.messageId})`);
        return ok(result);
      }
      failures.push(`Twilio: ${result.error}`);
    }

    if (process.env.WHATSAPP_WEBHOOK_URL) {
      const result = await sendCustomWebhookWhatsApp(identifier, code, companyName);
      if (result.success) {
        console.log(`[WHATSAPP DISPATCH] Sent OTP to +91 ${identifier} via webhook (${result.messageId})`);
        return ok(result);
      }
      failures.push(`Webhook: ${result.error}`);
    }

    if (process.env.TWO_FACTOR_API_KEY) {
      const result = await sendTwoFactorOtp(identifier, code, "WHATSAPP");
      if (result.success) {
        console.log(`[OTP DISPATCH] Sent OTP to +91 ${identifier} via 2Factor (${result.messageId})`);
        return ok(result);
      }
      const sms = await sendTwoFactorOtp(identifier, code, "SMS");
      if (sms.success) {
        console.log(`[SMS DISPATCH] Sent OTP to +91 ${identifier} via 2Factor SMS (${sms.messageId})`);
        return ok(sms);
      }
      failures.push(`2Factor: ${result.error || sms.error}`);
    }

    if (process.env.MSG91_AUTH_KEY) {
      const result = await sendMsg91Otp(identifier, code);
      if (result.success) {
        console.log(`[SMS DISPATCH] Sent OTP to +91 ${identifier} via MSG91 (${result.messageId})`);
        return ok(result);
      }
      failures.push(`MSG91: ${result.error}`);
    }

    if (process.env.FAST2SMS_API_KEY) {
      const result = await sendFast2Sms(identifier, code, companyName);
      if (result.success) {
        console.log(`[SMS DISPATCH] Sent OTP to +91 ${identifier} via Fast2SMS (${result.messageId})`);
        return ok(result);
      }
      failures.push(`Fast2SMS: ${result.error}`);
    }

    if (failures.length) {
      return {
        success: false,
        delivered: false,
        error: `OTP APIs failed. ${failures.join(" | ")}`,
      };
    }

    console.log(
      `[OTP MOBILE NOTICE] No WhatsApp/SMS API configured. Local code for +91 ${identifier}: ${code}`
    );
    return { success: true, delivered: false, messageId: `local-wa-${Date.now()}`, provider: "LOCAL" };
  }
}

export class ConsoleOtpProvider implements OtpProvider {
  async sendOtp(
    identifier: string,
    code: string,
    companyName: string,
    channel: "EMAIL" | "WHATSAPP" = "WHATSAPP"
  ): Promise<OtpSendResult> {
    console.log(
      `[OTP DISPATCH] To: ${identifier} | Company: ${companyName} | Code: ${code} (Expires in 5m) [Via ${channel}]`
    );
    return { success: true, delivered: false, messageId: `mock-${Date.now()}`, provider: "LOCAL" };
  }
}

export class ProviderRegistry {
  private static defaultProvider: OtpProvider = new RealIntegratedOtpProvider();

  static setProvider(provider: OtpProvider) {
    this.defaultProvider = provider;
  }

  static getProvider(): OtpProvider {
    return this.defaultProvider;
  }
}

export function generate6DigitOtp(): string {
  return randomInt(100000, 999999).toString();
}

export function hashOtp(otp: string): string {
  return createHash("sha256").update(otp.trim()).digest("hex");
}

export function isOtpExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

export function getExpiry5Minutes(): Date {
  return new Date(Date.now() + 5 * 60 * 1000);
}
