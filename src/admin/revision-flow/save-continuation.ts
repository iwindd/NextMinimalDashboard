export type SaveContinuation = {
  action: () => void;
  continueAfterAutoPublish?: boolean;
};

export function shouldRunSaveContinuation({
  hasMetadataErrors,
  autoPublished,
  continuation,
}: {
  hasMetadataErrors: boolean;
  autoPublished: boolean;
  continuation: SaveContinuation | null;
}) {
  return Boolean(
    continuation &&
      !hasMetadataErrors &&
      (!autoPublished || continuation.continueAfterAutoPublish),
  );
}
