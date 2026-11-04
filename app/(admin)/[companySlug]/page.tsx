import { redirect } from "next/navigation";

export default async function CompanyHomePage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  redirect(`/${companySlug}/dashboard`);
}
