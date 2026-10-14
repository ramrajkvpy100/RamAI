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

/** The case behind a discussion: what the doctor saw and did — the answer kept back until asked for. */
export interface CaseSummary {
  /** "34-year-old female · schoolteacher, Delhi". */
  patient: string;
  /** "OPD · District Hospital · Dermatology". */
  setting: string;
  presentation: string[];
  history: { label: string; value: string; abnormal?: boolean }[];
  examination: { label: string; value: string; abnormal?: boolean }[];
  /** First reading → last reading. */
  vitals: { label: string; first: string; last: string; abnormal?: boolean }[];
  investigations: { name: string; findings: string }[];
  management: string[];
  /** What the doctor thought it was, in the case. */
  workingDiagnosis?: string;
  differentials: string[];
  /** Shown only on "Reveal": the answer and how it went. */
  answer: { diagnosis: string; verdict: string; score: number; outcome: string };
}

export interface Post extends PostSummary {
  body: string;
  replyList: Reply[];
  /** The case being discussed, when the post came from "Discuss this case". */
  case?: CaseSummary;
}
