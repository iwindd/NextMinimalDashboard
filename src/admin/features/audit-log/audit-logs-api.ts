import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  AuditLogListQuery,
  AuditLogListResult,
} from "@/servers/audit-log/types";

/** Which timeline to read. The server re-derives every scope it can. */
export type AuditLogScopeArg =
  | { kind: "all" }
  | { kind: "user"; userId: string }
  | { kind: "own" };

function getAuditLogListUrl(scope: AuditLogScopeArg) {
  if (scope.kind === "user") {
    return `audit-logs/users/${encodeURIComponent(scope.userId)}`;
  }

  return scope.kind === "own" ? "audit-logs/me" : "audit-logs";
}

export function getAuditLogExportUrl(scope: AuditLogScopeArg, id: string) {
  const base = scope.kind === "own" ? "audit-logs/me" : "audit-logs";

  return `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050"}/api/v1/${base}/${encodeURIComponent(id)}/export`;
}

/** Multi-value filters travel as comma-separated lists. */
function toRequestParams(query: AuditLogListQuery) {
  const { actions, resourceTypes, ...rest } = query;

  return {
    ...rest,
    ...(actions?.length ? { actions: actions.join(",") } : {}),
    ...(resourceTypes?.length
      ? { resourceTypes: resourceTypes.join(",") }
      : {}),
  };
}

export const auditLogsApi = createApi({
  reducerPath: "auditLogsApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050"}/api/v1/`,
    credentials: "include",
    cache: "no-store",
  }),
  tagTypes: ["AuditLogs"],
  refetchOnMountOrArgChange: true,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: (builder) => ({
    getAuditLogs: builder.query<
      AuditLogListResult,
      { scope: AuditLogScopeArg; query: AuditLogListQuery }
    >({
      query: ({ scope, query }) => ({
        url: getAuditLogListUrl(scope),
        params: toRequestParams(query),
      }),
      providesTags: ["AuditLogs"],
    }),
  }),
});

export const { useGetAuditLogsQuery } = auditLogsApi;
