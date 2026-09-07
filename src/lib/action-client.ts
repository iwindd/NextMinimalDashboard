import {
  createSafeActionClient,
  returnServerError,
} from "next-safe-action";

export type ActionServerError = {
  code: "UNAUTHORIZED" | "NOT_FOUND" | "POLICY" | "VALIDATION" | "INTERNAL";
  message: string;
  fieldErrors?: Record<string, string>;
};

export const actionClient = createSafeActionClient({
  defaultValidationErrorsShape: "flattened",
  handleServerError: (error): ActionServerError => {
    console.error(error);

    return {
      code: "INTERNAL",
      message: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง",
    };
  },
});

export const returnActionError = (
  error: ActionServerError,
): never => returnServerError(error);
