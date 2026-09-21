import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  userId: null as string | null,
  role: null as string | null,
  getUser: vi.fn(),
  getUserList: vi.fn(),
  updateUserMetadata: vi.fn(),
}));
const adminData = vi.hoisted(() => ({
  listPolicies: vi.fn(),
  savePolicy: vi.fn(),
  recordCatalogSync: vi.fn(),
  getAnalyticsSummary: vi.fn(),
  recordStaffAccessChange: vi.fn(),
}));
const catalogHealth = vi.hoisted(() => vi.fn());

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => ({ userId: auth.userId, sessionClaims: {} }),
  clerkClient: {
    users: {
      getUser: auth.getUser,
      getUserList: auth.getUserList,
      updateUserMetadata: auth.updateUserMetadata,
    },
  },
}));
vi.mock("../lib/admin-repository", () => adminData);
vi.mock("../lib/commerce-repository", () => ({
  getCatalogHealth: catalogHealth,
}));

import app from "../app";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server did not bind");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  auth.userId = null;
  auth.role = null;
  auth.getUser.mockImplementation(async () => ({
    id: auth.userId,
    firstName: null,
    lastName: null,
    username: null,
    primaryEmailAddressId: null,
    emailAddresses: [],
    publicMetadata: { role: auth.role },
    privateMetadata: {},
  }));
  auth.getUserList.mockResolvedValue({ data: [] });
  auth.updateUserMetadata.mockImplementation(async (userId, metadata) => ({
    id: userId,
    firstName: null,
    lastName: null,
    username: null,
    primaryEmailAddressId: "email_1",
    emailAddresses: [{ id: "email_1", emailAddress: "staff@example.com" }],
    publicMetadata: metadata.publicMetadata,
    privateMetadata: metadata.privateMetadata,
  }));
  adminData.recordStaffAccessChange.mockResolvedValue(undefined);
});

