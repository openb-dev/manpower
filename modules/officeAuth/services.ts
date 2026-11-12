import bcrypt from "bcryptjs";
import { prisma } from "../../lib/db/index.ts";
import { normalizeOtpIdentifier } from "../../lib/otp/index.ts";
import { requestApplicantOtp, verifyApplicantOtp } from "../otp/services.ts";

async function officeUserForReset(email: string) {
  const cleanEmail = normalizeOtpIdentifier(email, "EMAIL");
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }

  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
    include: { company: { select: { id: true, slug: true } } },
  });
  if (!user || !user.active) {
    throw new Error("This email is not an office login. Type the exact office email, then click Send code.");
  }

  let companySlug = user.company?.slug || "";
  let companyId = user.company?.id || "";
  if (!companySlug) {
    const fallback = await prisma.company.findFirst({
      where: { slug: "nk" },
      select: { id: true, slug: true },
    });
    companySlug = fallback?.slug || "";
    companyId = fallback?.id || "";
  }
  if (!companySlug || !companyId) throw new Error("Company not found.");

  return { user, cleanEmail, companySlug, companyId };
}

export async function requestOfficePasswordReset({
  email,
  ipAddress,
}: {
  email: string;
  ipAddress?: string;
}) {
  const { cleanEmail, companySlug } = await officeUserForReset(email);
  return requestApplicantOtp({
    companySlug,
    identifier: cleanEmail,
    channel: "EMAIL",
    ipAddress,
    purpose: "RESET",
  });
}

export async function verifyOfficeResetOtp({
  email,
  code,
}: {
  email: string;
  code: string;
}) {
  const { cleanEmail, companySlug } = await officeUserForReset(email);
  if (!code || String(code).replace(/\D/g, "").length !== 6) {
    throw new Error("Please enter the 6-digit code sent to your email.");
  }
  return verifyApplicantOtp({
    companySlug,
    identifier: cleanEmail,
    code: String(code).trim(),
  });
}

export async function resetOfficePassword({
  email,
  otpCode,
  password,
}: {
  email: string;
  otpCode: string;
  password: string;
}) {
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  if (!otpCode || String(otpCode).replace(/\D/g, "").length !== 6) {
    throw new Error("Please enter the 6-digit code sent to your email.");
  }

  const { user, cleanEmail, companyId, companySlug } = await officeUserForReset(email);
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
  const alreadyVerified = await prisma.applicantOtp.findFirst({
    where: {
      companyId,
      identifier: cleanEmail,
      verifiedAt: { gte: tenMinsAgo },
    },
    orderBy: { verifiedAt: "desc" },
    select: { id: true },
  });
  if (!alreadyVerified) {
    await verifyApplicantOtp({
      companySlug,
      identifier: cleanEmail,
      code: String(otpCode).trim(),
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return { email: user.email };
}
