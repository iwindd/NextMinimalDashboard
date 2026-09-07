type RevisionUiRole = "EDITOR" | "ADMIN";

type RevisionUiStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "PUBLISHED"
  | "SUPERSEDED"
  | undefined;

type RevisionSaveMode = "DRAFT" | "PUBLISH";

export type RevisionUiPolicyInput = {
  role: RevisionUiRole;
  status: RevisionUiStatus;
  isOwner?: boolean;
  isDeleted?: boolean;
  isArchived?: boolean;
  hasPublishedRevision?: boolean;
  hasWorkingRevision?: boolean;
  isDirty?: boolean;
};

export type RevisionUiPolicy = {
  autoPublishActive: boolean;
  readOnly: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canSubmitDraft: boolean;
  canResubmit: boolean;
  canRequestRepublish: boolean;
  canPublishDraft: boolean;
  canRepublish: boolean;
  canCancelSubmission: boolean;
  canReview: boolean;
  saveMode: RevisionSaveMode | null;
};

/**
 * Shared visibility and editability contract for the three Admin detail pages.
 *
 * This is UI policy only. Server actions remain the authorization boundary.
 */
export function getRevisionUiPolicy({
  role,
  status,
  isOwner = true,
  isDeleted = false,
  isArchived = false,
  hasPublishedRevision = false,
  hasWorkingRevision = false,
  isDirty = false,
}: RevisionUiPolicyInput): RevisionUiPolicy {
  const autoPublishActive = Boolean(
    hasPublishedRevision &&
      !isArchived &&
      status !== "CHANGES_REQUESTED",
  );
  const editorReviewLocked = role === "EDITOR" && status === "IN_REVIEW";
  const adminChangesLocked =
    role === "ADMIN" && status === "CHANGES_REQUESTED";
  const readOnly = isDeleted || editorReviewLocked || adminChangesLocked;
  const canEdit = !readOnly && (role === "ADMIN" || isOwner);

  const canArchive = Boolean(
    role === "ADMIN" &&
      !isDeleted &&
      !isArchived &&
      hasPublishedRevision &&
      !hasWorkingRevision &&
      status === "PUBLISHED",
  );
  const canSubmitDraft = Boolean(
    role === "EDITOR" &&
      isOwner &&
      !isDeleted &&
      !autoPublishActive &&
      !isArchived &&
      status === "DRAFT",
  );
  const canResubmit = Boolean(
    role === "EDITOR" &&
      isOwner &&
      !isDeleted &&
      !autoPublishActive &&
      status === "CHANGES_REQUESTED",
  );
  const canRequestRepublish = Boolean(
    role === "EDITOR" &&
      isOwner &&
      !isDeleted &&
      isArchived &&
      status !== "IN_REVIEW" &&
      status !== "CHANGES_REQUESTED",
  );
  const canPublishDraft = Boolean(
    role === "ADMIN" &&
      !isDeleted &&
      !autoPublishActive &&
      status === "DRAFT",
  );
  const canRepublish = Boolean(
    role === "ADMIN" &&
      !isDeleted &&
      isArchived &&
      !hasWorkingRevision &&
      status === "PUBLISHED",
  );
  const canCancelSubmission = Boolean(
    role === "EDITOR" &&
      isOwner &&
      !isDeleted &&
      status === "IN_REVIEW",
  );
  const canReview = Boolean(
    role === "ADMIN" && !isDeleted && status === "IN_REVIEW",
  );

  return {
    autoPublishActive,
    readOnly,
    canEdit,
    canArchive,
    canSubmitDraft,
    canResubmit,
    canRequestRepublish,
    canPublishDraft,
    canRepublish,
    canCancelSubmission,
    canReview,
    saveMode: canEdit && isDirty
      ? autoPublishActive
        ? "PUBLISH"
        : "DRAFT"
      : null,
  };
}

export type RevisionActionKey =
  | "save"
  | "saveAndPublish"
  | "submit"
  | "resubmit"
  | "cancelReview"
  | "cancelRepublish"
  | "requestRepublish"
  | "publish"
  | "republish"
  | "sendBack"
  | "approve"
  | "approveRepublish"
  | "archive";

export type RevisionActionPresentation = {
  key: RevisionActionKey;
  label: string;
  variant: "outline" | "filled";
  color: "brand" | "gray" | "orange" | "success";
};

export function getRevisionActionPresentation(
  key: RevisionActionKey,
  contentNoun = "ข่าว",
): RevisionActionPresentation {
  const actions: Record<RevisionActionKey, RevisionActionPresentation> = {
    save: {
      key,
      label: "บันทึก",
      variant: "outline",
      color: "brand",
    },
    saveAndPublish: {
      key,
      label: "บันทึกและเผยแพร่",
      variant: "filled",
      color: "success",
    },
    submit: {
      key,
      label: "ส่งตรวจสอบ",
      variant: "filled",
      color: "brand",
    },
    resubmit: {
      key,
      label: "ส่งตรวจสอบอีกครั้ง",
      variant: "filled",
      color: "brand",
    },
    cancelReview: {
      key,
      label: "ยกเลิกการส่งตรวจสอบ",
      variant: "outline",
      color: "gray",
    },
    cancelRepublish: {
      key,
      label: "ยกเลิกส่งคำขอเผยแพร่อีกครั้ง",
      variant: "outline",
      color: "gray",
    },
    requestRepublish: {
      key,
      label: "ส่งคำขอเผยแพร่อีกครั้ง",
      variant: "filled",
      color: "orange",
    },
    publish: {
      key,
      label: `เผยแพร่${contentNoun}`,
      variant: "filled",
      color: "success",
    },
    republish: {
      key,
      label: "เผยแพร่อีกครั้ง",
      variant: "filled",
      color: "success",
    },
    sendBack: {
      key,
      label: "ส่งกลับให้แก้ไข",
      variant: "outline",
      color: "orange",
    },
    approve: {
      key,
      label: "อนุมัติและเผยแพร่",
      variant: "filled",
      color: "success",
    },
    approveRepublish: {
      key,
      label: "อนุมัติและเผยแพร่อีกครั้ง",
      variant: "filled",
      color: "success",
    },
    archive: {
      key,
      label: `จัดเก็บ${contentNoun}`,
      variant: "outline",
      color: "orange",
    },
  };

  return actions[key];
}

export function getRevisionUiActionKeys(
  input: RevisionUiPolicyInput,
): RevisionActionKey[] {
  const policy = getRevisionUiPolicy(input);
  const actions: RevisionActionKey[] = [];

  if (policy.canArchive) actions.push("archive");
  if (policy.saveMode) {
    actions.push(policy.saveMode === "PUBLISH" ? "saveAndPublish" : "save");
  }
  if (policy.canSubmitDraft) actions.push("submit");
  if (policy.canResubmit) actions.push("resubmit");
  if (policy.canRequestRepublish) actions.push("requestRepublish");
  if (policy.canPublishDraft) {
    actions.push(input.isArchived ? "republish" : "publish");
  }
  if (policy.canRepublish) actions.push("republish");
  if (policy.canCancelSubmission) {
    actions.push(input.isArchived ? "cancelRepublish" : "cancelReview");
  }
  if (policy.canReview) {
    actions.push("sendBack");
    actions.push(input.isArchived ? "approveRepublish" : "approve");
  }

  return actions;
}
