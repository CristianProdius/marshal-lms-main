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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  organizationSignupSchema,
  type OrganizationSignupSchemaType,
} from "@/lib/zodSchemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { tryCatch } from "@/hooks/try-catch";
import { createOrganizationWithAdmin } from "../actions";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  SparkleIcon,
  User,
} from "lucide-react";
import slugify from "slugify";
import Link from "next/link";

export function OrganizationSignupForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState("organization");

  const form = useForm<OrganizationSignupSchemaType>({
    resolver: zodResolver(organizationSignupSchema),
    defaultValues: {
      organizationName: "",
      organizationSlug: "",
      organizationDescription: "",
      adminName: "",
      adminEmail: "",
      contactEmail: "",
      contactPhone: "",
      website: "",
      maxSeats: 5,
      acceptTerms: false,
    },
  });

  async function onSubmit(values: OrganizationSignupSchemaType) {
    startTransition(async () => {
      const { data: result, error } = await tryCatch(
        createOrganizationWithAdmin(values)
      );

      if (error) {
        toast.error("An unexpected error occurred. Please try again.");
        return;
      }

      if (result.status === "success") {
        toast.success(result.message);
        // Redirect to verify email page with org flag
        router.push(
          `/verify-request?email=${encodeURIComponent(
            values.adminEmail
          )}&org=true`
        );
      } else if (result.status === "error") {
        toast.error(result.message);
      }
    });
  }

  const validateOrganizationStep = async () => {
    const fields: (keyof OrganizationSignupSchemaType)[] = [
      "organizationName",
      "organizationSlug",
      "maxSeats",
    ];
    const isValid = await form.trigger(fields);
    if (isValid) {
      setCurrentStep("admin");
    }
  };

  const goBackToOrganization = () => {
    setCurrentStep("organization");
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Create Your Organization</CardTitle>
        <CardDescription>
          Set up your organization and create your admin account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={currentStep} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  value="organization"
                  className="flex items-center gap-2"
                >
                  <Building2 className="size-4" />
                  Organization
                </TabsTrigger>
                <TabsTrigger
                  value="admin"
                  disabled={currentStep === "organization"}
                  className="flex items-center gap-2"
                >
                  <User className="size-4" />
                  Admin Account
                </TabsTrigger>
              </TabsList>

              <TabsContent value="organization" className="space-y-4 mt-6">
                <FormField
                  control={form.control}
                  name="organizationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Acme Corporation"
                          {...field}
                          disabled={pending}
                        />
                      </FormControl>
                      <FormDescription>
                        Your company or organization's official name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 items-end">
                  <FormField
                    control={form.control}
                    name="organizationSlug"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Organization Slug *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="acme-corp"
                            {...field}
                            disabled={pending}
                          />
                        </FormControl>
                        <FormDescription>
                          Unique identifier for your organization URL
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const name = form.getValues("organizationName");
                      if (name) {
                        const slug = slugify(name, { lower: true });
                        form.setValue("organizationSlug", slug, {
                          shouldValidate: true,
                        });
                      }
                    }}
                    disabled={pending}
                  >
                    Generate <SparkleIcon className="ml-1 size-4" />
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="organizationDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of your organization..."
                          className="min-h-[80px]"
                          {...field}
                          disabled={pending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="contact@acme.com"
                            {...field}
                            disabled={pending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="+1234567890"
                            {...field}
                            disabled={pending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder="https://acme.com"
                            {...field}
                            disabled={pending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxSeats"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Seats *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="1000"
                            {...field}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                            disabled={pending}
                          />
                        </FormControl>
                        <FormDescription>
                          How many users will need access?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-between">
                  <Link href="/login">
                    <Button type="button" variant="ghost" disabled={pending}>
                      <ChevronLeft className="mr-2 size-4" />
                      Back to Login
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    onClick={validateOrganizationStep}
                    disabled={pending}
                  >
                    Next Step
                    <ChevronRight className="ml-2 size-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="admin" className="space-y-4 mt-6">
                <FormField
                  control={form.control}
                  name="adminName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
                          {...field}
                          disabled={pending}
                        />
                      </FormControl>
                      <FormDescription>
                        Full name of the organization administrator
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="adminEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Email *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="admin@acme.com"
                          {...field}
                          disabled={pending}
                        />
                      </FormControl>
                      <FormDescription>
                        We'll send a verification code to this email
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={pending}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          I accept the terms and conditions *
                        </FormLabel>
                        <FormDescription>
                          By checking this box, you agree to our{" "}
                          <Link
                            href="/terms"
                            className="underline hover:text-primary"
                            target="_blank"
                          >
                            Terms of Service
                          </Link>{" "}
                          and{" "}
                          <Link
                            href="/privacy"
                            className="underline hover:text-primary"
                            target="_blank"
                          >
                            Privacy Policy
                          </Link>
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={goBackToOrganization}
                    disabled={pending}
                  >
                    <ChevronLeft className="mr-2 size-4" />
                    Previous
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Creating Organization...
                      </>
                    ) : (
                      <>
                        Create Organization
                        <ChevronRight className="ml-2 size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </Form>

        {currentStep === "admin" && (
          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Already have an organization?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in instead
              </Link>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
