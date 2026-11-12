import { NextResponse } from "next/server";
import { publicCatchMessage } from "@/lib/publicErrors";
import {
  requestOfficePasswordReset,
  resetOfficePassword,
  verifyOfficeResetOtp,
} from "@/modules/officeAuth/services";

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Please try again." }, { status: 400 });
    }

    const action = String(body.action || "").trim();
    const email = String(body.email || "").trim();
    const code = String(body.otpCode || body.code || "").trim();
    const password = String(body.password || "");

    if (action === "REQUEST") {
      const result = await requestOfficePasswordReset({
        email,
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      });
      const isProduction = process.env.NODE_ENV === "production";
      return NextResponse.json({
        success: true,
        delivered: result.delivered,
        provider: result.provider,
        expiresAt: result.expiresAt,
        trialCode: isProduction ? undefined : result.trialCode,
      });
    }

    if (action === "VERIFY") {
      const result = await verifyOfficeResetOtp({ email, code });
      return NextResponse.json({ success: true, verified: result.verified });
    }

    if (action === "RESET") {
      await resetOfficePassword({ email, otpCode: code, password });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Please try again." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: publicCatchMessage(error) || "Could not change the password." },
      { status: 400 },
    );
  }
}
