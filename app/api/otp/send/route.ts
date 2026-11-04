import { NextResponse } from "next/server";
import { requestApplicantOtp } from "@/modules/otp/services";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companySlug = String(body.companySlug || "").trim();
    const identifier = String(body.identifier || "").trim();
    const channel = body.channel === "EMAIL" ? "EMAIL" : "WHATSAPP";

    if (!companySlug) {
      return NextResponse.json({ error: "Company is required." }, { status: 400 });
    }
    if (!identifier) {
      return NextResponse.json({ error: "Mobile number or email is required." }, { status: 400 });
    }

    const result = await requestApplicantOtp({
      companySlug,
      identifier,
      channel,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      success: true,
      delivered: result.delivered,
      provider: result.provider,
      channel: result.channel,
      expiresAt: result.expiresAt,
      trialCode: result.trialCode,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not send OTP." }, { status: 400 });
  }
}
