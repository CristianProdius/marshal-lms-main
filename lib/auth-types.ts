export type UserRole = "admin" | "user";
export type OrganizationRole = "OWNER" | "ADMIN" | "MEMBER";
export type CombinedRole =
  | "org_owner"
  | "org_admin"
  | "org_member"
  | "individual"
  | "admin";

export interface OrganizationContext {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
  maxSeats: number;
  usedSeats: number;
  status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  trialEndsAt?: Date | null;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  role: UserRole | null;
  combinedRole: CombinedRole;
  organizationId?: string | null;
  organization?: OrganizationContext | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtendedSession {
  user: SessionUser;
  session: {
    id: string;
    expiresAt: Date;
    token: string;
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
    userId: string;
  };
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  description?: string;
  contactEmail?: string;
  maxSeats?: number;
  allowSelfSignup?: boolean;
  domains?: string[];
}

export interface InviteOrganizationMemberInput {
  email: string;
  role: OrganizationRole;
  message?: string;
  courseIds?: string[];
}

export interface AcceptInvitationInput {
  token: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
  contactEmail?: string;
  maxSeats?: number;
  allowSelfSignup?: boolean;
  domains?: string[];
  requireAdminApproval?: boolean;
}

export interface OrganizationMember {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  organizationRole: OrganizationRole;
  joinedOrganizationAt: Date;
}
