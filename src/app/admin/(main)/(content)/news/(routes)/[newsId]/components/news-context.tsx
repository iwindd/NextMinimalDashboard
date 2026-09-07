"use client";

import type { NewsDetail } from "@/servers/news/types";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type NewsContextValue = {
  newsId: string;
  news: NewsDetail;
  actorId: string;
  role: "ADMIN" | "EDITOR";
};

const NewsContext = createContext<NewsContextValue | null>(null);

type NewsProviderProps = {
  newsId: string;
  news: NewsDetail;
  actorId: string;
  role: "ADMIN" | "EDITOR";
  children: ReactNode;
};

export function NewsProvider({
  newsId,
  news,
  actorId,
  role,
  children,
}: NewsProviderProps) {
  return (
    <NewsContext.Provider value={{ newsId, news, actorId, role }}>
      {children}
    </NewsContext.Provider>
  );
}

export function useNews() {
  const context = useContext(NewsContext);
  if (!context) {
    throw new Error("useNews must be used within a NewsProvider");
  }
  return context;
}
