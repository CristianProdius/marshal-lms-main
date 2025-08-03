import { z } from "zod";

export const courseLevels = ["Beginner", "Intermediate", "Advanced"] as const;

export const courseStatus = ["Draft", "Published", "Archived"] as const;

export const courseCategories = [
  "Development",
  "Business",
  "Finance",
  "IT & Software",
  "Office Productivity",
  "Personal Development",
  "Design",
  "Marketing",
  "Health & Fitness",
  "Music",
  "Teaching & Academics",
] as const;

export const courseSchema = z.object({
  title: z
    .string()
    .min(3, { message: "Title must be at least 3 characters long" })
    .max(100, { message: "Title must be at most 100 characters long" }),
  description: z
    .string()
    .min(3, { message: "Description must be at least 3 characters long" }),

  fileKey: z.string().min(1, { message: "File is required" }),

  price: z.coerce
    .number()
    .min(1, { message: "Price must be a positive number" }),

  duration: z.coerce
    .number()
    .min(1, { message: "Duration must be at least 1 hour" })
    .max(500, { message: "Duration must be at most 500 hours" }),

  level: z.enum(courseLevels, {
    message: "Level is required",
  }),
  category: z.enum(courseCategories, {
    message: "Category is required",
  }),
  smallDescription: z
    .string()
    .min(3, { message: "Small Description must be at least 3 characters long" })
    .max(200, {
      message: "Small Description must be at most 200 characters long",
    }),

  slug: z
    .string()
    .min(3, { message: "Slug must be at least 3 characters long" }),

  status: z.enum(courseStatus, {
    message: "Status is required",
  }),
});

export const chapterSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Name must be at least 3 characters long" }),
  courseId: z.string().uuid({ message: "Invalid course id" }),
});

export const lessonSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Name must be at least 3 characters long" }),
  chapterId: z.string().uuid({ message: "Invalid chapter ID" }),
  courseId: z.string().uuid({ message: "Invalid course ID" }),
  description: z
    .string()
    .min(3, { message: "Description must be at least 3 characters long" })
    .optional(),

  videoKey: z.string().optional(),
  thumbnailKey: z.string().optional(),
});

// Organization Signup Schemas
export const organizationSignupSchema = z.object({
  // Organization Details
  organizationName: z
    .string()
    .min(2, { message: "Organization name must be at least 2 characters" })
    .max(100, { message: "Organization name must be at most 100 characters" }),

  organizationSlug: z
    .string()
    .min(2, { message: "Slug must be at least 2 characters" })
    .max(50, { message: "Slug must be at most 50 characters" })
    .regex(/^[a-z0-9-]+$/, {
      message: "Slug can only contain lowercase letters, numbers, and hyphens",
    }),

  organizationDescription: z
    .string()
    .max(500, { message: "Description must be at most 500 characters" })
    .optional(),

  // Admin Account Details
  adminName: z
    .string()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name must be at most 100 characters" }),

  adminEmail: z
    .string()
    .email({ message: "Please enter a valid email address" }),

  // Organization Settings
  contactEmail: z
    .string()
    .email({ message: "Please enter a valid contact email" })
    .optional(),

  contactPhone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, {
      message: "Please enter a valid phone number",
    })
    .optional()
    .or(z.literal("")),

  website: z
    .string()
    .url({ message: "Please enter a valid URL" })
    .optional()
    .or(z.literal("")),

  // Make maxSeats required with coerce for number conversion
  maxSeats: z.coerce
    .number()
    .min(1, { message: "Must have at least 1 seat" })
    .max(1000, { message: "Maximum 1000 seats allowed" }),

  // Terms acceptance
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms and conditions",
  }),
});

export type OrganizationSignupSchemaType = z.infer<
  typeof organizationSignupSchema
>;
export type CourseSchemaType = z.infer<typeof courseSchema>;
export type ChapterSchemaType = z.infer<typeof chapterSchema>;
export type LessonSchemaType = z.infer<typeof lessonSchema>;
