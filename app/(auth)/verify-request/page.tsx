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
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { toast } from "sonner";

export default function VerifyRequestRoute() {
  return (
    <Suspense>
      <VerifyRequest />
    </Suspense>
  );
}

function VerifyRequest() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [emailPending, startTransition] = useTransition();
  const params = useSearchParams();
  const email = params.get("email") as string;
  const isOrganizationSignup = params.get("org") === "true";
  const isOtpCompleted = otp.length === 6;

  async function verifyOtp() {
    startTransition(async () => {
      try {
        const orgParam = params.get("org");
        const isOrgSignup = orgParam === "true";

        if (isOrgSignup) {
          console.log("Attempting organization verification for:", email);

          const response = await fetch("/api/auth/verify-organization-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              email: email,
              code: otp,
            }),
          });

          let data;
          try {
            data = await response.json();
          } catch (jsonError) {
            console.error("Failed to parse JSON:", jsonError);
            toast.error("Invalid server response. Please try again.");
            return;
          }

          if (!response.ok) {
            toast.error(data.error || "Error verifying email");
            return;
          }

          if (data.success) {
            toast.success("Email verified successfully! You can now sign in.");

            // Redirect to the specified destination (should be login with email pre-filled)
            const redirectTo = data.redirectTo || "/login";
            console.log("Redirecting to:", redirectTo);
            setTimeout(() => {
              window.location.href = redirectTo;
            }, 1500);
          } else {
            toast.error("Verification failed. Please try again.");
          }
        } else {
          // Regular email OTP flow...
          const result = await authClient.signIn.emailOtp({
            email: email,
            otp: otp,
          });

          if (result.error) {
            toast.error(result.error.message || "Error verifying Email/OTP");
            return;
          }

          toast.success("Email verified");
          router.push("/");
        }
      } catch (error) {
        console.error("Verification error:", error);
        toast.error("Failed to verify email. Please try again.");
      }
    });
  }
  return (
    <Card className="w-full mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Please check your email</CardTitle>
        <CardDescription>
          We have sent a verification code to <strong>{email}</strong>. Please
          open the email and paste the code below.
          {isOrganizationSignup && (
            <span className="block mt-2 text-primary font-semibold">
              Organization Account Verification
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <InputOTP
            value={otp}
            onChange={(value) => setOtp(value)}
            maxLength={6}
            className="gap-2"
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
            Enter the 6-digit code sent to your email
          </p>
        </div>

        <Button
          onClick={verifyOtp}
          disabled={emailPending || !isOtpCompleted}
          className="w-full"
        >
          {emailPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            "Verify Account"
          )}
        </Button>

        <div className="text-center text-sm text-muted-foreground">
          <p>Didn't receive the code?</p>
          <p className="mt-1">Check your spam folder or wait a few moments.</p>
        </div>
      </CardContent>
    </Card>
  );
}
