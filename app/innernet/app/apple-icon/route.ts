import AppleIcon from "@/components/apple-icon";

// Keep the existing /apple-icon endpoint, but declare its URL in layout metadata.
// Next 16.3's generated apple-icon metadata drops basePath in Turbopack builds.
export const dynamic = "force-static";
export const GET = AppleIcon;
