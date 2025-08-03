import { auth } from "@/lib/auth";
import { OrganizationSignupForm } from "./_components/OrganizationSignupForm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function OrganizationSignupPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If user is already logged in and has an organization, redirect
  if (session?.user) {
    const user = session.user as any;
    if (user.organizationId) {
      return redirect("/dashboard");
    }
  }

  return <OrganizationSignupForm />;
}
