import { prisma } from "../../lib/db/index.ts";
import {
  generate6DigitOtp,
  getExpiry5Minutes,
  hashOtp,
  isOtpExpired,
  normalizeOtpIdentifier,
  ProviderRegistry,
} from "../../lib/otp/index.ts";

export interface RequestOtpParams {
  companySlug: string;
  identifier: string; // Mobile or Email
  channel?: "EMAIL" | "WHATSAPP";
  ipAddress?: string;
}

export async function requestApplicantOtp({ companySlug, identifier, channel, ipAddress }: RequestOtpParams) {
  const company = await prisma.company.findUnique({
    where: { slug: companySlug },
  });
  if (!company) throw new Error("Company not found.");

  const chosenChannel = channel || (identifier.includes("@") ? "EMAIL" : "WHATSAPP");
  const cleanId = normalizeOtpIdentifier(identifier, chosenChannel);
  if (!cleanId || (chosenChannel === "EMAIL" ? !cleanId.includes("@") : cleanId.length !== 10)) {
    throw new Error(
      chosenChannel === "EMAIL"
        ? "Please enter a valid email address."
        : "Please enter a valid 10-digit mobile number."
    );
  }

  // Rate-limiting: max 3 requests in the last 10 minutes from same identifier or IP
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentAttempts = await prisma.applicantOtp.count({
    where: {
      companyId: company.id,
      identifier: cleanId,
      createdAt: { gte: tenMinsAgo },
    },
  });

  if (recentAttempts >= 3) {
    throw new Error("Too many OTP requests. Please wait 10 minutes before trying again.");
  }

  const plainOtp = generate6DigitOtp();
  const hashedOtp = hashOtp(plainOtp);
  const expiresAt = getExpiry5Minutes();

  await prisma.applicantOtp.create({
    data: {
      companyId: company.id,
      identifier: cleanId,
      hashedOtp,
      expiresAt,
      ipAddress,
      maxAttempts: 3,
      attempts: 0,
    },
  });

  const provider = ProviderRegistry.getProvider();
  const dispatch = await provider.sendOtp(cleanId, plainOtp, company.shortName, chosenChannel);

  if (!dispatch.success) {
    throw new Error("The verification code could not be sent. Please try again.");
  }

  const isDevOrTest = process.env.NODE_ENV !== "production";

  return {
    success: true,
    expiresAt,
    channel: chosenChannel,
    delivered: Boolean(dispatch.delivered),
    provider: dispatch.provider || (dispatch.delivered ? "API" : "LOCAL"),
    trialCode: isDevOrTest && !dispatch.delivered ? plainOtp : undefined,
  };
}

export async function verifyApplicantOtp({
  companySlug,
  identifier,
  code,
}: {
  companySlug: string;
  identifier: string;
  code: string;
}) {
  const company = await prisma.company.findUnique({
    where: { slug: companySlug },
  });
  if (!company) throw new Error("Company not found.");

  const cleanId = normalizeOtpIdentifier(identifier);
  const latestOtp = await prisma.applicantOtp.findFirst({
    where: {
      companyId: company.id,
      identifier: cleanId,
      verifiedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latestOtp) {
    throw new Error("No active OTP requested for this identifier. Please request a new code.");
  }

  if (isOtpExpired(latestOtp.expiresAt)) {
    throw new Error("OTP has expired. Please request a new code.");
  }

  if (latestOtp.attempts >= latestOtp.maxAttempts) {
    throw new Error("Maximum attempts exceeded. Please request a fresh OTP.");
  }

  const hashedInput = hashOtp(code);
  if (hashedInput !== latestOtp.hashedOtp) {
    await prisma.applicantOtp.update({
      where: { id: latestOtp.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = latestOtp.maxAttempts - (latestOtp.attempts + 1);
    throw new Error(`Invalid OTP code. ${remaining} attempt(s) remaining.`);
  }

  await prisma.applicantOtp.update({
    where: { id: latestOtp.id },
    data: { verifiedAt: new Date() },
  });

  return { verified: true };
}
