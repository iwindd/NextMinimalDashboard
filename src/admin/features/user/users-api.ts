import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { UserListQuery, UserListResult } from "@/servers/user/types";

export const usersApi = createApi({
  reducerPath: "usersApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050"}/api/v1/`,
    credentials: "include",
    cache: "no-store",
  }),
  tagTypes: ["Users"],
  refetchOnMountOrArgChange: true,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: (builder) => ({
    getUsers: builder.query<UserListResult, UserListQuery>({
      query: (params) => ({
        url: "admin/users",
        params,
      }),
      providesTags: ["Users"],
    }),
  }),
});

export const { useGetUsersQuery } = usersApi;
