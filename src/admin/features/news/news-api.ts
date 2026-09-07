import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  NewsDraftListResult,
  NewsListQuery,
  NewsListResult,
} from "@/servers/news/types";

export const newsApi = createApi({
  reducerPath: "newsApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/", cache: "no-store" }),
  tagTypes: ["News"],
  refetchOnMountOrArgChange: true,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: (builder) => ({
    getNews: builder.query<NewsListResult, NewsListQuery>({
      query: (params) => ({ url: "api/admin/news", params }),
      providesTags: ["News"],
    }),
    getNewsDrafts: builder.query<NewsDraftListResult, void>({
      query: () => "api/admin/news/drafts",
      providesTags: ["News"],
    }),
  }),
});

export const {
  useGetNewsQuery,
} = newsApi;
