// Two ways to run Innernet.
//
// Local (the default): the index of this machine's folders, served only to localhost.
// Demo: a public index of the open-source repositories of github.com/quirq-ai, built by
// `pnpm index:demo` into data/demo/index.json and committed, so it can run anywhere.
// Vercel always runs the demo (it sets VERCEL=1); INNERNET_DEMO=1 previews it locally.
// A build made for the demo stays the demo: next.config.ts writes INNERNET_DEMO_BUILD
// into it, so a deployment whose functions are not given VERCEL at run time still
// serves the demo rather than refusing every visitor.

export const DEMO = process.env.INNERNET_DEMO === "1" || process.env.VERCEL === "1" || process.env.INNERNET_DEMO_BUILD === "1";

export const DEMO_ORG = "quirq-ai";
export const DEMO_ORG_URL = `https://github.com/${DEMO_ORG}`;
export const DEMO_REPO_URL = `${DEMO_ORG_URL}/innernet`;

/** The index the server reads, relative to the project folder. */
export const INDEX_PATH = DEMO ? "data/demo/index.json" : "data/index.json";

/** The command that builds that index. */
export const INDEX_COMMAND = DEMO ? "pnpm index:demo" : "pnpm index";

/** One of Innernet's own files (or folders) on GitHub, for the demo's links into the code. */
export const repoFileUrl = (file: string, dir = false) =>
  `${DEMO_REPO_URL}/${dir ? "tree" : "blob"}/main/${file.split("/").map(encodeURIComponent).join("/")}`;
