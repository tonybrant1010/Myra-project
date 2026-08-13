import { storage } from "@/src/utils/storage";

const FORUM_SEEN_KEY = "forum_seen_at";

/**
 * Az "utoljára megnyitottam a fórumot" időpont, helyben tárolva.
 *
 * Szándékosan eszközhöz kötött, nem fiókhoz: nem kell hozzá adatbázis-oszlop
 * és szerveroldali állapot. Cserébe ha valaki telefonon megnézi a fórumot,
 * a gépén még megjelenhet a jelzés. Kilenc felhasználónál ez nem probléma.
 */
export async function getForumSeenAt(): Promise<string> {
  return (await storage.getItem<string>(FORUM_SEEN_KEY, "")) || "";
}

export async function setForumSeenAt(iso: string | null | undefined): Promise<void> {
  if (!iso) return;
  await storage.setItem(FORUM_SEEN_KEY, iso);
}

/**
 * A legfrissebb poszt időpontja a listából. A backend növekvő sorrendben adja
 * vissza, de nem építünk rá — a maximumot keressük meg.
 *
 * Az összehasonlítás sima sztring-összevetés: a szerver mindenhol ISO-8601-et
 * ad ugyanabban a formátumban (`...+00:00`), ott a betűrend időrend is.
 */
export function newestCreatedAt(posts: { created_at?: string }[]): string {
  let newest = "";
  for (const post of posts) {
    if (post.created_at && post.created_at > newest) newest = post.created_at;
  }
  return newest;
}
