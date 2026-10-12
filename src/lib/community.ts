/** The community's topics — isomorphic: the page shows them, the server checks them. */
export const TOPICS = {
  cases: { label: "Case discussions", short: "Cases" },
  "neet-pg": { label: "NEET PG & INI-CET", short: "NEET PG" },
  usmle: { label: "USMLE", short: "USMLE" },
  ukmla: { label: "UKMLA & PLAB", short: "UKMLA" },
  questions: { label: "Clinical questions", short: "Questions" },
  general: { label: "General", short: "General" },
} as const;

export type Topic = keyof typeof TOPICS;
export const TOPIC_IDS = Object.keys(TOPICS) as Topic[];

export interface Author {
  name: string;
  username: string;
  rankTier: number;
  rankLabel: string;
}

export interface PostSummary {
  id: string;
  topic: Topic;
  title: string;
  /** The opening of the body, for the feed. */
  excerpt: string;
  author: Author;
  spoiler: boolean;
  /** A shared result's card, if the post discusses a case. */
  shareId: string | null;
  replies: number;
  likes: number;
  liked: boolean;
  mine: boolean;
  createdAt: number;
  lastActivityAt: number;
}

export interface Reply {
  id: string;
  body: string;
  author: Author;
  likes: number;
  liked: boolean;
  mine: boolean;
  createdAt: number;
}

export interface Post extends PostSummary {
  body: string;
  replyList: Reply[];
}
