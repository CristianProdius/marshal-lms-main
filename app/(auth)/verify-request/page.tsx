"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth-client";
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { toast } from "sonner";

export default function VerifyRequestRoute() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyRequest />
    </Suspense>
  );
}

function VerifyRequest() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [verifyPending, startVerifyTransition] = useTransition();
  const [resendPending, startResendTransition] = useTransition();
  const params = useSearchParams();
  const email = params.get("email") as string;
  const isOrganizationSignup = params.get("org") === "true";
  const isOtpCompleted = otp.length === 6;

  async function verifyOtp() {
    if (!email || !otp) {
      toast.error("Missing email or verification code");
      return;
    }

    startVerifyTransition(async () => {
      try {
        if (isOrganizationSignup) {
          // Organization signup verification
          console.log("Verifying organization signup for:", email);

          const response = await fetch("/api/auth/verify-organization-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              email: email,
              code: otp,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            toast.error(data.error || "Error verifying email");
            setOtp(""); // Clear the OTP on error
            return;
          }

          if (data.success) {
            toast.success(
              "Email verified successfully! Redirecting to login..."
            );

            // Redirect to login with email pre-filled
            setTimeout(() => {
              window.location.href =
                data.redirectTo ||
                `/login?email=${encodeURIComponent(email)}&verified=true`;
            }, 1500);
          } else {
            toast.error("Verification failed. Please try again.");
            setOtp(""); // Clear the OTP on error
          }
        } else {
          // Regular email OTP verification for sign-in
          try {
            // Direct API call for better error handling
            const response = await fetch("/api/auth/email-otp/verify-otp", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                email: email,
                otp: otp,
              }),
            });

            if (!response.ok) {
              const error = await response
                .json()
                .catch(() => ({ message: "Verification failed" }));
              throw new Error(error.message || "Invalid verification code");
            }

            const data = await response.json();

            if (data.session) {
              toast.success("Successfully signed in!");
              router.push("/dashboard");
            } else {
              throw new Error("No session created");
            }
          } catch (error) {
            console.error("Verification error:", error);
            toast.error(
              error instanceof Error
                ? error.message
                : "Invalid or expired code. Please try again."
            );
            setOtp(""); // Clear the OTP on error
          }
        }
      } catch (error) {
        console.error("Verification error:", error);
        toast.error("Failed to verify code. Please try again.");
        setOtp(""); // Clear the OTP on error
      }
    });
  }

  async function resendCode() {
    if (!email) {
      toast.error("Email address is missing");
      return;
    }

    startResendTransition(async () => {
      try {
        const response = await fetch(
          "/api/auth/email-otp/send-verification-otp",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: email,
              type: isOrganizationSignup ? "sign-up" : "sign-in",
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to resend code");
        }

        toast.success("New verification code sent to your email!");
        setOtp(""); // Clear the current OTP
      } catch (error) {
        console.error("Resend error:", error);
        toast.error("Failed to resend code. Please try again.");
      }
    });
  }

  return (
    <Card className="w-full mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Verify Your Email</CardTitle>
        <CardDescription>
          We've sent a 6-digit verification code to <strong>{email}</strong>
          {isOrganizationSignup && (
            <span className="block mt-2 text-primary font-semibold">
              Organization Account Verification
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <InputOTP
            value={otp}
            onChange={(value) => setOtp(value)}
            maxLength={6}
            className="gap-2"
            disabled={verifyPending}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>

          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from your email
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={verifyOtp}
            disabled={verifyPending || !isOtpCompleted}
            className="w-full"
          >
            {verifyPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              "Verify Email"
            )}
          </Button>

          <Button
            onClick={resendCode}
            disabled={resendPending || verifyPending}
            variant="outline"
            className="w-full"
          >
            {resendPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                <span>Resend Code</span>
              </>
            )}
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>Didn't receive the code?</p>
          <p className="mt-1">Check your spam folder or click resend.</p>
        </div>
      </CardContent>
    </Card>
  );
}
