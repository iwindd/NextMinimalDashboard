import { revalidateTag } from "next/cache";

export function revalidateNewsNotificationCounts() {
  revalidateTag("admin-notification-count:news", { expire: 0 });
}
