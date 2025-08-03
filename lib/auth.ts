import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";
import { env } from "./env";
import { emailOTP } from "better-auth/plugins";
import { resend } from "./resend";
import { admin } from "better-auth/plugins";
import { organizationPlugin } from "./auth-organization-plugin";
import type { OrganizationContext, CombinedRole } from "./auth-types";

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
