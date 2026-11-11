import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const CANDIDATE_COOKIE = "nk_candidate";
const SESSION_HOURS = 12;

export type CandidateAuth = {
  id: string;
  companyId: string;
  fullName: string;
  email: string;
  whatsappNo: string;
};

function sessionSecret() {
  const secret = process.env.AUTH_SECRET || process.env.APP_DATA_KEY || "";
  if (!secret) throw new Error("Server session key is missing.");
  return secret;
}

function signToken(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function readToken(token: string): { sub?: string; slug?: string; exp?: number } | null {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.sub || !payload?.slug || !payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function setCandidateCookie(
  response: NextResponse,
  candidate: { id: string; companySlug: string },
) {
  const token = signToken({
    sub: candidate.id,
    slug: candidate.companySlug,
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  });
  response.cookies.set(CANDIDATE_COOKIE, token, cookieOptions(SESSION_HOURS * 60 * 60));
}

export function clearCandidateCookie(response: NextResponse) {
  response.cookies.set(CANDIDATE_COOKIE, "", cookieOptions(0));
}

export async function currentCandidate(
  request: NextRequest,
  companySlug: string,
): Promise<CandidateAuth | null> {
  const token = request.cookies.get(CANDIDATE_COOKIE)?.value;
  const payload = token ? readToken(token) : null;
  if (!payload?.sub || payload.slug !== companySlug) return null;

  const company = await prisma.company.findUnique({
    where: { slug: companySlug },
    select: { id: true },
  });
  if (!company) return null;

  const candidate = await prisma.candidateAccount.findFirst({
    where: { id: payload.sub, companyId: company.id, isVerified: true },
    select: {
      id: true,
      companyId: true,
      fullName: true,
      email: true,
      whatsappNo: true,
    },
  });
  return candidate;
}
