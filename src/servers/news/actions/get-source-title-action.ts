"use server";

import { returnActionError } from "@/lib/action-client";
import { fetchPageTitle } from "../source-title";
import { manageNewsActionClient } from "./client";
import { getSourceTitleSchema } from "./get-source-title-schema";

export const getSourceTitleAction = manageNewsActionClient
  .inputSchema(getSourceTitleSchema)
  .action(async ({ parsedInput }) => {
    try {
      return { title: await fetchPageTitle(parsedInput.url) };
    } catch (error) {
      return returnActionError({
        code: "POLICY",
        message: error instanceof Error ? error.message : "ไม่สามารถตรวจสอบ URL นี้ได้",
      });
    }
  });
