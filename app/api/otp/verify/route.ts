import { NextResponse } from "next/server";
import { verifyApplicantOtp } from "@/modules/otp/services";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companySlug = String(body.companySlug || "").trim();
    const identifier = String(body.identifier || "").trim();
    const code = String(body.code || body.otpCode || "").trim();

    if (!companySlug || !identifier || !code) {
      return NextResponse.json(
        { error: "Company, mobile/email, and 6-digit code are required." },
        { status: 400 }
      );
    }

    const result = await verifyApplicantOtp({
      companySlug,
      identifier,
      code,
    });

    return NextResponse.json({ success: true, verified: result.verified });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "OTP verification failed." }, { status: 400 });
  }
}
