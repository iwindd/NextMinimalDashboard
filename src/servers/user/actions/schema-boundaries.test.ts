import { describe, expect, it } from "vitest";
import { updateProfilePasswordSchema } from "@/servers/profile/actions/update-profile-password-schema";
import { createUserSchema } from "./create-user-schema";
import { updateUserEmailSchema } from "./update-user-email-schema";
import { updateUserNameSchema } from "./update-user-name-schema";
import { updateUserPasswordSchema } from "./update-user-password-schema";
import { updateUserRoleSchema } from "./update-user-role-schema";
import { setUserStatusSchema } from "./set-user-status-schema";

const validUserId = "11111111-1111-4111-8111-111111111111";

type SchemaResult = {
  success: boolean;
  error?: {
    issues: Array<{ path: PropertyKey[]; message: string }>;
  };
};

type SchemaLike = {
  safeParse: (input: unknown) => SchemaResult;
};

function expectMismatchedPassword(schema: SchemaLike, input: unknown) {
  const result = schema.safeParse(input);

  expect(result.success).toBe(false);
  expect(result.error?.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: ["passwordConfirmation"],
        message: "รหัสผ่านไม่ตรงกัน",
      }),
    ]),
  );
}

describe("server action schema boundaries", () => {
  it.each([
    ["name", updateUserNameSchema, { userId: "not-a-uuid", name: "Name" }],
    [
      "email",
      updateUserEmailSchema,
      { userId: "not-a-uuid", email: "user@example.com" },
    ],
    [
      "password",
      updateUserPasswordSchema,
      {
        userId: "not-a-uuid",
        password: "password-123",
        passwordConfirmation: "password-123",
      },
    ],
    [
      "role",
      updateUserRoleSchema,
      { userId: "not-a-uuid", role: "EDITOR" },
    ],
    [
      "status",
      setUserStatusSchema,
      { userId: "not-a-uuid", isActive: true },
    ],
  ])("rejects an invalid target id for %s", (_name, schema, input) => {
    const result = schema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it("rejects a missing current password for profile changes", () => {
    const result = updateProfilePasswordSchema.safeParse({
      oldPassword: "",
      password: "password-123",
      passwordConfirmation: "password-123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords when creating a user", () => {
    expectMismatchedPassword(createUserSchema, {
      name: "User",
      email: "user@example.com",
      password: "password-123",
      passwordConfirmation: "different",
      role: "EDITOR",
    });
  });

  it("rejects mismatched passwords for an admin reset", () => {
    expectMismatchedPassword(updateUserPasswordSchema, {
      userId: validUserId,
      password: "password-123",
      passwordConfirmation: "different",
    });
  });

  it("rejects mismatched passwords for a profile change", () => {
    expectMismatchedPassword(updateProfilePasswordSchema, {
      oldPassword: "old-password",
      password: "password-123",
      passwordConfirmation: "different",
    });
  });

  it("trims and normalizes fields before an action runs", () => {
    const result = createUserSchema.safeParse({
      name: "  User  ",
      email: "USER@EXAMPLE.COM",
      password: "password-123",
      passwordConfirmation: "password-123",
      role: "EDITOR",
      reason: "  requested by HR  ",
    });

    expect(result).toEqual({
      success: true,
      data: {
        name: "User",
        email: "user@example.com",
        password: "password-123",
        passwordConfirmation: "password-123",
        role: "EDITOR",
        reason: "requested by HR",
      },
    });
  });
});
