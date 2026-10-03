import brand from "@/config/brand.json";
export type Theme = "light" | "dark";
export { brand };
const kebab = (value: string) =>
  value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
export function brandVariables(theme: Theme) {
  const colors = { ...brand.themes[theme], ...brand.colors };
  return Object.fromEntries([
    ...Object.entries(colors).map(([key, value]) => [
      `--ig-${kebab(key)}`,
      value,
    ]),
    ["--ig-font", brand.font],
    ["--ig-logo-font", brand.logo.font],
    ["--ig-logo-size", brand.logo.size],
    ["--ig-logo-weight", brand.logo.weight],
    ["--ig-logo-letter-spacing", brand.logo.letterSpacing],
    ...Object.entries(brand.navigation).map(([key, value]) => [
      `--ig-${kebab(key)}`,
      value,
    ]),
    ["--ig-radius", brand.radius],
  ]);
}
export const brandStyles = (["light", "dark"] as Theme[])
  .map(
    (theme) =>
      `${theme === "light" ? ":root," : ""}[data-theme="${theme}"]{${Object.entries(
        brandVariables(theme),
      )
        .map(([key, value]) => `${key}:${value}`)
        .join(";")};color-scheme:${theme}}`,
  )
  .join("\n");
