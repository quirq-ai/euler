import type { Metadata } from "next";
import { MotionLab } from "@/components/motion/motion-lab";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Motion lab · ${brand.name}`,
  description: `An interactive playground for the small movements that make ${brand.name} feel natural.`,
};

export default function MotionPage() {
  return <MotionLab />;
}
