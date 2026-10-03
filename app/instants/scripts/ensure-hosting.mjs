import { constants, copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultProjectRoot = fileURLToPath(new URL("../", import.meta.url));

/** Read local bindings, or the portable defaults on a fresh clone. */
export function readHostingConfig(projectRoot = defaultProjectRoot) {
  try {
    return JSON.parse(
      readFileSync(path.join(projectRoot, ".openai", "hosting.json"), "utf8"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return JSON.parse(
      readFileSync(
        path.join(projectRoot, "build", "hosting.example.json"),
        "utf8",
      ),
    );
  }
}

/** Create local defaults without replacing an existing Sites project link. */
export function ensureHostingConfig(projectRoot = defaultProjectRoot) {
  const configurationDirectory = path.join(projectRoot, ".openai");
  mkdirSync(configurationDirectory, { recursive: true });
  try {
    copyFileSync(
      path.join(projectRoot, "build", "hosting.example.json"),
      path.join(configurationDirectory, "hosting.json"),
      constants.COPYFILE_EXCL,
    );
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  return readHostingConfig(projectRoot);
}
