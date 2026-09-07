import { describe, expect, it } from "vitest";
import {
  getRevisionActionPresentation,
  getRevisionUiActionKeys,
  getRevisionUiPolicy,
} from "./ui-policy";

describe("revision flow UI action contract", () => {
  it.each([
    ["save", "บันทึก", "outline", "brand"],
    ["saveAndPublish", "บันทึกและเผยแพร่", "filled", "success"],
    ["submit", "ส่งตรวจสอบ", "filled", "brand"],
    ["resubmit", "ส่งตรวจสอบอีกครั้ง", "filled", "brand"],
    ["cancelReview", "ยกเลิกการส่งตรวจสอบ", "outline", "gray"],
    ["cancelRepublish", "ยกเลิกส่งคำขอเผยแพร่อีกครั้ง", "outline", "gray"],
    ["requestRepublish", "ส่งคำขอเผยแพร่อีกครั้ง", "filled", "orange"],
    ["publish", "เผยแพร่ข่าว", "filled", "success"],
    ["republish", "เผยแพร่อีกครั้ง", "filled", "success"],
    ["sendBack", "ส่งกลับให้แก้ไข", "outline", "orange"],
    ["approve", "อนุมัติและเผยแพร่", "filled", "success"],
    ["approveRepublish", "อนุมัติและเผยแพร่อีกครั้ง", "filled", "success"],
    ["archive", "จัดเก็บข่าว", "outline", "orange"],
  ] as const)("uses the expected presentation for %s", (key, label, variant, color) => {
    expect(getRevisionActionPresentation(key)).toEqual({
      key,
      label,
      variant,
      color,
    });
  });

  it.each([
    ["DRAFT", { canSubmitDraft: true }, ["submit"]],
    ["CHANGES_REQUESTED", { canResubmit: true }, ["resubmit"]],
  ] as const)("Editor can use the correct submit action for %s", (status, expected, actionKeys) => {
    const policy = getRevisionUiPolicy({
      role: "EDITOR",
      status,
      isOwner: true,
    });

    expect(policy).toMatchObject(expected);
    expect(
      actionKeys.map(key => getRevisionActionPresentation(key).key),
    ).toEqual(actionKeys);
  });

  it("locks an Editor on every in-review revision, including an active published parent", () => {
    const policy = getRevisionUiPolicy({
      role: "EDITOR",
      status: "IN_REVIEW",
      isOwner: true,
      hasPublishedRevision: true,
    });

    expect(policy).toMatchObject({
      readOnly: true,
      canEdit: false,
      canCancelSubmission: true,
      canSubmitDraft: false,
      canResubmit: false,
      saveMode: null,
    });
  });

  it("locks an Admin on changes requested and exposes no workflow action", () => {
    const policy = getRevisionUiPolicy({
      role: "ADMIN",
      status: "CHANGES_REQUESTED",
      hasPublishedRevision: true,
      isDirty: true,
    });

    expect(policy).toMatchObject({
      readOnly: true,
      canEdit: false,
      canPublishDraft: false,
      canReview: false,
      saveMode: null,
    });
  });

  it.each([
    ["EDITOR", "DRAFT", false, false, "DRAFT"],
    ["EDITOR", "PUBLISHED", false, true, "PUBLISH"],
    ["EDITOR", "PUBLISHED", true, true, "DRAFT"],
    ["ADMIN", "PUBLISHED", false, true, "PUBLISH"],
    ["ADMIN", "ARCHIVED", true, true, "DRAFT"],
  ] as const)("calculates dirty save mode for %s %s", (role, status, archived, hasPublishedRevision, saveMode) => {
    const policy = getRevisionUiPolicy({
      role,
      status: status === "ARCHIVED" ? "PUBLISHED" : status,
      isArchived: archived,
      hasPublishedRevision,
      isDirty: true,
    });

    expect(policy.saveMode).toBe(saveMode);
  });

  it.each([
    ["News", "ข่าว"],
    ["Knowledge", "ความรู้"],
    ["Learning", "สื่อการเรียนรู้"],
  ] as const)("uses the same publish/archive nouns for %s", (_module, noun) => {
    expect(getRevisionActionPresentation("publish", noun).label).toBe(
      `เผยแพร่${noun}`,
    );
    expect(getRevisionActionPresentation("archive", noun).label).toBe(
      `จัดเก็บ${noun}`,
    );
  });

  it.each([
    [
      "Editor draft",
      {
        role: "EDITOR",
        status: "DRAFT",
        isOwner: true,
        hasWorkingRevision: true,
      },
      ["submit"],
    ],
    [
      "Editor changes requested",
      {
        role: "EDITOR",
        status: "CHANGES_REQUESTED",
        isOwner: true,
        hasWorkingRevision: true,
      },
      ["resubmit"],
    ],
    [
      "Editor first review",
      {
        role: "EDITOR",
        status: "IN_REVIEW",
        isOwner: true,
        hasWorkingRevision: true,
      },
      ["cancelReview"],
    ],
    [
      "Editor republish review",
      {
        role: "EDITOR",
        status: "IN_REVIEW",
        isOwner: true,
        isArchived: true,
        hasPublishedRevision: true,
        hasWorkingRevision: true,
      },
      ["cancelRepublish"],
    ],
    [
      "Editor archived item",
      {
        role: "EDITOR",
        status: "PUBLISHED",
        isOwner: true,
        isArchived: true,
        hasPublishedRevision: true,
      },
      ["requestRepublish"],
    ],
    [
      "Editor published dirty item",
      {
        role: "EDITOR",
        status: "PUBLISHED",
        isOwner: true,
        hasPublishedRevision: true,
        isDirty: true,
      },
      ["saveAndPublish"],
    ],
    [
      "Admin draft",
      {
        role: "ADMIN",
        status: "DRAFT",
        hasWorkingRevision: true,
      },
      ["publish"],
    ],
    [
      "Admin review",
      {
        role: "ADMIN",
        status: "IN_REVIEW",
        hasWorkingRevision: true,
      },
      ["sendBack", "approve"],
    ],
    [
      "Admin republish review",
      {
        role: "ADMIN",
        status: "IN_REVIEW",
        isArchived: true,
        hasPublishedRevision: true,
        hasWorkingRevision: true,
      },
      ["sendBack", "approveRepublish"],
    ],
    [
      "Admin published item",
      {
        role: "ADMIN",
        status: "PUBLISHED",
        hasPublishedRevision: true,
      },
      ["archive"],
    ],
    [
      "Admin archived item",
      {
        role: "ADMIN",
        status: "PUBLISHED",
        isArchived: true,
        hasPublishedRevision: true,
      },
      ["republish"],
    ],
    [
      "Admin changes requested",
      {
        role: "ADMIN",
        status: "CHANGES_REQUESTED",
        hasPublishedRevision: true,
        hasWorkingRevision: true,
        isDirty: true,
      },
      [],
    ],
  ] as const)("renders the expected clean-state action keys for %s", (_name, input, expected) => {
    expect(getRevisionUiActionKeys(input)).toEqual(expected);
  });

  it.each([
    ["Editor draft", "EDITOR", "DRAFT", false, false, ["save", "submit"]],
    [
      "Editor archived item",
      "EDITOR",
      "PUBLISHED",
      true,
      false,
      ["save", "requestRepublish"],
    ],
    ["Admin draft", "ADMIN", "DRAFT", false, false, ["save", "publish"]],
    [
      "Admin review",
      "ADMIN",
      "IN_REVIEW",
      false,
      false,
      ["save", "sendBack", "approve"],
    ],
    [
      "Admin published item",
      "ADMIN",
      "PUBLISHED",
      false,
      true,
      ["archive", "saveAndPublish"],
    ],
  ] as const)("shows dirty-save and workflow action together for %s", (_name, role, status, isArchived, hasPublishedRevision, expected) => {
    expect(
      getRevisionUiActionKeys({
        role,
        status,
        isArchived,
        hasPublishedRevision,
        hasWorkingRevision: status === "PUBLISHED" ? false : true,
        isDirty: true,
        isOwner: role === "EDITOR",
      }),
    ).toEqual(expected);
  });
});
