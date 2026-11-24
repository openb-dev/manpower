import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { friendlyPublicError } from "@/lib/publicErrors";
import {
  listSuperAdminBook,
  saveOfficeUser,
  setOfficeUserActive,
} from "@/modules/superAdmin/services";

async function requireSuperAdmin() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id || user.role !== Role.SUPER_ADMIN) {
    return null;
  }
  return user;
}

export async function GET() {
  try {
    const user = await requireSuperAdmin();
    if (!user) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    const book = await listSuperAdminBook();
    return NextResponse.json(book);
  } catch (err: any) {
    return NextResponse.json(
      { error: friendlyPublicError(err.message || "Could not load Super Admin data.") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSuperAdmin();
    if (!user) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    const body = await req.json();

    if (body.action === "SAVE_OFFICE_USER") {
      const saved = await saveOfficeUser({
        id: body.id || undefined,
        name: body.name,
        email: body.email,
        password: body.password,
        role: body.role,
        companyId: body.companyId,
        employeeId: body.employeeId || null,
        projectIds: Array.isArray(body.projectIds) ? body.projectIds : [],
        active: body.active !== false,
      });
      return NextResponse.json(saved);
    }

    if (body.action === "SET_OFFICE_USER_ACTIVE") {
      const saved = await setOfficeUserActive(String(body.id || ""), Boolean(body.active));
      return NextResponse.json(saved);
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: friendlyPublicError(err.message || "Could not save.") },
      { status: 400 },
    );
  }
}
