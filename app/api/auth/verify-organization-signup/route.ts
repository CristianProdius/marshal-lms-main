import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const verificationSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(request: NextRequest) {
  try {
    console.log("Organization verification API route called");

    const body = await request.json();
    console.log("Request body:", {
      email: body.email,
      codeLength: body.code?.length,
    });

    // Validate input
    const validation = verificationSchema.safeParse(body);
    if (!validation.success) {
      console.log("Validation failed:", validation.error);
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    const { email, code } = validation.data;

    // Find the verification record
    const verification = await prisma.verification.findFirst({
      where: {
        identifier: email,
        value: code,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!verification) {
      console.log("Verification not found or expired");
      return NextResponse.json(
        { error: "Invalid or expired verification code" },
        { status: 400 }
      );
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      console.log("User not found");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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

    console.log("Verification successful for user:", user.id);

    // Return success with redirect to login page with pre-filled email
    return NextResponse.json({
      success: true,
      message: "Email verified successfully",
      redirectTo: `/login?email=${encodeURIComponent(email)}&verified=true`,
    });
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      {
        error: "Failed to verify email",
        message: "Please try again later",
      },
      { status: 500 }
    );
  }
}
