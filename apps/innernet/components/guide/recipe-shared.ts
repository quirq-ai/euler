// Shared by the folder recipe (a client component) and the server code that feeds it:
// the names the recipe offers, and the shape of what the server tells it about them.

export const RECIPE_NAMES = ["weather-station", "src", "private-notes", "build", ".weather-station"] as const;
export type RecipeName = (typeof RECIPE_NAMES)[number];

/** What the index already holds under each name, so the slug comes out as it would. */
export type Namesakes = Record<RecipeName, { depths: { depth: number; isArticle: boolean }[]; slugs: string[]; rootPrimary: boolean }>;

export type RecipeCite = "kind" | "article" | "summary" | "normalize" | "names" | "categories" | "lead" | "prior" | "prune" | "secret" | "depth";

export interface RecipeProps {
  maxDepth: number;
  rootLabel: string; // "~/Programming"
  rootName: string; // "Programming"
  today: string; // "October 2026"
  todayLong: string; // "2 October 2026", as the infobox writes it
  year: string;
  /** Who usually commits on this machine, for the lead's one-commit history. */
  author: string | null;
  namesakes: Namesakes;
  cites: Record<RecipeCite, string>;
}
