import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { AdminNotificationCounts } from "@/servers/admin-notifications/types";

export const notificationsApi = createApi({
  reducerPath: "notificationsApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/", cache: "no-store" }),
  tagTypes: ["Notifications"],
  refetchOnMountOrArgChange: true,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: (builder) => ({
    getAdminNotificationCounts: builder.query<AdminNotificationCounts, void>({
      query: () => "api/admin/notifications/counts",
      providesTags: ["Notifications"],
    }),
  }),
});

export const { useGetAdminNotificationCountsQuery } = notificationsApi;
