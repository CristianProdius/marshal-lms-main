import "server-only";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { OrganizationContext } from "@/lib/auth-types";
import { prisma } from "@/lib/db";

export const requireOrganization = cache(
  async (): Promise<{
    user: any;
    organization: OrganizationContext;
  }> => {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return redirect("/login");
    }

    // Get full user with organization data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        organization: true,
      },
    });

    if (!user?.organizationId || !user.organization) {
      return redirect("/organization/create");
    }

    const organizationContext: OrganizationContext = {
      id: user.organization.id,
      name: user.organization.name,
      slug: user.organization.slug,
      role: user.organizationRole as any,
      maxSeats: user.organization.maxSeats,
      usedSeats: await prisma.user.count({
        where: { organizationId: user.organization.id },
      }),
      status: user.organization.status as any,
      trialEndsAt: user.organization.trialEndsAt,
    };

    return {
      user: session.user,
      organization: organizationContext,
    };
  }
);

export const requireOrganizationAdmin = cache(async () => {
  const { user, organization } = await requireOrganization();

  if (organization.role !== "OWNER" && organization.role !== "ADMIN") {
    return redirect("/dashboard");
  }

  return { user, organization };
});

export const requireOrganizationOwner = cache(async () => {
  const { user, organization } = await requireOrganization();

  if (organization.role !== "OWNER") {
    return redirect("/dashboard");
  }

  return { user, organization };
});
