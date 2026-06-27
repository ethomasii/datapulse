import { describe, expect, it, afterEach } from "vitest";
import { isSuperAdminClerkId } from "@/lib/auth/super-admin";

describe("isSuperAdminClerkId", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevAdmin = process.env.ADMIN_CLERK_USER_ID;

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
    if (prevAdmin === undefined) delete process.env.ADMIN_CLERK_USER_ID;
    else process.env.ADMIN_CLERK_USER_ID = prevAdmin;
  });

  it("allows any user in development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ADMIN_CLERK_USER_ID;
    expect(isSuperAdminClerkId("user_any")).toBe(true);
  });

  it("matches ADMIN_CLERK_USER_ID in production", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_CLERK_USER_ID = "user_admin";
    expect(isSuperAdminClerkId("user_admin")).toBe(true);
    expect(isSuperAdminClerkId("user_other")).toBe(false);
  });
});
