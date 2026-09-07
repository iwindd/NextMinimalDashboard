import type { NewsListItem, NewsListQuery } from "@/servers/news/types";
import { getContentStatusColor } from '@/admin/components/content-status';

export const NEWS_STATUS_TABS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "draft", label: "ฉบับร่าง" },
  { value: "in_review", label: "รอตรวจสอบ" },
  { value: "published", label: "เผยแพร่แล้ว" },
  { value: "archived", label: "จัดเก็บแล้ว" },
  { value: "changes_requested", label: "รอแก้ไข" },
] as const;

export type NewsStatusTab = (typeof NEWS_STATUS_TABS)[number]["value"];

export function getActiveNewsTab(
  status: NewsListQuery["status"],
): NewsStatusTab {
  if (status === "all" || status.length !== 1) return "all";
  if (status[0] === "republish") return "all";
  return status[0];
}

export function getNewsTabQueryValue(tab: NewsStatusTab) {
  return tab === "all" ? undefined : tab;
}

export type NewsDisplayStatus =
  | "ARCHIVED"
  | "REPUBLISH"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "PUBLISHED"
  | "DRAFT"
  | "SUPERSEDED"
  | "EMPTY";

const NEWS_STATUS_LABELS: Record<NewsDisplayStatus, string> = {
  ARCHIVED: '',
  REPUBLISH: '',
  IN_REVIEW: '',
  CHANGES_REQUESTED: '',
  PUBLISHED: '',
  DRAFT: '',
  SUPERSEDED: '',
  EMPTY: ''
};

const NEWS_TAB_BADGE_STATUS: Record<NewsStatusTab, NewsDisplayStatus> = {
  all: "EMPTY",
  draft: "DRAFT",
  in_review: "IN_REVIEW",
  published: "PUBLISHED",
  archived: "ARCHIVED",
  changes_requested: "CHANGES_REQUESTED",
};

export function getNewsStatusBadgeColor(
  status: NewsDisplayStatus | NewsStatusTab,
): string {
  const displayStatus =
    status in NEWS_STATUS_LABELS
      ? (status as NewsDisplayStatus)
      : NEWS_TAB_BADGE_STATUS[status as NewsStatusTab];

  return getContentStatusColor(displayStatus);
}

export function getNewsDisplayStatus(record: NewsListItem): NewsDisplayStatus {
  if (record.archivedAt) {
    return record.status === "IN_REVIEW" ? "REPUBLISH" : "ARCHIVED";
  }
  if (!record.status) return "EMPTY";
  return record.status;
}
