import { prisma } from "@/lib/prisma";
import type { DatatableSearchConfig } from "@/lib/prisma-extensions/datatable.types";
import { Prisma } from "@prisma/client";
import { requireManageUsers } from "../authorization";
import { USER_LIST_SELECT, toUserListItem } from "../helpers";
import type { UserListQuery, UserListResult } from "../types";

const USER_SEARCHABLE: DatatableSearchConfig = {
  name: { mode: "insensitive" },
  email: { mode: "insensitive" },
};

function buildUserWhere(query: UserListQuery): Prisma.UserWhereInput {
  return {
    ...(query.role ? { role: query.role } : {}),
    ...(query.status === "active"
      ? { isActive: true }
      : query.status === "inactive"
        ? { isActive: false }
        : {}),
  };
}

export async function getUserList(
  query: UserListQuery,
): Promise<UserListResult> {
  await requireManageUsers();
  const result = await prisma.user.getDatatable({
    query,
    select: USER_LIST_SELECT,
    searchable: USER_SEARCHABLE,
    where: buildUserWhere(query),
    defaultOrderBy: { createdAt: "desc" },
  });

  return {
    data: result.data.map(toUserListItem),
    total: result.total,
  };
}
