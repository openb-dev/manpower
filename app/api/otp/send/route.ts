import { NextResponse } from "next/server";
import { requestApplicantOtp } from "@/modules/otp/services";
import { publicCatchMessage } from "@/lib/publicErrors";

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Please try again." }, { status: 400 });
    }
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
    return NextResponse.json({ error: publicCatchMessage(error) || "Could not send the verification code." }, { status: 400 });
  }
}
