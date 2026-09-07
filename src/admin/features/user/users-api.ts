import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { UserListQuery, UserListResult } from "@/servers/user/types";

export const usersApi = createApi({
  reducerPath: "usersApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/", cache: "no-store" }),
  tagTypes: ["Users"],
  refetchOnMountOrArgChange: true,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: (builder) => ({
    getUsers: builder.query<UserListResult, UserListQuery>({
      query: (params) => ({
        url: "api/admin/users",
        params,
      }),
      providesTags: ["Users"],
    }),
  }),
});

export const { useGetUsersQuery } = usersApi;
