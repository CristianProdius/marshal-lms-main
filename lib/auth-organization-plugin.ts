import { createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import { prisma } from "./db";
import type { OrganizationContext, CombinedRole } from "./auth-types";
import {
  OrganizationRole,
  OrganizationStatus,
  InvitationStatus,
} from "./generated/prisma";
import type { BetterAuthPlugin } from "better-auth";

export const organizationPlugin = (): BetterAuthPlugin => {
  return {
    id: "organization",

    endpoints: {
      createOrganization: createAuthEndpoint(
        "/organization/create",
        {
          method: "POST",
          requiresAuth: true,
          body: z.object({
            name: z.string().min(2).max(100),
            slug: z
              .string()
              .min(2)
              .max(50)
              .regex(/^[a-z0-9-]+$/),
            description: z.string().optional(),
            contactEmail: z.string().email().optional(),
            maxSeats: z.number().min(1).default(5),
          }),
        },
        async (ctx) => {
          const { body } = ctx;
          const userId = ctx.context.session?.user?.id;

          if (!userId) {
            return ctx.json({ error: "Unauthorized" }, { status: 401 });
          }

          // Check if slug already exists
          const existingOrg = await prisma.organization.findUnique({
            where: { slug: body.slug },
          });

          if (existingOrg) {
            return ctx.json(
              { error: "Organization slug already exists" },
              { status: 400 }
            );
          }

          // Create organization
          const organization = await prisma.organization.create({
            data: {
              name: body.name,
              slug: body.slug,
              description: body.description,
              contactEmail: body.contactEmail,
              maxSeats: body.maxSeats ?? 5,
              ownerId: userId,
              status: OrganizationStatus.TRIAL,
              trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
            },
          });

          // Update user to be part of the organization
          await prisma.user.update({
            where: { id: userId },
            data: {
              organizationId: organization.id,
              organizationRole: OrganizationRole.OWNER,
              joinedOrganizationAt: new Date(),
            },
          });

          // Log activity
          await prisma.organizationActivity.create({
            data: {
              organizationId: organization.id,
              userId: userId,
              action: "organization_created",
              entityType: "organization",
              entityId: organization.id,
            },
          });

          return ctx.json({ organization });
        }
      ),

      inviteMember: createAuthEndpoint(
        "/organization/invite",
        {
          method: "POST",
          requiresAuth: true,
          body: z.object({
            email: z.string().email(),
            role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
            message: z.string().optional(),
            courseIds: z.array(z.string()).optional(),
          }),
        },
        async (ctx) => {
          const { body } = ctx;
          const userId = ctx.context.session?.user?.id;

          if (!userId) {
            return ctx.json({ error: "Unauthorized" }, { status: 401 });
          }

          const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { organization: true },
          });

          if (!user?.organizationId || !user.organization) {
            return ctx.json(
              { error: "User is not part of an organization" },
              { status: 400 }
            );
          }

          // Check permissions (only OWNER and ADMIN can invite)
          if (
            user.organizationRole !== OrganizationRole.OWNER &&
            user.organizationRole !== OrganizationRole.ADMIN
          ) {
            return ctx.json(
              { error: "Insufficient permissions" },
              { status: 403 }
            );
          }

          // Check seat availability
          const memberCount = await prisma.user.count({
            where: { organizationId: user.organizationId },
          });

          if (memberCount >= user.organization.maxSeats) {
            return ctx.json(
              { error: "Organization has reached maximum seat limit" },
              { status: 400 }
            );
          }

          // Check if already invited or member
          const existingMember = await prisma.user.findUnique({
            where: { email: body.email },
          });

          if (existingMember?.organizationId === user.organizationId) {
            return ctx.json(
              { error: "User is already a member of this organization" },
              { status: 400 }
            );
          }

          const existingInvitation =
            await prisma.organizationInvitation.findUnique({
              where: {
                organizationId_email: {
                  organizationId: user.organizationId,
                  email: body.email,
                },
              },
            });

          if (
            existingInvitation &&
            existingInvitation.status === InvitationStatus.PENDING
          ) {
            return ctx.json(
              { error: "Invitation already sent to this email" },
              { status: 400 }
            );
          }

          // Create invitation
          const invitation = await prisma.organizationInvitation.create({
            data: {
              organizationId: user.organizationId,
              email: body.email,
              role: body.role as OrganizationRole,
              message: body.message,
              senderId: userId,
              courseIds: body.courseIds || [],
              status: InvitationStatus.PENDING,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
          });

          // Log activity
          await prisma.organizationActivity.create({
            data: {
              organizationId: user.organizationId,
              userId: userId,
              action: "member_invited",
              entityType: "invitation",
              entityId: invitation.id,
              metadata: { email: body.email, role: body.role },
            },
          });

          // TODO: Send invitation email via Resend
          // await sendInvitationEmail(invitation);

          return ctx.json({ invitation });
        }
      ),

      acceptInvitation: createAuthEndpoint(
        "/organization/accept-invitation",
        {
          method: "POST",
          requiresAuth: true,
          body: z.object({
            token: z.string().uuid(),
          }),
        },
        async (ctx) => {
          const { body } = ctx;
          const userId = ctx.context.session?.user?.id;

          if (!userId) {
            return ctx.json({ error: "Unauthorized" }, { status: 401 });
          }

          const invitation = await prisma.organizationInvitation.findUnique({
            where: { token: body.token },
            include: { organization: true },
          });

          if (!invitation) {
            return ctx.json({ error: "Invalid invitation" }, { status: 404 });
          }

          if (invitation.status !== InvitationStatus.PENDING) {
            return ctx.json(
              { error: "Invitation is no longer valid" },
              { status: 400 }
            );
          }

          if (new Date() > invitation.expiresAt) {
            await prisma.organizationInvitation.update({
              where: { id: invitation.id },
              data: { status: InvitationStatus.EXPIRED },
            });
            return ctx.json(
              { error: "Invitation has expired" },
              { status: 400 }
            );
          }

          const user = await prisma.user.findUnique({
            where: { id: userId },
          });

          if (user?.email !== invitation.email) {
            return ctx.json(
              { error: "Invitation email does not match user email" },
              { status: 400 }
            );
          }

          if (user?.organizationId) {
            return ctx.json(
              { error: "User is already part of an organization" },
              { status: 400 }
            );
          }

          // Update user to join organization
          await prisma.user.update({
            where: { id: userId },
            data: {
              organizationId: invitation.organizationId,
              organizationRole: invitation.role,
              joinedOrganizationAt: new Date(),
            },
          });

          // Update invitation status
          await prisma.organizationInvitation.update({
            where: { id: invitation.id },
            data: {
              status: InvitationStatus.ACCEPTED,
              acceptedAt: new Date(),
            },
          });

          // Log activity
          await prisma.organizationActivity.create({
            data: {
              organizationId: invitation.organizationId,
              userId: userId,
              action: "member_joined",
              entityType: "user",
              entityId: userId,
            },
          });

          return ctx.json({
            success: true,
            organization: invitation.organization,
          });
        }
      ),

      leaveOrganization: createAuthEndpoint(
        "/organization/leave",
        {
          method: "POST",
          requiresAuth: true,
        },
        async (ctx) => {
          const userId = ctx.context.session?.user?.id;

          if (!userId) {
            return ctx.json({ error: "Unauthorized" }, { status: 401 });
          }

          const user = await prisma.user.findUnique({
            where: { id: userId },
          });

          if (!user?.organizationId) {
            return ctx.json(
              { error: "User is not part of an organization" },
              { status: 400 }
            );
          }

          if (user.organizationRole === OrganizationRole.OWNER) {
            return ctx.json(
              {
                error:
                  "Organization owner cannot leave. Transfer ownership first.",
              },
              { status: 400 }
            );
          }

          const organizationId = user.organizationId;

          // Update user
          await prisma.user.update({
            where: { id: userId },
            data: {
              organizationId: null,
              organizationRole: null,
              joinedOrganizationAt: null,
            },
          });

          // Log activity
          await prisma.organizationActivity.create({
            data: {
              organizationId: organizationId,
              userId: userId,
              action: "member_left",
              entityType: "user",
              entityId: userId,
            },
          });

          return ctx.json({ success: true });
        }
      ),

      getOrganization: createAuthEndpoint(
        "/organization",
        {
          method: "GET",
          requiresAuth: true,
        },
        async (ctx) => {
          const userId = ctx.context.session?.user?.id;

          if (!userId) {
            return ctx.json({ error: "Unauthorized" }, { status: 401 });
          }

          const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
              organization: {
                include: {
                  _count: {
                    select: {
                      members: true,
                      courseLicenses: true,
                    },
                  },
                },
              },
            },
          });

          if (!user?.organization) {
            return ctx.json({ organization: null });
          }

          return ctx.json({ organization: user.organization });
        }
      ),

      getMembers: createAuthEndpoint(
        "/organization/members",
        {
          method: "GET",
          requiresAuth: true,
        },
        async (ctx) => {
          const userId = ctx.context.session?.user?.id;

          if (!userId) {
            return ctx.json({ error: "Unauthorized" }, { status: 401 });
          }

          const user = await prisma.user.findUnique({
            where: { id: userId },
          });

          if (!user?.organizationId) {
            return ctx.json(
              { error: "User is not part of an organization" },
              { status: 400 }
            );
          }

          const members = await prisma.user.findMany({
            where: { organizationId: user.organizationId },
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              organizationRole: true,
              joinedOrganizationAt: true,
            },
            orderBy: {
              joinedOrganizationAt: "desc",
            },
          });

          return ctx.json({ members });
        }
      ),

      removeMember: createAuthEndpoint(
        "/organization/remove-member",
        {
          method: "POST",
          requiresAuth: true,
          body: z.object({
            memberId: z.string(),
          }),
        },
        async (ctx) => {
          const { body } = ctx;
          const userId = ctx.context.session?.user?.id;

          if (!userId) {
            return ctx.json({ error: "Unauthorized" }, { status: 401 });
          }

          const user = await prisma.user.findUnique({
            where: { id: userId },
          });

          if (!user?.organizationId) {
            return ctx.json(
              { error: "User is not part of an organization" },
              { status: 400 }
            );
          }

          // Check permissions (only OWNER and ADMIN can remove members)
          if (
            user.organizationRole !== OrganizationRole.OWNER &&
            user.organizationRole !== OrganizationRole.ADMIN
          ) {
            return ctx.json(
              { error: "Insufficient permissions" },
              { status: 403 }
            );
          }

          const memberToRemove = await prisma.user.findUnique({
            where: { id: body.memberId },
          });

          if (
            !memberToRemove ||
            memberToRemove.organizationId !== user.organizationId
          ) {
            return ctx.json(
              { error: "Member not found in organization" },
              { status: 404 }
            );
          }

          if (memberToRemove.organizationRole === OrganizationRole.OWNER) {
            return ctx.json(
              { error: "Cannot remove organization owner" },
              { status: 400 }
            );
          }

          // Remove member from organization
          await prisma.user.update({
            where: { id: body.memberId },
            data: {
              organizationId: null,
              organizationRole: null,
              joinedOrganizationAt: null,
            },
          });

          // Log activity
          await prisma.organizationActivity.create({
            data: {
              organizationId: user.organizationId,
              userId: userId,
              action: "member_removed",
              entityType: "user",
              entityId: body.memberId,
              metadata: { removedBy: userId, removedUser: body.memberId },
            },
          });

          return ctx.json({ success: true });
        }
      ),

      updateOrganization: createAuthEndpoint(
        "/organization/update",
        {
          method: "PUT",
          requiresAuth: true,
          body: z.object({
            name: z.string().min(2).max(100).optional(),
            description: z.string().optional(),
            contactEmail: z.string().email().optional(),
            maxSeats: z.number().min(1).optional(),
            allowSelfSignup: z.boolean().optional(),
            domains: z.array(z.string()).optional(),
            requireAdminApproval: z.boolean().optional(),
          }),
        },
        async (ctx) => {
          const { body } = ctx;
          const userId = ctx.context.session?.user?.id;

          if (!userId) {
            return ctx.json({ error: "Unauthorized" }, { status: 401 });
          }

          const user = await prisma.user.findUnique({
            where: { id: userId },
          });

          if (!user?.organizationId) {
            return ctx.json(
              { error: "User is not part of an organization" },
              { status: 400 }
            );
          }

          // Check permissions (only OWNER can update organization)
          if (user.organizationRole !== OrganizationRole.OWNER) {
            return ctx.json(
              { error: "Only organization owner can update settings" },
              { status: 403 }
            );
          }

          const updatedOrganization = await prisma.organization.update({
            where: { id: user.organizationId },
            data: {
              ...body,
              updatedAt: new Date(),
            },
          });

          // Log activity
          await prisma.organizationActivity.create({
            data: {
              organizationId: user.organizationId,
              userId: userId,
              action: "organization_updated",
              entityType: "organization",
              entityId: user.organizationId,
              metadata: { changes: body },
            },
          });

          return ctx.json({ organization: updatedOrganization });
        }
      ),

      getPendingInvitations: createAuthEndpoint(
        "/organization/invitations",
        {
          method: "GET",
          requiresAuth: true,
        },
        async (ctx) => {
          const userId = ctx.context.session?.user?.id;

          if (!userId) {
            return ctx.json({ error: "Unauthorized" }, { status: 401 });
          }

          const user = await prisma.user.findUnique({
            where: { id: userId },
          });

          if (!user?.organizationId) {
            return ctx.json(
              { error: "User is not part of an organization" },
              { status: 400 }
            );
          }

          const invitations = await prisma.organizationInvitation.findMany({
            where: {
              organizationId: user.organizationId,
              status: InvitationStatus.PENDING,
            },
            include: {
              sender: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          });

          return ctx.json({ invitations });
        }
      ),

      cancelInvitation: createAuthEndpoint(
        "/organization/invitation/cancel",
        {
          method: "POST",
          requiresAuth: true,
          body: z.object({
            invitationId: z.string(),
          }),
        },
        async (ctx) => {
          const { body } = ctx;
          const userId = ctx.context.session?.user?.id;

          if (!userId) {
            return ctx.json({ error: "Unauthorized" }, { status: 401 });
          }

          const user = await prisma.user.findUnique({
            where: { id: userId },
          });

          if (!user?.organizationId) {
            return ctx.json(
              { error: "User is not part of an organization" },
              { status: 400 }
            );
          }

          // Check permissions
          if (
            user.organizationRole !== OrganizationRole.OWNER &&
            user.organizationRole !== OrganizationRole.ADMIN
          ) {
            return ctx.json(
              { error: "Insufficient permissions" },
              { status: 403 }
            );
          }

          const invitation = await prisma.organizationInvitation.findUnique({
            where: { id: body.invitationId },
          });

          if (
            !invitation ||
            invitation.organizationId !== user.organizationId
          ) {
            return ctx.json({ error: "Invitation not found" }, { status: 404 });
          }

          if (invitation.status !== InvitationStatus.PENDING) {
            return ctx.json(
              { error: "Invitation is no longer pending" },
              { status: 400 }
            );
          }

          await prisma.organizationInvitation.update({
            where: { id: body.invitationId },
            data: {
              status: InvitationStatus.REJECTED,
              rejectedAt: new Date(),
            },
          });

          return ctx.json({ success: true });
        }
      ),
    },

    hooks: {
      after: [
        {
          matcher: (context: any) => true,
          handler: async (context: any) => {
            // Add organization context to session after any auth operation
            if (context.session?.user?.id) {
              const user = await prisma.user.findUnique({
                where: { id: context.session.user.id },
                include: {
                  organization: true,
                },
              });

              if (user?.organization) {
                const organizationContext: OrganizationContext = {
                  id: user.organization.id,
                  name: user.organization.name,
                  slug: user.organization.slug,
                  role: user.organizationRole as OrganizationRole,
                  maxSeats: user.organization.maxSeats,
                  usedSeats: await prisma.user.count({
                    where: { organizationId: user.organization.id },
                  }),
                  status: user.organization.status as any,
                  trialEndsAt: user.organization.trialEndsAt,
                };

                // Determine combined role
                let combinedRole: CombinedRole = "individual";
                if (user.role === "admin") {
                  combinedRole = "admin";
                } else if (user.organizationRole) {
                  switch (user.organizationRole) {
                    case OrganizationRole.OWNER:
                      combinedRole = "org_owner";
                      break;
                    case OrganizationRole.ADMIN:
                      combinedRole = "org_admin";
                      break;
                    case OrganizationRole.MEMBER:
                      combinedRole = "org_member";
                      break;
                  }
                }

                context.session.user = {
                  ...context.session.user,
                  organizationId: user.organizationId,
                  organization: organizationContext,
                  combinedRole,
                };
              } else {
                const combinedRole =
                  user?.role === "admin" ? "admin" : "individual";
                context.session.user = {
                  ...context.session.user,
                  organizationId: null,
                  organization: null,
                  combinedRole,
                };
              }
            }
            return context;
          },
        },
      ],
    },
  };
};
