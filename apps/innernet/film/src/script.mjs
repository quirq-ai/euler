// The narration, one line per frame (chapter cards are silent). Every claim here is
// checked against FACTS.md. Lily (ElevenLabs) reads it; scripts/voice.mjs renders it.

export const VOICE = { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", model: "eleven_multilingual_v2", speed: 0.96 };

// How Lily should say words she otherwise slurs. The captions keep the written word; only
// the text sent to the voice changes. Each spelling was checked by transcribing it back
// (scripts/stt-check.mjs): plain "Innerpedia" comes back as "Inopedia" or "Innapedia".
export const SAY = [
  ["Innerpedia", "Innerr-pedia"],
  ["Innernet", "Inner-net"],
  ["README", "read me"],
];

/** The text Lily is given for a line. */
export const spoken = (text) => SAY.reduce((t, [w, s]) => t.replace(new RegExp(`\\b${w}\\b`, "g"), s), text);

export const LINES = {
  "01": "Somewhere on your machine are thousands of folders. Everything you ever started.",
  "02": "Innernet turns them into a web of your own. A search engine, and an encyclopedia. Private, and entirely yours.",
  "04": "It starts with a crawl. The indexer walks six levels deep, and quietly skips the noise: dependencies, builds, caches.",
  "05": "From each folder it reads only a few things: the README, the package file, the git history, notes for agents. Never your secrets. Key files stay closed, and passwords are blacked out.",
  "06": "In under a minute, it all becomes one small index.",
  "07": "And all of it stays here. The index, the search, every page lives on your machine, and nothing, ever, is sent away.",
  "08": "Two readers share it. Search finds anything you type, in a few milliseconds.",
  "09": "And Innerpedia gives every project an article, written from what is inside it.",
  "10": "Even namesakes are handled. Two hundred and four folders called src, one tidy page.",
  "12": "Every folder is already a site. A little care makes it a great one.",
  "13": "Start with a README. Its first paragraph becomes the summary you see in search.",
  "14": "Add a package file, and it learns your frameworks. Add git, and it gains a history.",
  "15": "Then run one command, right on your machine. Your new site appears, with its own article and its own colours.",
  "16": "Want more of your machine in it? Add a root folder, and the crawl reaches further.",
  "18": "Innernet is small and readable. One script writes the index, two libraries read it, and pages render on the server, behind a gate only this computer can open.",
  "19": "A new search operator, a special page, a section on every article: each lives in one known place.",
  "20": "Make the change. Check the types. Crawl the pages. Look at a screenshot. Open a pull request. And keep the one promise: everything stays local.",
  "21": "Your folders were always a web. Now you can wander it: private, local, and yours.",
};
