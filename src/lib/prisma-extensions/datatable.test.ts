import { describe, expect, it, vi } from "vitest";
import { datatableExtension } from "./datatable";

type ExtensionClient = {
  $extends: (extension: unknown) => unknown;
};

type DatatableDefinition = {
  model: {
    $allModels: {
      getDatatable: (args: {
        query: {
          page: number;
          pageSize: number;
          search?: string;
          sortBy?: string;
          sortDirection: "asc" | "desc";
        };
        select: Record<string, boolean>;
        searchable?: Record<string, unknown>;
        where?: Record<string, unknown>;
        defaultOrderBy?: Record<string, string>;
      }) => Promise<unknown>;
    };
  };
};

function unwrapExtension<T>(extension: unknown): T {
  const factory = extension as (client: ExtensionClient) => T;
  return factory({ $extends: (definition) => definition });
}

describe("datatable Prisma extension", () => {
  it("combines filters, search, pagination, ordering, and count", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "user-1" }]);
    const count = vi.fn().mockResolvedValue(1);
    const extension = unwrapExtension<DatatableDefinition>(datatableExtension);

    await expect(
      extension.model.$allModels.getDatatable.call(
        { findMany, count },
        {
          query: {
            page: 2,
            pageSize: 10,
            search: "alice",
            sortBy: "email",
            sortDirection: "asc",
          },
          select: { id: true, email: true },
          searchable: {
            name: { mode: "insensitive" },
            tags: { hasSome: ["admin"] },
          },
          where: { isActive: true },
          defaultOrderBy: { createdAt: "desc" },
        },
      ),
    ).resolves.toEqual({ data: [{ id: "user-1" }], total: 1 });

    const expectedWhere = {
      AND: [{ isActive: true }],
      OR: [
        { name: { contains: "alice", mode: "insensitive" } },
        { tags: { hasSome: ["alice", "admin"] } },
      ],
    };
    expect(findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      orderBy: [{ email: "asc" }],
      skip: 10,
      take: 10,
      select: { id: true, email: true },
    });
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it("uses the default order and omits empty filters when no search is supplied", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const extension = unwrapExtension<DatatableDefinition>(datatableExtension);

    await extension.model.$allModels.getDatatable.call(
      { findMany, count },
      {
        query: {
          page: 1,
          pageSize: 5,
          search: "",
          sortDirection: "desc",
        },
        select: { id: true },
        defaultOrderBy: { createdAt: "desc" },
      },
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 5,
      select: { id: true },
    });
    expect(count).toHaveBeenCalledWith({ where: {} });
  });
});
