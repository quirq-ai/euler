// The guide's table of contents, shared by the page (headings, the hero's index) and
// the progress ruler (a client component), so the two can never disagree.

export interface GuideSection {
  id: string;
  label: string;
}

export interface GuideChapter {
  id: string;
  numeral: string;
  title: string;
  /** One line for the hero's contents. */
  blurb: string;
  /** The figures the chapter holds, for the contents' right-hand column. */
  figs: string;
  sections: GuideSection[];
}

export const CHAPTERS: GuideChapter[] = [
  {
    id: "how-it-works",
    numeral: "I",
    title: "How it works",
    blurb: "From folders to a search engine and an encyclopedia, in three stations.",
    figs: "Figs. 1 to 4",
    sections: [
      { id: "the-crawl", label: "The crawl" },
      { id: "the-index", label: "The index" },
      { id: "the-readers", label: "The two readers" },
    ],
  },
  {
    id: "add-a-site",
    numeral: "II",
    title: "Add a site",
    blurb: "What turns a folder into an article, and the five steps to make one.",
    figs: "Figs. 5 to 7",
    sections: [
      { id: "folder-recipe", label: "A folder recipe" },
      { id: "five-steps", label: "The five steps" },
      { id: "new-root", label: "A whole new root" },
      { id: "names", label: "How names work" },
      { id: "most-wanted", label: "Most wanted READMEs" },
    ],
  },
  {
    id: "search",
    numeral: "III",
    title: "Search like a pro",
    blurb: "Operators, the ranking, and what happens when you misspell.",
    figs: "Fig. 8",
    sections: [
      { id: "operators", label: "Operators" },
      { id: "ranking", label: "How results are ranked" },
      { id: "near-misses", label: "Near misses" },
    ],
  },
  {
    id: "contribute",
    numeral: "IV",
    title: "Contribute",
    blurb: "A map of the code, four recipes, the loop and the checklist.",
    figs: "Figs. 9 and 10",
    sections: [
      { id: "codebase", label: "The codebase" },
      { id: "recipes", label: "Four recipes" },
      { id: "the-loop", label: "The loop" },
      { id: "conventions", label: "Conventions" },
      { id: "checklist", label: "Pull request checklist" },
    ],
  },
  {
    id: "privacy",
    numeral: "V",
    title: "Privacy",
    blurb: "What is read, what never is, what is blacked out, and who may ask.",
    figs: "Figs. 11 and 12",
    sections: [
      { id: "ledger", label: "The ledger" },
      { id: "localhost", label: "Only localhost" },
      { id: "database", label: "The database" },
    ],
  },
];
