import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";
import { env } from "./env";
import { emailOTP } from "better-auth/plugins";
import { resend } from "./resend";
import { admin } from "better-auth/plugins";
import { organizationPlugin } from "./auth-organization-plugin";
import type { OrganizationContext, CombinedRole } from "./auth-types";
import { createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import crypto from "crypto";
import type { BetterAuthPlugin } from "better-auth";

// Create a custom plugin for organization verification
const organizationVerificationPlugin = (): BetterAuthPlugin => {
  return {
    id: "organization-verification",
    endpoints: {
      verifyOrganizationSignup: createAuthEndpoint(
        "/verify-organization-signup",
        {
          method: "POST",
          body: z.object({
            email: z.string().email(),
            code: z.string().length(6),
          }),
        },
        async (ctx) => {
          const { body } = ctx;

          try {
            // Find the verification record
            const verification = await prisma.verification.findFirst({
              where: {
                identifier: body.email,
                value: body.code,
                expiresAt: {
                  gt: new Date(),
                },
              },
            });

            if (!verification) {
              return ctx.json(
                { error: "Invalid or expired verification code" },
                { status: 400 }
              );
            }

            // Find and update the user
            const user = await prisma.user.findUnique({
              where: { email: body.email },
              include: { organization: true },
            });

            if (!user) {
              return ctx.json({ error: "User not found" }, { status: 404 });
            }

            // Update user to mark as verified
            await prisma.user.update({
              where: { id: user.id },
              data: { emailVerified: true },
            });

            // Delete the verification record
            await prisma.verification.delete({
              where: { id: verification.id },
            });

            // Create a session for the user
            const sessionId = crypto.randomUUID();
            const sessionToken = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 30 * 1000); // 30 days

            await prisma.session.create({
              data: {
                id: sessionId,
                token: sessionToken,
                userId: user.id,
                expiresAt: expiresAt,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });

            // Set the session cookie
            ctx.setHeader(
              "Set-Cookie",
              `better-auth.session_token=${sessionToken}; HttpOnly; Path=/; SameSite=Lax; ${
                process.env.NODE_ENV === "production" ? "Secure;" : ""
              } Max-Age=${60 * 60 * 24 * 30}`
            );

            return ctx.json({
              success: true,
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                organizationId: user.organizationId,
                organization: user.organization,
              },
              session: {
                id: sessionId,
                token: sessionToken,
                expiresAt: expiresAt,
              },
            });
          } catch (error) {
            console.error("Verification error:", error);
            return ctx.json(
              { error: "Failed to verify email" },
              { status: 500 }
            );
          }
        }
      ),
    },
  };
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  socialProviders: {
    github: {
      clientId: env.AUTH_GITHUB_CLIENT_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
    },
  },

  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        await resend.emails.send({
          from: "PrecuityAI <cristian@prodiusenterprise.com>",
          to: [email],
          subject: "PrecuityAI - Verify your email",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Welcome to PrecuityAI</h2>
              <p>Your verification code is:</p>
              <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px;">
                ${otp}
              </div>
              <p>This code will expire in 10 minutes.</p>
              <p>If you didn't request this verification, please ignore this email.</p>
            </div>
          `,
        });
      },
    }),
    admin(),
    organizationPlugin(),
    organizationVerificationPlugin(), // Add our custom verification plugin
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // Extend the user type to include organization fields
  user: {
    additionalFields: {
      organizationId: {
        type: "string",
        required: false,
      },
      organizationRole: {
        type: "string",
        required: false,
      },
      combinedRole: {
        type: "string",
        required: false,
      },
    },
  },
});

// Extend the session type
declare module "better-auth" {
  interface BetterAuthSession {
    user: {
      id: string;
      name: string;
      email: string;
      emailVerified: boolean;
      image?: string | null;
      createdAt: Date;
      updatedAt: Date;
      role?: string | null;
      banned?: boolean | null;
      banReason?: string | null;
      banExpires?: Date | null;
      organizationId?: string | null;

      combinedRole?: CombinedRole;
      organizationContext?: OrganizationContext | null;
    };
  }
}

export type Auth = typeof auth;
