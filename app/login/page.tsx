import { auth } from "@/lib/auth";
import { homePathForUser } from "@/lib/auth/homePath";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect(await homePathForUser(session.user as any));
  }

  return <LoginForm />;
}
