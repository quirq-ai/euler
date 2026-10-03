"use client";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Camera } from "lucide-react";
import { brand } from "@/lib/brand";
export { mock, getUser, getCompany } from "@/lib/data";
export type { User, Instant, Post } from "@/lib/data";
export function Photo({
  src,
  alt,
  className = "",
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // A cached failure can precede hydration, before React attaches onError.
    if (image.current?.complete && image.current.naturalWidth === 0)
      setFailedSrc(src);
  }, [src]);
  return failedSrc === src ? (
    <div className={`photo-fallback ${className}`} role="img" aria-label={alt}>
      <Camera size={30} />
      <span>{alt}</span>
    </div>
  ) : (
    <img
      ref={image}
      src={src}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailedSrc(src)}
    />
  );
}
export function Avatar({
  user,
  size = 44,
  ring = false,
  seen = false,
}: {
  user: { avatar: string; username: string };
  size?: number;
  ring?: boolean;
  seen?: boolean;
}) {
  return (
    <span
      className={`avatar ${ring ? "avatar-ring" : ""} ${seen ? "seen" : ""}`}
      style={{ width: size, height: size }}
    >
      <Photo src={user.avatar} alt={`${user.username}'s profile photo`} eager />
    </span>
  );
}
export function Verified() {
  return (
    <BadgeCheck
      className="verified"
      size={14}
      fill="currentColor"
      strokeWidth={2.5}
    />
  );
}
export function Wordmark() {
  return brand.logo.image ? (
    <img className="brand-image" src={brand.logo.image} alt={brand.name} />
  ) : (
    <span className="wordmark">{brand.logo.text}</span>
  );
}

export function PoweredBy({ className = "" }: { className?: string }) {
  return (
    <span className={`powered-by ${className}`}>
      <span>{brand.poweredBy.label}</span>
      <img
        src={brand.poweredBy.logo}
        alt={brand.poweredBy.name}
        width={42}
        height={17}
      />
    </span>
  );
}

export function HomeIcon({
  size = 24,
  strokeWidth = 1.8,
  fill = "none",
}: {
  size?: number;
  strokeWidth?: number;
  fill?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 3 10.5V21h6v-7h6v7h6V10.5L12 3Z" />
    </svg>
  );
}
