import { auth } from "@/lib/auth";
import { homePathForUser } from "@/lib/auth/homePath";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  redirect(await homePathForUser(session.user as any));
}
