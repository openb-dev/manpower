import { redirect } from "next/navigation";

export default function ApplyIndexPage() {
  // Directly route to the primary recruitment portal without showing multiple companies
  redirect("/apply/nk");
}
