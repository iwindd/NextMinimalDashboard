import { getManageNewsActor } from "@/servers/news/authorization";
import { getNewsDetail } from "@/servers/news/queries/get-news-detail";
import { notFound } from "next/navigation";
import { NewsProvider } from "./components/news-context";

export const dynamic = "force-dynamic";

export default async function NewsDetailLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ newsId: string }>;
}>) {
  const { newsId } = await params;
  const actor = await getManageNewsActor();
  if (!actor) notFound();

  let news;
  try {
    news = await getNewsDetail(newsId);
  } catch {
    notFound();
  }
  if (!news) notFound();

  return (
    <NewsProvider
      newsId={newsId}
      news={news}
      actorId={actor.id}
      role={actor.role}
    >
      {children}
    </NewsProvider>
  );
}
