import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requestApplicantOtp, verifyApplicantOtp } from "@/modules/otp/services";
import { submitApplicant } from "@/modules/applicants/services";
import { registerCandidate, loginCandidate, getCandidateApplications } from "@/modules/candidates/services";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companySlug: string }> }
) {
  try {
    const { companySlug } = await params;
    const company = await prisma.company.findUnique({
      where: { slug: companySlug },
      select: {
        id: true,
        slug: true,
        legalName: true,
        shortName: true,
        jobRoles: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            code: true,
            categories: {
              where: { active: true },
              select: {
                id: true,
                name: true,
                code: true,
                formDefinitions: {
                  where: { active: true },
                  orderBy: { version: "desc" },
                  take: 1,
                  select: { schema: true, version: true },
                },
              },
            },
          },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companySlug: string }> }
) {
  try {
    const { companySlug } = await params;
    const body = await request.json();

    if (body.action === "REQUEST_OTP") {
      const res = await requestApplicantOtp({
        companySlug,
        identifier: body.identifier,
        channel: body.channel,
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
      // In production, strip trialCode so real OTP delivered to WhatsApp/Email is strictly required.
      // In development mode (where SMS gateways aren't configured), pass trialCode for seamless local testing.
      const isProduction = process.env.NODE_ENV === "production";
      const clientSafe = isProduction ? { ...res, trialCode: undefined } : res;
      return NextResponse.json({
        success: true,
        delivered: clientSafe.delivered,
        provider: clientSafe.provider,
        channel: clientSafe.channel,
        expiresAt: clientSafe.expiresAt,
        trialCode: clientSafe.trialCode,
      });
    }

    if (body.action === "VERIFY_OTP") {
      const res = await verifyApplicantOtp({
        companySlug,
        identifier: body.identifier,
        code: body.code,
      });
      return NextResponse.json(res);
    }

    if (body.action === "REGISTER_CANDIDATE") {
      const candidate = await registerCandidate({
        companySlug,
        fullName: body.fullName,
        email: body.email,
        whatsappNo: body.whatsappNo,
        password: body.password,
        otpChannel: body.otpChannel || "WHATSAPP",
        otpCode: body.otpCode,
      });
      return NextResponse.json({ success: true, candidate });
    }

    if (body.action === "LOGIN_CANDIDATE") {
      const candidate = await loginCandidate({
        companySlug,
        email: body.email,
        password: body.password,
      });
      return NextResponse.json({ success: true, candidate });
    }

    if (body.action === "GET_CANDIDATE_APPLICATIONS") {
      const applications = await getCandidateApplications({
        companySlug,
        candidateId: body.candidateId,
      });
      return NextResponse.json({ applications });
    }

    if (body.action === "SUBMIT_APPLICATION") {
      const res = await submitApplicant({
        ...body.data,
        companySlug,
      });
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
