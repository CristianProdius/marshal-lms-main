import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { adminClient } from "better-auth/client/plugins";
import type {
  OrganizationContext,
  SessionUser,
  CreateOrganizationInput,
  InviteOrganizationMemberInput,
  AcceptInvitationInput,
  UpdateOrganizationInput,
  OrganizationMember,
} from "./auth-types";

// Create the auth client with plugins
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), adminClient()],
});

// Organization API wrapper functions
export const organizationApi = {
  createOrganization: async (data: CreateOrganizationInput) => {
    const response = await fetch("/api/auth/organization/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create organization");
    }
    return response.json();
  },

  inviteMember: async (data: InviteOrganizationMemberInput) => {
    const response = await fetch("/api/auth/organization/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to invite member");
    }
    return response.json();
  },

  acceptInvitation: async (data: AcceptInvitationInput) => {
    const response = await fetch("/api/auth/organization/accept-invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to accept invitation");
    }
    return response.json();
  },

  leaveOrganization: async () => {
    const response = await fetch("/api/auth/organization/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to leave organization");
    }
    return response.json();
  },

  getOrganization: async () => {
    const response = await fetch("/api/auth/organization", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get organization");
    }
    return response.json();
  },

  updateOrganization: async (data: UpdateOrganizationInput) => {
    const response = await fetch("/api/auth/organization/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update organization");
    }
    return response.json();
  },

  removeMember: async (memberId: string) => {
    const response = await fetch("/api/auth/organization/remove-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ memberId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to remove member");
    }
    return response.json();
  },

  getMembers: async (): Promise<{ members: OrganizationMember[] }> => {
    const response = await fetch("/api/auth/organization/members", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get members");
    }
    return response.json();
  },

  getPendingInvitations: async () => {
    const response = await fetch("/api/auth/organization/invitations", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get invitations");
    }
    return response.json();
  },

  cancelInvitation: async (invitationId: string) => {
    const response = await fetch("/api/auth/organization/invitation/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ invitationId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to cancel invitation");
    }
    return response.json();
  },
};

// Export typed hooks
export const useSession = () => {
  const session = authClient.useSession();
  return {
    ...session,
    data: session.data as { user: SessionUser; session: any } | null,
  };
};

export const useOrganization = () => {
  const session = useSession();
  return {
    organization: session.data?.user?.organization || null,
    isOrgMember: !!session.data?.user?.organizationId,
    isOrgOwner: session.data?.user?.organization?.role === "OWNER",
    isOrgAdmin:
      session.data?.user?.organization?.role === "ADMIN" ||
      session.data?.user?.organization?.role === "OWNER",
  };
};

// Organization management hooks
export const useCreateOrganization = () => {
  return async (data: CreateOrganizationInput) => {
    return organizationApi.createOrganization(data);
  };
};

export const useInviteMember = () => {
  return async (data: InviteOrganizationMemberInput) => {
    return organizationApi.inviteMember(data);
  };
};

export const useAcceptInvitation = () => {
  return async (token: string) => {
    return organizationApi.acceptInvitation({ token });
  };
};

export const useLeaveOrganization = () => {
  return async () => {
    return organizationApi.leaveOrganization();
  };
};

export const useOrganizationMembers = () => {
  return async () => {
    return organizationApi.getMembers();
  };
};
