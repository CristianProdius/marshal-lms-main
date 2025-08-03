"use server";

import arcjet, { fixedWindow } from "@/lib/arcjet";
import { prisma } from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import {
  organizationSignupSchema,
  OrganizationSignupSchemaType,
} from "@/lib/zodSchemas";
import { request } from "@arcjet/next";
import { resend } from "@/lib/resend";
import { v4 as uuidv4 } from "uuid";
import { OrganizationRole, OrganizationStatus } from "@/lib/generated/prisma";

const aj = arcjet.withRule(
  fixedWindow({
    mode: "LIVE",
    window: "10m",
    max: 3, // Only allow 3 organization signups per 10 minutes per IP
  })
);

export async function createOrganizationWithAdmin(
  values: OrganizationSignupSchemaType
): Promise<ApiResponse> {
  try {
    // Rate limiting by IP
    const req = await request();
    const decision = await aj.protect(req, {
      fingerprint: req.ip || "unknown",
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return {
          status: "error",
          message: "Too many signup attempts. Please try again later.",
        };
      } else {
        return {
          status: "error",
          message: "Request blocked. Please contact support if this persists.",
        };
      }
    }

    // Validate input
    const validation = organizationSignupSchema.safeParse(values);
    if (!validation.success) {
      return {
        status: "error",
        message: validation.error.errors[0].message || "Invalid form data",
      };
    }

    const data = validation.data;

    // Check if organization slug already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: data.organizationSlug },
    });

    if (existingOrg) {
      return {
        status: "error",
        message: "Organization slug is already taken. Please choose another.",
      };
    }

    // Check if admin email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.adminEmail },
    });

    if (existingUser) {
      return {
        status: "error",
        message:
          "An account with this email already exists. Please sign in instead.",
      };
    }

    // Generate user ID and verification code
    const userId = uuidv4();
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create organization and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the organization
      const organization = await tx.organization.create({
        data: {
          name: data.organizationName,
          slug: data.organizationSlug,
          description: data.organizationDescription,
          contactEmail: data.contactEmail || data.adminEmail,
          contactPhone: data.contactPhone,
          website: data.website,
          maxSeats: data.maxSeats,
          ownerId: userId,
          status: OrganizationStatus.TRIAL,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
          billingEmail: data.adminEmail,
          allowSelfSignup: false,
          requireAdminApproval: true,
        },
      });

      // Create the admin user
      const user = await tx.user.create({
        data: {
          id: userId,
          name: data.adminName,
          email: data.adminEmail,
          emailVerified: false,
          role: "admin", // Organization owner is also a system admin
          organizationId: organization.id,
          organizationRole: OrganizationRole.OWNER,
          joinedOrganizationAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create verification record
      await tx.verification.create({
        data: {
          id: uuidv4(),
          identifier: data.adminEmail,
          value: verificationCode,
          expiresAt: verificationExpiry,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Log organization activity
      await tx.organizationActivity.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          action: "organization_created",
          entityType: "organization",
          entityId: organization.id,
          metadata: {
            createdBy: "signup",
            initialSeats: data.maxSeats,
          },
        },
      });

      return { organization, user };
    });

    // Send welcome email with verification code
    await resend.emails.send({
      from: "MarshalLMS <noreply@marshallms.com>",
      to: [data.adminEmail],
      subject: `Welcome to MarshalLMS - ${data.organizationName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .verification-code { background: #fff; border: 2px dashed #667eea; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 8px; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
              .info-box { background: #e7f3ff; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to MarshalLMS! 🎉</h1>
                <p style="margin: 0; opacity: 0.9;">Your organization has been created successfully</p>
              </div>
              
              <div class="content">
                <h2>Hello ${data.adminName},</h2>
                
                <p>Congratulations on creating <strong>${
                  data.organizationName
                }</strong> on MarshalLMS! You're now the organization administrator with full control over your learning management system.</p>
                
                <div class="info-box">
                  <strong>📧 Verify Your Email</strong><br>
                  To get started, please verify your email address using the code below:
                </div>
                
                <div class="verification-code">
                  ${verificationCode}
                </div>
                
                <p><small>This code will expire in 10 minutes for security reasons.</small></p>
                
                <h3>Your Organization Details:</h3>
                <ul>
                  <li><strong>Organization:</strong> ${
                    data.organizationName
                  }</li>
                  <li><strong>URL Slug:</strong> ${data.organizationSlug}</li>
                  <li><strong>Available Seats:</strong> ${data.maxSeats}</li>
                  <li><strong>Trial Period:</strong> 14 days (Full access to all features)</li>
                </ul>
                
                <h3>What's Next?</h3>
                <ol>
                  <li>Verify your email using the code above</li>
                  <li>Complete your organization profile</li>
                  <li>Invite team members to join</li>
                  <li>Browse and purchase courses for your team</li>
                  <li>Track your team's learning progress</li>
                </ol>
                
                <div class="info-box" style="background: #fff3cd; border-color: #ffc107;">
                  <strong>🎁 Trial Benefits</strong><br>
                  Your 14-day trial includes full access to all features. No credit card required!
                </div>
                
                <center>
                  <a href="${
                    process.env.BETTER_AUTH_URL
                  }/verify-request?email=${encodeURIComponent(
        data.adminEmail
      )}" class="button">
                    Verify Email Address
                  </a>
                </center>
                
                <div class="footer">
                  <p>If you didn't create this account, please ignore this email.</p>
                  <p>Need help? Contact our support team at support@marshallms.com</p>
                  <p>&copy; ${new Date().getFullYear()} MarshalLMS. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return {
      status: "success",
      message:
        "Organization created successfully! Please check your email for verification.",
    };
  } catch (error) {
    console.error("Organization signup error:", error);

    // Check for specific Prisma errors
    if (error instanceof Error) {
      if (error.message.includes("Unique constraint")) {
        return {
          status: "error",
          message:
            "Organization or email already exists. Please try different values.",
        };
      }
    }

    return {
      status: "error",
      message: "Failed to create organization. Please try again later.",
    };
  }
}

export async function checkSlugAvailability(
  slug: string
): Promise<ApiResponse> {
  try {
    if (!slug || slug.length < 2) {
      return {
        status: "error",
        message: "Slug must be at least 2 characters",
      };
    }

    const existing = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing) {
      return {
        status: "error",
        message: "This slug is already taken",
      };
    }

    return {
      status: "success",
      message: "Slug is available",
    };
  } catch (error) {
    return {
      status: "error",
      message: "Failed to check slug availability",
    };
  }
}

export async function checkEmailAvailability(
  email: string
): Promise<ApiResponse> {
  try {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return {
        status: "error",
        message: "This email is already registered",
      };
    }

    return {
      status: "success",
      message: "Email is available",
    };
  } catch (error) {
    return {
      status: "error",
      message: "Failed to check email availability",
    };
  }
}
