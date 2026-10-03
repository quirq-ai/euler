import type { Metadata } from "next";
import { brand, brandStyles } from "@/lib/brand";
import { motionStyles } from "@/lib/motion-tokens";
import "./globals.css";
const icon =
  brand.favicon ||
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${brand.colors.highlight}"/><rect x="14" y="14" width="36" height="36" rx="11" fill="none" stroke="${brand.colors.onAction}" stroke-width="4"/><circle cx="32" cy="32" r="9" fill="none" stroke="${brand.colors.onAction}" stroke-width="4"/><circle cx="43" cy="21" r="3" fill="${brand.colors.onAction}"/></svg>`)}`;
export const metadata: Metadata = {
  title: brand.name,
  description: brand.description,
  icons: { icon },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme={brand.defaultTheme} suppressHydrationWarning>
      <head>
        {brand.fontStylesheet && (
          <link rel="stylesheet" href={brand.fontStylesheet} />
        )}
        <style
          dangerouslySetInnerHTML={{ __html: brandStyles + motionStyles }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('ig-ui-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch{}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
