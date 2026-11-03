import "server-only";

import { parseAvatar, publicAvatar, type PublicAvatar } from "@/lib/avatar-style";

import { db } from "./db";

/**
 * Lists of doctors (leaderboards, near me) with the avatar each chose, as `avatar` on the row. One read for the whole list; a doctor
 * who hasn't chosen a persona or photo gets no field, and if the read fails the list simply goes out without them.
 */
export async function withAvatars<T>(rows: T[], idOf: (row: T) => string): Promise<(T & { avatar?: PublicAvatar })[]> {
  const ids = [...new Set(rows.map(idOf))].slice(0, 200);
  if (!ids.length) return rows as (T & { avatar?: PublicAvatar })[];
  const found = await db.all<{ user_id: string | number; style: string }>(`SELECT user_id, style FROM user_avatars WHERE user_id IN (${ids.map(() => "?").join(",")})`, ...ids).catch(() => []);
  const looks = new Map<string, PublicAvatar>();
  for (const row of found) {
    try {
      const look = publicAvatar(parseAvatar(JSON.parse(row.style)));
      if (look) looks.set(String(row.user_id), look);
    } catch {
      // One unreadable row costs only that doctor's picture.
    }
  }
  return rows.map((r) => {
    const avatar = looks.get(String(idOf(r)));
    return (avatar ? { ...r, avatar } : r) as T & { avatar?: PublicAvatar };
  });
}

/** The same for a whole board: its rows and the viewer's own row. */
export async function boardWithAvatars<B extends { rows?: { userId: string }[]; me?: { userId: string } | null }>(board: B): Promise<B> {
  const list = [...(board.rows ?? []), ...(board.me ? [board.me] : [])];
  const done = await withAvatars(list, (r) => r.userId);
  if (done.length === 0) return board;
  const n = board.rows?.length ?? 0;
  return { ...board, ...(board.rows ? { rows: done.slice(0, n) } : {}), ...(board.me ? { me: done[n] } : {}) };
}
