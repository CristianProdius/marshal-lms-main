"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

import { Building2, GithubIcon, Loader, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [githubPending, startGithubTransition] = useTransition();
  const [emailPending, startEmailTransition] = useTransition();
  const [email, setEmail] = useState("");

  // Check if user came from email verification
  useEffect(() => {
    const urlEmail = searchParams.get("email");
    const isVerified = searchParams.get("verified") === "true";

    if (urlEmail) {
      setEmail(urlEmail);
    }

    if (isVerified && urlEmail) {
      toast.success("Email verified! Please sign in to continue.");
    }
  }, [searchParams]);

  async function signInWithGithub() {
    startGithubTransition(async () => {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/",
        fetchOptions: {
          onSuccess: () => {
            toast.success("Signed in with Github, you will be redirected...");
          },
          onError: () => {
            toast.error("Internal Server Error");
          },
        },
      });
    });
  }

  async function signInWithEmail() {
    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    startEmailTransition(async () => {
      try {
        // Use the correct method from better-auth client
        const response = await fetch(
          "/api/auth/email-otp/send-verification-otp",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: email,
              type: "sign-in",
            }),
          }
        );

        if (!response.ok) {
          const error = await response
            .json()
            .catch(() => ({ message: "Failed to send email" }));
          throw new Error(error.message || "Failed to send verification email");
        }

        const data = await response.json();

        if (data.success !== false) {
          toast.success("Verification code sent to your email!");
          router.push(`/verify-request?email=${encodeURIComponent(email)}`);
        } else {
          throw new Error(data.message || "Failed to send verification email");
        }
      } catch (error) {
        console.error("Error sending verification email:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to send verification email"
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Welcome Back!</CardTitle>
        <CardDescription>
          Login with your Github or Email Account
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Button
          disabled={githubPending}
          onClick={signInWithGithub}
          className="w-full"
          variant="outline"
        >
          {githubPending ? (
            <>
              <Loader className="size-4 animate-spin" />
              <span>Loading...</span>
            </>
          ) : (
            <>
              <GithubIcon className="size-4" />
              Sign in with GitHub
            </>
          )}
        </Button>

        <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
          <span className="relative z-10 bg-card px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="m@example.com"
              required
              disabled={emailPending}
            />
          </div>

          <Button
            onClick={signInWithEmail}
            disabled={emailPending || !email}
            type="button"
          >
            {emailPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="size-4" />
                <span>Continue with Email</span>
              </>
            )}
          </Button>
        </div>

        <div className="relative text-center text-sm mt-6 pt-6 border-t">
          <span className="bg-card px-2 text-muted-foreground">
            Looking for team access?
          </span>
        </div>

        <div className="text-center">
          <Link
            href="/org-signup"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <Building2 className="size-3" />
            Create an organization account
          </Link>
          <p className="text-xs text-muted-foreground mt-1">
            Perfect for teams and businesses
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
