"use client";
import { useEffect, useRef, useState } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Smile,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, Verified, Post, getUser, getCompany } from "./shared";
import { InstantResponse } from "./instant-response";
import { MotionCarousel } from "@/components/motion/carousel";
import { motion } from "@/lib/motion";
export default function PostCard({
  post,
  liked,
  saved,
  onLike,
  onSave,
  onComment,
  onShare,
  onProfile,
  response,
  expiresAt,
  onRespond,
}: {
  post: Post;
  liked: boolean;
  saved: boolean;
  onLike: () => void;
  onSave: () => void;
  onComment: (text?: string) => boolean;
  onShare: () => void;
  onProfile: (id: string) => void;
  response?: string;
  expiresAt?: number;
  onRespond: (option: string) => void;
}) {
  const user = getUser(post.userId);
  const company = getCompany(post.companyId ?? user.companyId);
  const [comment, setComment] = useState("");
  const [burst, setBurst] = useState(false);
  const [burstVersion, setBurstVersion] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (burstTimer.current) clearTimeout(burstTimer.current);
    },
    [],
  );
  return (
    <article className="post-card">
      <header className="post-header">
        <button
          onClick={() => onProfile(user.id)}
          aria-label={`View ${user.username}'s profile`}
        >
          <Avatar user={user} size={38} ring />
        </button>
        <div className="post-identity">
          <div>
            <button className="username" onClick={() => onProfile(user.id)}>
              {user.username}
            </button>
            {user.verified && <Verified />}
            <span className="post-time">· {post.time}</span>
          </div>
          {company ? (
            <span
              className="post-location team-post-label"
              title={post.location}
            >
              <i aria-hidden="true" style={{ background: company.color }} />
              {company.handle}
            </span>
          ) : (
            <span className="post-location">{post.location}</span>
          )}
        </div>
        {post.workType && (
          <span className="team-work-kind">{post.workType}</span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="icon-button"
              aria-label={`More options for ${user.username}'s post`}
            >
              <MoreHorizontal size={23} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="ig-menu" align="end">
            <DropdownMenuItem onClick={onSave}>
              {saved ? "Remove from saved" : "Save post"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShare}>Share post</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onProfile(user.id)}>
              About this account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div
        className={`post-media ${post.images.every((image) => image.startsWith("/work/")) ? "work-preview-media" : ""}`}
      >
        <MotionCarousel
          images={post.images}
          alt={post.alt}
          onDoubleTap={() => {
            if (!liked) onLike();
            setBurst(true);
            setBurstVersion((version) => version + 1);
            if (burstTimer.current) clearTimeout(burstTimer.current);
            burstTimer.current = setTimeout(
              () => setBurst(false),
              motion.durations.like,
            );
          }}
        >
          {burst && (
            <Heart
              key={burstVersion}
              className="heart-burst"
              size={100}
              fill="white"
              stroke="white"
            />
          )}
        </MotionCarousel>
      </div>
      {post.instant && (
        <InstantResponse
          instant={post.instant}
          selected={response}
          expiresAt={expiresAt}
          onRespond={onRespond}
        />
      )}
      <div className="post-actions">
        <div className="post-action-group">
          <button
            className={`icon-button ${liked ? "liked" : ""}`}
            aria-label={liked ? "Unlike post" : "Like post"}
            aria-pressed={liked}
            onClick={onLike}
          >
            <Heart fill={liked ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-button"
            aria-label="View comments"
            onClick={() => onComment()}
          >
            <MessageCircle />
          </button>
          <button
            className="icon-button"
            aria-label="Share post"
            onClick={onShare}
          >
            <Send />
          </button>
        </div>
        <button
          className="icon-button save-action"
          aria-label={saved ? "Unsave post" : "Save post"}
          aria-pressed={saved}
          onClick={onSave}
        >
          <Bookmark fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="post-copy">
        <button className="likes-count" onClick={() => onComment()}>
          {(post.likes + (liked ? 1 : 0)).toLocaleString("en-US")} likes
        </button>
        <p className="caption">
          <button className="username" onClick={() => onProfile(user.id)}>
            {user.username}
          </button>{" "}
          {post.caption}{" "}
          {!expanded && (
            <button className="muted" onClick={() => setExpanded(true)}>
              more
            </button>
          )}
          {expanded && <span className="hashtags">{post.tags}</span>}
        </p>
        <button className="view-comments" onClick={() => onComment()}>
          View all {post.commentCount} comments
        </button>
        <form
          className="comment-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (comment.trim() && onComment(comment.trim())) {
              setComment("");
            }
          }}
        >
          <input
            aria-label="Add a comment"
            placeholder="Add a comment…"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          {comment && (
            <button className="text-action" type="submit">
              Post
            </button>
          )}
          <button
            type="button"
            className="icon-button comment-emoji"
            aria-label="Add smile emoji"
            onClick={() => setComment(comment + " 🤍")}
          >
            <Smile size={14} />
          </button>
        </form>
      </div>
    </article>
  );
}
