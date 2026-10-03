// Language colours, close to GitHub's so they read instantly. Used for result dots,
// the article language bar and statistics.

const COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#e8c547",
  Python: "#3572a5",
  Jupyter: "#da5b0b",
  Rust: "#dea584",
  Go: "#00add8",
  Solidity: "#aa6746",
  Dart: "#00b4ab",
  Swift: "#f05138",
  Kotlin: "#a97bff",
  Java: "#b07219",
  Ruby: "#cc342d",
  PHP: "#4f5d95",
  C: "#8a8a8a",
  "C++": "#f34b7d",
  "C#": "#178600",
  Lua: "#000080",
  Zig: "#ec915c",
  Elixir: "#6e4a7e",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#663399",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Astro: "#ff5a03",
  Markdown: "#5b7fbf",
  MDX: "#fcb32c",
  SQL: "#e38c00",
  GLSL: "#5686a5",
  WGSL: "#1a5e9a",
  JSON: "#9a9a8f",
  YAML: "#cb171e",
  TOML: "#9c4221",
};

export function langColor(name: string): string {
  return COLORS[name] ?? "#a9a499";
}
