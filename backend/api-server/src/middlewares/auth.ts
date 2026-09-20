import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export type DashboardRole = "owner" | "admin" | "staff";
export type AuthenticatedRequest = Request & {
  authUserId: string;
  dashboardRole?: DashboardRole;
};

function dashboardRole(user: {
  publicMetadata: Record<string, unknown>;
  privateMetadata: Record<string, unknown>;
}): DashboardRole | null {
  const roles = [user.privateMetadata.role, user.publicMetadata.role];
  if (roles.includes("owner")) return "owner";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("staff")) return "staff";
  return null;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const auth = getAuth(req);
  const claimUserId =
    typeof auth.sessionClaims?.userId === "string"
      ? auth.sessionClaims.userId
      : undefined;
  const userId = claimUserId ?? auth.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
    return;
  }
  (req as AuthenticatedRequest).authUserId = userId;
  next();
}

export async function requireStaff(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const claimUserId =
    typeof auth.sessionClaims?.userId === "string"
      ? auth.sessionClaims.userId
      : undefined;
  const userId = claimUserId ?? auth.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
    return;
  }

  const user = await clerkClient.users.getUser(userId);
  const role = dashboardRole(user);
  if (!role) {
    res.status(403).json({ error: "Staff access required", code: "FORBIDDEN" });
    return;
  }

  (req as AuthenticatedRequest).authUserId = userId;
  (req as AuthenticatedRequest).dashboardRole = role;
  next();
}

export async function requireOwner(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireStaff(req, res, () => {
    if ((req as AuthenticatedRequest).dashboardRole !== "owner") {
      res.status(403).json({ error: "Owner access required", code: "FORBIDDEN" });
      return;
    }
    next();
  });
}