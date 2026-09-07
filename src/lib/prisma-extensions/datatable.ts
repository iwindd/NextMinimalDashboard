import { Prisma } from "@prisma/client";
import { buildPrismaOrderBy, buildPrismaSearchOr } from "./datatable.helpers";
import type { DatatableQuery, DatatableSearchConfig } from "./datatable.types";

export const datatableExtension = Prisma.defineExtension({
  name: "datatable",
  model: {
    $allModels: {
      async getDatatable<
        T,
        S extends Prisma.Args<T, "findMany">["select"],
      >(
        this: T,
        args: {
          query: DatatableQuery;
          select: S;
          searchable?: DatatableSearchConfig;
          where?: Prisma.Args<T, "findMany">["where"];
          defaultOrderBy?: Prisma.Args<T, "findMany">["orderBy"];
        },
      ): Promise<{
        data: Prisma.Result<T, { select: S }, "findMany">;
        total: number;
      }> {
        const context = Prisma.getExtensionContext(this) as unknown as {
          findMany: (findManyArgs: unknown) => Promise<unknown>;
          count: (countArgs: unknown) => Promise<number>;
        };
        const searchConditions = args.searchable
          ? buildPrismaSearchOr(args.query.search ?? "", args.searchable)
          : [];
        const where = {
          ...(args.where ? { AND: [args.where] } : {}),
          ...(searchConditions.length > 0 ? { OR: searchConditions } : {}),
        };
        const orderBy =
          buildPrismaOrderBy(args.query.sortBy, args.query.sortDirection) ??
          args.defaultOrderBy;
        const skip = (args.query.page - 1) * args.query.pageSize;

        const [data, total] = await Promise.all([
          context.findMany({
            where,
            orderBy,
            skip,
            take: args.query.pageSize,
            select: args.select,
          }),
          context.count({ where }),
        ]);

        return {
          data: data as Prisma.Result<T, { select: S }, "findMany">,
          total,
        };
      },
    },
  },
});
