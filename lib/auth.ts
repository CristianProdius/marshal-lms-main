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

  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  socialProviders: {
    github: {
      clientId: env.AUTH_GITHUB_CLIENT_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
    },
  },

  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        try {
          console.log(`Sending ${type} OTP to:`, email);

          const subject =
            type === "sign-in"
              ? "Sign in to PrecuityAI"
              : "Verify your PrecuityAI account";

          const result = await resend.emails.send({
            from: "PrecuityAI <cristian@prodiusenterprise.com>",
            to: [email],
            subject: subject,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .otp-code { background: #fff; border: 2px dashed #667eea; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 8px; color: #667eea; }
                    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>PrecuityAI</h1>
                      <p style="margin: 0; opacity: 0.9;">${
                        type === "sign-in"
                          ? "Sign In Request"
                          : "Email Verification"
                      }</p>
                    </div>
                    
                    <div class="content">
                      <h2>Hello!</h2>
                      
                      <p>${
                        type === "sign-in"
                          ? "You requested to sign in to your PrecuityAI account. Use the verification code below:"
                          : "Please verify your email address using the code below:"
                      }</p>
                      
                      <div class="otp-code">
                        ${otp}
                      </div>
                      
                      <p><small>This code will expire in 10 minutes for security reasons.</small></p>
                      
                      <p>If you didn't request this code, you can safely ignore this email.</p>
                      
                      <div class="footer">
                        <p>Need help? Contact our support team at support@PrecuityAI.com</p>
                        <p>&copy; ${new Date().getFullYear()} PrecuityAI. All rights reserved.</p>
                      </div>
                    </div>
                  </div>
                </body>
              </html>
            `,
          });

          console.log("OTP email sent successfully:", result);
          // Return void as required by the type
        } catch (error) {
          console.error("Failed to send OTP email:", error);
          throw new Error("Failed to send verification email");
        }
      },
      otpLength: 6,
      expiresIn: 60 * 10, // 10 minutes
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
