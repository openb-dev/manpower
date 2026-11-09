export function friendlyPublicError(raw: unknown) {
  const message = raw instanceof Error ? raw.message : String(raw || "");
  const text = message.replace(/\s+/g, " ").trim();
  if (!text) return "Something went wrong. Please try again.";

  if (
    /unexpected token|not valid json|json\.parse|syntaxerror|<!doctype|<html|failed to parse/i.test(
      text,
    )
  ) {
    return "The form could not be saved. Please use a smaller photo and documents (under 2 MB each) and try again.";
  }
  if (/payload too large|entity too large|\b413\b/i.test(text)) {
    return "The photo or documents are too large. Please upload files under 2 MB each and try again.";
  }
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(text)) {
    return "Could not connect. Please check your internet and try again.";
  }
  if (/prisma|econnrefused|etimedout|internal server|\b500\b/i.test(text)) {
    return "The server could not save the form right now. Please try again in a minute.";
  }
  if (/smtp|nodemailer|eauth|resend_api|sendgrid|fast2sms|msg91|twilio/i.test(text)) {
    return "The verification code could not be sent. Please try again.";
  }
  if (/unique constraint|p2002/i.test(text)) {
    return "This record is already saved. Please check and try again.";
  }
  if (
    /invalid option|invalid enum|invalid uuid|invalid_type|too_small|too small|required/i.test(text) &&
    (/zod|expected|received|code/i.test(text) || text.length > 80)
  ) {
    return "Please check the form and fill every required field marked with *.";
  }
  if (/^\[\{/.test(text) || /"code"\s*:\s*"/.test(text) || /"path"\s*:\s*\[/.test(text)) {
    return "Please check the form and fill every required field marked with *.";
  }
  if (text.length > 180 || /\bat\s+\w+\s+\(/.test(text)) {
    return "Something went wrong. Please try again.";
  }
  return text;
}

export function firstZodMessage(error: { issues?: { message?: string }[] } | null | undefined) {
  const message = error?.issues?.[0]?.message?.trim();
  return message || "Please check the form and fill every required field marked with *.";
}

export function publicCatchMessage(error: any) {
  if (error?.name === "ZodError" || Array.isArray(error?.issues)) {
    return firstZodMessage(error);
  }
  return friendlyPublicError(error?.message || error);
}

export async function readApiJson(res: Response) {
  const raw = await res.text();
  if (!raw) {
    if (!res.ok) throw new Error(friendlyPublicError(`Request failed ${res.status}`));
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(friendlyPublicError(raw.slice(0, 120)));
  }
}
