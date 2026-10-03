import { appPath } from "@/lib/base-path";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { DEMO } from "@/lib/mode";

// The Innernet Field Guide used to live here. It is now the second half of the home
// page (components/guide/field-guide.tsx), so old links are sent on to /#guide for good.
// The guide's own title and description are kept, for whatever reads this address.

export const metadata: Metadata = {
  title: { absolute: "The Innernet Field Guide" },
  description: DEMO
    ? "How the folders on your machine become a search engine and an encyclopedia, and how to add to both."
    : "How the folders on this machine become a search engine and an encyclopedia, and how to add to both.",
  alternates: { canonical: appPath("/#guide") },
};

export const dynamic = "force-dynamic";

export default function GuidePage(): never {
  permanentRedirect("/#guide");
}
