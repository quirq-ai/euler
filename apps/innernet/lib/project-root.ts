import "server-only";

import path from "node:path";

// A host such as Quirq may serve multiple apps from one process. It sets this
// runtime-only path instead of changing the working directory for every request.
export const PROJECT_ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.INNERNET_PROJECT_ROOT || process.cwd());