describe("staff admin API", () => {
  it("rejects signed-out customers", async () => {
    const response = await fetch(`${baseUrl}/api/admin/analytics`);
    expect(response.status).toBe(401);
  });

  it("rejects authenticated customers without a staff role", async () => {
    auth.userId = "customer_123";
    const response = await fetch(`${baseUrl}/api/admin/analytics`);
    expect(response.status).toBe(403);
    expect(adminData.getAnalyticsSummary).not.toHaveBeenCalled();
  });

  it("returns only stored event summaries to staff", async () => {
    auth.userId = "staff_123";
    auth.role = "staff";
    adminData.getAnalyticsSummary.mockResolvedValue({
      recordedEvents: 2,
      firstRecordedAt: "2026-09-09T10:00:00.000Z",
      lastRecordedAt: "2026-09-09T11:00:00.000Z",
      events: [{ eventName: "product_viewed", count: 2 }],
      unavailableMetrics: [],
      storeMetrics: {
        totalOrders: 1,
        paidOrders: 1,
        paidRevenue: 2500,
        uniqueCustomers: 1,
        currency: "PKR",
      },
    });

    const response = await fetch(`${baseUrl}/api/admin/analytics`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      recordedEvents: 2,
      events: [{ eventName: "product_viewed", count: 2 }],
    });
  });

  it("confirms an authorized admin session and its management capability", async () => {
    auth.userId = "admin_123";
    auth.role = "admin";

    const response = await fetch(`${baseUrl}/api/admin/session`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authorized: true,
      role: "admin",
      canManageStaff: false,
    });
  });

  it("does not let staff or admins manage access", async () => {
    auth.userId = "admin_123";
    auth.role = "admin";

    const response = await fetch(`${baseUrl}/api/admin/staff`);
    expect(response.status).toBe(403);
    expect(auth.getUserList).not.toHaveBeenCalled();
  });

  it("does not let an owner change their own access", async () => {
    auth.userId = "owner_123";
    auth.role = "owner";

    const response = await fetch(`${baseUrl}/api/admin/staff/owner_123`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "staff" }),
    });

    expect(response.status).toBe(403);
    expect(auth.updateUserMetadata).not.toHaveBeenCalled();
    expect(adminData.recordStaffAccessChange).not.toHaveBeenCalled();
  });

  it("grants staff access and records the owner and time", async () => {
    auth.userId = "owner_123";
    auth.role = "owner";
    auth.getUser.mockImplementation(async (userId) => userId === "owner_123"
      ? {
          id: userId,
          firstName: "Store",
          lastName: "Owner",
          username: null,
          primaryEmailAddressId: "owner_email",
          emailAddresses: [{ id: "owner_email", emailAddress: "owner@example.com" }],
          publicMetadata: { role: "owner" },
          privateMetadata: {},
        }
      : {
          id: userId,
          firstName: "New",
          lastName: "Staff",
          username: null,
          primaryEmailAddressId: "staff_email",
          emailAddresses: [{ id: "staff_email", emailAddress: "staff@example.com" }],
          publicMetadata: {},
          privateMetadata: {},
        });

    const response = await fetch(`${baseUrl}/api/admin/staff/staff_123`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "staff" }),
    });

    expect(response.status).toBe(200);
    expect(auth.updateUserMetadata).toHaveBeenCalledWith("staff_123", {
      publicMetadata: { role: "staff" },
      privateMetadata: { role: "staff" },
    });
    expect(adminData.recordStaffAccessChange).toHaveBeenCalledWith({
      actorUserId: "owner_123",
      targetUserId: "staff_123",
      previousRole: null,
      newRole: "staff",
      changedAt: expect.any(String),
    });
  });

  it("revokes staff access by removing only the role metadata", async () => {
    auth.userId = "owner_123";
    auth.role = "owner";
    auth.getUser.mockImplementation(async (userId) => ({
      id: userId,
      firstName: null,
      lastName: null,
      username: null,
      primaryEmailAddressId: "staff_email",
      emailAddresses: [{ id: "staff_email", emailAddress: "staff@example.com" }],
      publicMetadata: userId === "owner_123"
        ? { role: "owner" }
        : { role: "staff", department: "fulfillment" },
      privateMetadata: {},
    }));

    const response = await fetch(`${baseUrl}/api/admin/staff/staff_123`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: null }),
    });

    expect(response.status).toBe(200);
    expect(auth.updateUserMetadata).toHaveBeenCalledWith("staff_123", {
      publicMetadata: { department: "fulfillment" },
      privateMetadata: {},
    });
  });

  it("revokes a legacy role stored only in private metadata", async () => {
    auth.userId = "owner_123";
    auth.role = "owner";
    auth.getUser.mockImplementation(async (userId) => ({
      id: userId,
      firstName: null,
      lastName: null,
      username: null,
      primaryEmailAddressId: "staff_email",
      emailAddresses: [{ id: "staff_email", emailAddress: "staff@example.com" }],
      publicMetadata: userId === "owner_123" ? { role: "owner" } : { department: "stock" },
      privateMetadata: userId === "owner_123" ? {} : { role: "staff", region: "north" },
    }));

    const response = await fetch(`${baseUrl}/api/admin/staff/legacy_staff`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: null }),
    });

    expect(response.status).toBe(200);
    expect(auth.updateUserMetadata).toHaveBeenCalledWith("legacy_staff", {
      publicMetadata: { department: "stock" },
      privateMetadata: { region: "north" },
    });
    expect(adminData.recordStaffAccessChange).toHaveBeenCalledWith(
      expect.objectContaining({ previousRole: "staff", newRole: null }),
    );
  });

  it("protects owners when metadata stores conflict", async () => {
    auth.userId = "owner_123";
    auth.role = "owner";
    auth.getUser.mockImplementation(async (userId) => ({
      id: userId,
      firstName: null,
      lastName: null,
      username: null,
      primaryEmailAddressId: "email_1",
      emailAddresses: [{ id: "email_1", emailAddress: "owner@example.com" }],
      publicMetadata: { role: userId === "owner_123" ? "owner" : "staff" },
      privateMetadata: { role: userId === "owner_123" ? "owner" : "owner" },
    }));

    const response = await fetch(`${baseUrl}/api/admin/staff/other_owner`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: null }),
    });

    expect(response.status).toBe(403);
    expect(auth.updateUserMetadata).not.toHaveBeenCalled();
  });

  it("restores Clerk metadata when the audit record cannot be saved", async () => {
    auth.userId = "owner_123";
    auth.role = "owner";
    auth.getUser.mockImplementation(async (userId) => ({
      id: userId,
      firstName: null,
      lastName: null,
      username: null,
      primaryEmailAddressId: "staff_email",
      emailAddresses: [{ id: "staff_email", emailAddress: "staff@example.com" }],
      publicMetadata: userId === "owner_123" ? { role: "owner" } : { role: "staff" },
      privateMetadata: {},
    }));
    adminData.recordStaffAccessChange.mockRejectedValue(new Error("audit unavailable"));

    const response = await fetch(`${baseUrl}/api/admin/staff/staff_123`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });

    expect(response.status).toBe(500);
    expect(auth.updateUserMetadata).toHaveBeenNthCalledWith(2, "staff_123", {
      publicMetadata: { role: "staff" },
      privateMetadata: {},
    });
  });
});