import { describe, expect, it } from "vitest";
import { canRenderAdminWorkspace } from "./admin-access";

describe("admin workspace authorization lifecycle", () => {
  it("keeps an authorized editor mounted during background session revalidation", () => {
    const backgroundRefresh = {
      isSignedIn: true,
      isSuccess: true,
      isError: false,
      authorized: true,
      isFetching: true,
    };

    expect(canRenderAdminWorkspace(backgroundRefresh)).toBe(true);
  });

  it("hides the workspace when access is revoked or the identity changes", () => {
    expect(canRenderAdminWorkspace({
      isSignedIn: true,
      isSuccess: false,
      isError: true,
      authorized: true,
    })).toBe(false);
    expect(canRenderAdminWorkspace({
      isSignedIn: true,
      isSuccess: false,
      isError: false,
      authorized: undefined,
    })).toBe(false);
  });
});