import { storage } from "@/src/utils/storage";

const FORUM_SEEN_KEY = "forum_seen_at";

export async function getForumSeenAt(): Promise<string> {
  return (await storage.getItem<string>(FORUM_SEEN_KEY, "")) || "";
}

export async function setForumSeenAt(iso: string | null | undefined): Promise<void> {
  if (!iso) return;
  await storage.setItem(FORUM_SEEN_KEY, iso);
}

export function newestCreatedAt(posts: { created_at?: string }[]): string {
  let newest = "";
  for (const post of posts) {
    if (post.created_at && post.created_at > newest) newest = post.created_at;
  }
  return newest;
}
