import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requestApplicantOtp, verifyApplicantOtp } from "@/modules/otp/services";
import { getApplicantForAdminEdit, submitApplicant, updateApplicant } from "@/modules/applicants/services";
import {
  registerCandidate,
  loginCandidate,
  requestCandidatePasswordReset,
  resetCandidatePassword,
  getCandidateApplications,
  getCandidatePrefill,
} from "@/modules/candidates/services";
import { publicCatchMessage } from "@/lib/publicErrors";
import { currentOfficeAdmin } from "@/lib/officeAdmin";
import { applyRolesForForm, ensureApplyRoles } from "@/lib/applyRoles";
import {
  clearCandidateCookie,
  currentCandidate,
  setCandidateCookie,
} from "@/lib/candidateSession";

async function fileToDataUrl(file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  const head = buf.subarray(0, Math.min(buf.length, 2048)).toString("latin1");
  const looksPdf =
    head.includes("%PDF") ||
    /\.pdf$/i.test(String(file.name || "").trim()) ||
    /pdf/i.test(file.type || "");
  const mime = looksPdf ? "application/pdf" : file.type || "application/octet-stream";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function readApplyBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const raw = String(form.get("payload") || "");
    const body = raw ? JSON.parse(raw) : {};
    const documents: { docType: string; fileName: string; fileData: string }[] = [];
    for (const [key, value] of form.entries()) {
      if (!key.startsWith("file:") || typeof value === "string") continue;
      const file = value as File;
      documents.push({
        docType: key.slice(5),
        fileName: file.name || "document",
        fileData: await fileToDataUrl(file),
      });
    }
    if (documents.length) {
      body.data = { ...(body.data || {}), documents };
    }
    return body;
  }
  return request.json();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companySlug: string }> }
) {
  try {
    const { companySlug } = await params;
    const company = await prisma.company.findUnique({
      where: { slug: companySlug },
      select: { id: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    await ensureApplyRoles(company.id);

    const data = await prisma.company.findUnique({
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

    return NextResponse.json({
      ...data,
      jobRoles: applyRolesForForm(data?.jobRoles || []),
    });
  } catch (error: any) {
    return NextResponse.json({ error: publicCatchMessage(error) }, { status: 500 });
  }
}

function withCandidateCookie(
  response: NextResponse,
  candidate: { id: string } | null,
  companySlug: string,
  request?: NextRequest,
) {
  if (candidate?.id) setCandidateCookie(response, { id: candidate.id, companySlug }, request);
  return response;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companySlug: string }> }
) {
  try {
    const { companySlug } = await params;
    let body: any;
    try {
      body = await readApplyBody(request);
    } catch {
      return NextResponse.json(
        {
          error: "The form could not be saved. Please wait for the files to finish compressing, then try again.",
        },
        { status: 400 },
      );
    }

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
      return withCandidateCookie(
        NextResponse.json({ success: true, candidate }),
        candidate,
        companySlug,
        request,
      );
    }

    if (body.action === "LOGIN_CANDIDATE") {
      const candidate = await loginCandidate({
        companySlug,
        email: body.email,
        password: body.password,
      });
      return withCandidateCookie(
        NextResponse.json({ success: true, candidate }),
        candidate,
        companySlug,
        request,
      );
    }

    if (body.action === "REQUEST_PASSWORD_RESET") {
      const result = await requestCandidatePasswordReset({
        companySlug,
        email: body.email,
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
      const isProduction = process.env.NODE_ENV === "production";
      return NextResponse.json({
        success: true,
        delivered: result.delivered,
        provider: result.provider,
        channel: "EMAIL",
        expiresAt: result.expiresAt,
        trialCode: isProduction ? undefined : result.trialCode,
      });
    }

    if (body.action === "RESET_CANDIDATE_PASSWORD") {
      const candidate = await resetCandidatePassword({
        companySlug,
        email: body.email,
        otpCode: body.otpCode || body.code,
        password: body.password,
      });
      return withCandidateCookie(
        NextResponse.json({ success: true, candidate }),
        candidate,
        companySlug,
        request,
      );
    }

    if (body.action === "GET_CANDIDATE_ME") {
      const candidate = await currentCandidate(request, companySlug);
      return NextResponse.json({ candidate: candidate || null });
    }

    if (body.action === "LOGOUT_CANDIDATE") {
      const res = NextResponse.json({ success: true });
      clearCandidateCookie(res, request);
      return res;
    }

    if (body.action === "GET_CANDIDATE_APPLICATIONS") {
      const candidate = await currentCandidate(request, companySlug);
      if (!candidate) {
        return NextResponse.json({ error: "Please sign in to view your applications." }, { status: 401 });
      }
      const applications = await getCandidateApplications({
        companySlug,
        candidateId: candidate.id,
      });
      return NextResponse.json({ applications });
    }

    if (body.action === "GET_CANDIDATE_PREFILL") {
      const candidate = await currentCandidate(request, companySlug);
      if (!candidate) {
        return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
      }
      const prefill = await getCandidatePrefill({
        companySlug,
        candidateId: candidate.id,
      });
      return NextResponse.json({ prefill });
    }

    if (body.action === "GET_ADMIN_APPLICATION") {
      const officeAdmin = await currentOfficeAdmin(companySlug);
      if (!officeAdmin) {
        return NextResponse.json({ error: "Please sign in as office admin to edit this form." }, { status: 401 });
      }
      const company = await prisma.company.findUnique({
        where: { slug: companySlug },
        select: { id: true },
      });
      if (!company) throw new Error("Company not found.");
      const application = await getApplicantForAdminEdit({
        companyId: company.id,
        applicantId: String(body.applicantId || ""),
      });
      return NextResponse.json({ application });
    }

    if (body.action === "SUBMIT_APPLICATION" || body.action === "UPDATE_APPLICATION") {
      const officeAdmin = body.fillByAdmin ? await currentOfficeAdmin(companySlug) : null;
      const candidate = officeAdmin ? null : await currentCandidate(request, companySlug);
      if (!officeAdmin && !candidate) {
        return NextResponse.json({ error: "Please sign in before submitting the application." }, { status: 401 });
      }
      const fillerName = String(body.adminFillerName || officeAdmin?.name || "").trim();
      const fillerPhone = String(body.adminFillerPhone || "").replace(/\D/g, "").slice(-10);
      const admin = officeAdmin
        ? { ...officeAdmin, name: fillerName || officeAdmin.name, phone: fillerPhone }
        : null;
      if (body.action === "UPDATE_APPLICATION") {
        if (!admin) {
          return NextResponse.json({ error: "Only office admin can edit an application." }, { status: 401 });
        }
        const res = await updateApplicant(
          String(body.applicantId || ""),
          {
            ...body.data,
            companySlug,
          },
          admin,
        );
        return NextResponse.json(res);
      }
      const res = await submitApplicant(
        {
          ...body.data,
          companySlug,
          candidateAccountId: officeAdmin ? undefined : candidate?.id,
        },
        admin,
      );
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: "This request is not valid. Please try again." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: publicCatchMessage(error) }, { status: 400 });
  }
}
