import { clerkClient } from "@clerk/express";
import { Router, type IRouter } from "express";
import {
  GetAdminAnalyticsResponse,
  GetAdminCatalogHealthResponse,
  GetAdminSessionResponse,
  ListAdminStaffResponse,
  ListAdminPoliciesResponse,
  SaveAdminPolicyBody,
  SaveAdminPolicyParams,
  SaveAdminPolicyResponse,
  UpdateAdminStaffAccessBody,
  UpdateAdminStaffAccessParams,
  UpdateAdminStaffAccessResponse,
} from "@workspace/api-zod";
import { getShopifyCatalogHealth } from "../lib/shopify";
import {
  getAnalyticsSummary,
  listPolicies,
  recordCatalogSync,
  recordStaffAccessChange,
  savePolicy,
} from "../lib/admin-repository";
import {
  requireOwner,
  requireStaff,
  type AuthenticatedRequest,
  type DashboardRole,
} from "../middlewares/auth";

const router: IRouter = Router();
router.use("/admin", requireStaff);

router.get("/admin/session", (req, res): void => {
  const role = (req as AuthenticatedRequest).dashboardRole;
  res.json(GetAdminSessionResponse.parse({
    authorized: true,
    role,
    canManageStaff: role === "owner",
  }));
});

function roleFromMetadata(user: {
  publicMetadata: Record<string, unknown>;
  privateMetadata: Record<string, unknown>;
}): DashboardRole | null {
  const roles = [user.privateMetadata.role, user.publicMetadata.role];
  if (roles.includes("owner")) return "owner";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("staff")) return "staff";
  return null;
}

function mapStaffMember(user: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string }>;
  publicMetadata: Record<string, unknown>;
  privateMetadata: Record<string, unknown>;
}) {
  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  ) ?? user.emailAddresses[0];
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return {
    userId: user.id,
    email: primaryEmail?.emailAddress ?? `${user.id}@unknown.invalid`,
    displayName: fullName || user.username || null,
    role: roleFromMetadata(user),
  };
}

router.get("/admin/staff", requireOwner, async (_req, res): Promise<void> => {
  const users = await clerkClient.users.getUserList({ limit: 100 });
  res.json(ListAdminStaffResponse.parse(users.data.map(mapStaffMember)));
});

router.patch("/admin/staff/:userId", requireOwner, async (req, res): Promise<void> => {
  const params = UpdateAdminStaffAccessParams.safeParse(req.params);
  const input = UpdateAdminStaffAccessBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({
      error: params.error.message,
      code: "INVALID_REQUEST",
    });
    return;
  }
  if (!input.success) {
    res.status(400).json({
      error: input.error.message,
      code: "INVALID_REQUEST",
    });
    return;
  }

  const actorUserId = (req as AuthenticatedRequest).authUserId;
  if (params.data.userId === actorUserId) {
    res.status(403).json({ error: "Owners cannot change their own access", code: "FORBIDDEN" });
    return;
  }

  let target;
  try {
    target = await clerkClient.users.getUser(params.data.userId);
  } catch {
    res.status(404).json({ error: "User not found", code: "NOT_FOUND" });
    return;
  }
  const previousRole = roleFromMetadata(target);
  if (previousRole === "owner") {
    res.status(403).json({ error: "Owner access cannot be changed here", code: "FORBIDDEN" });
    return;
  }
  const previousManagedRole = previousRole === "admin" || previousRole === "staff"
    ? previousRole
    : null;
  if (previousManagedRole === input.data.role) {
    res.json(UpdateAdminStaffAccessResponse.parse(mapStaffMember(target)));
    return;
  }

  const previousPublicMetadata = target.publicMetadata;
  const previousPrivateMetadata = target.privateMetadata;
  const nextPublicMetadata = { ...previousPublicMetadata };
  const nextPrivateMetadata = { ...previousPrivateMetadata };
  if (input.data.role) nextPublicMetadata.role = input.data.role;
  else delete nextPublicMetadata.role;
  if (input.data.role) nextPrivateMetadata.role = input.data.role;
  else delete nextPrivateMetadata.role;

  const updated = await clerkClient.users.updateUserMetadata(target.id, {
    publicMetadata: nextPublicMetadata,
    privateMetadata: nextPrivateMetadata,
  });
  if (roleFromMetadata(updated) !== input.data.role) {
    await clerkClient.users.updateUserMetadata(target.id, {
      publicMetadata: previousPublicMetadata,
      privateMetadata: previousPrivateMetadata,
    });
    throw new Error("Clerk did not persist the requested staff access role");
  }
  try {
    await recordStaffAccessChange({
      actorUserId,
      targetUserId: target.id,
      previousRole: previousManagedRole,
      newRole: input.data.role,
      changedAt: new Date().toISOString(),
    });
  } catch (error) {
    try {
      await clerkClient.users.updateUserMetadata(target.id, {
        publicMetadata: previousPublicMetadata,
        privateMetadata: previousPrivateMetadata,
      });
    } catch (rollbackError) {
      req.log.error(
        { err: rollbackError, targetUserId: target.id },
        "Staff access audit failed and Clerk metadata rollback also failed",
      );
    }
    throw error;
  }
  req.log.info(
    { actorUserId, targetUserId: target.id, previousRole: previousManagedRole, newRole: input.data.role },
    "Staff access changed",
  );
  res.json(UpdateAdminStaffAccessResponse.parse(mapStaffMember(updated)));
});

router.get("/admin/catalog-health", async (req, res): Promise<void> => {
  try {
    const health = await getShopifyCatalogHealth();
    let lastSyncedAt: string | null = null;
    let persistenceStatus: "persisted" | "unavailable" = "persisted";
    try {
      const sync = await recordCatalogSync(health.checkedAt, {
        totalProducts: health.totalProducts,
        issueCount: health.issues.length,
        mode: "pull",
      });
      lastSyncedAt = sync?.last_synced_at ?? health.checkedAt;
    } catch (error) {
      persistenceStatus = "unavailable";
      req.log.error({ err: error }, "Catalog health pulled but sync state persistence failed");
    }
    res.json(GetAdminCatalogHealthResponse.parse({
      ...health,
      sync: {
        mode: "pull",
        persistenceStatus,
        lastSyncedAt,
      },
    }));
  } catch (error) {
    req.log.error({ err: error }, "Admin catalog health pull failed");
    res.status(503).json({
      error: "Live Shopify catalog health is unavailable",
      code: "SHOPIFY_UNAVAILABLE",
    });
  }
});

router.get("/admin/policies", async (_req, res): Promise<void> => {
  res.json(ListAdminPoliciesResponse.parse(await listPolicies()));
});

router.put("/admin/policies/:slug", async (req, res): Promise<void> => {
  const params = SaveAdminPolicyParams.safeParse(req.params);
  const input = SaveAdminPolicyBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({
      error: params.error.message,
      code: "INVALID_REQUEST",
    });
    return;
  }
  if (!input.success) {
    res.status(400).json({
      error: input.error.message,
      code: "INVALID_REQUEST",
    });
    return;
  }
  res.json(SaveAdminPolicyResponse.parse(await savePolicy({
    slug: params.data.slug,
    ...input.data,
  })));
});

router.get("/admin/analytics", async (_req, res): Promise<void> => {
  res.json(GetAdminAnalyticsResponse.parse(await getAnalyticsSummary()));
});

export default router;