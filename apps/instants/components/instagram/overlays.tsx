"use client";
import { useEffect, useRef, useState } from "react";
import { Search, Heart, X, ImagePlus, Check, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, Photo, Verified, getUser, mock, Post } from "./shared";
import { toast } from "sonner";
import { InstantResponse } from "./instant-response";
import { type QueueItem } from "@/lib/data";
import { MotionCarousel } from "@/components/motion/carousel";

export function SidePanel({
  panel,
  onClose,
  onProfile,
  attention,
  onOpenQueue,
}: {
  panel: string | null;
  onClose: () => void;
  onProfile: (id: string) => void;
  attention: QueueItem[];
  onOpenQueue: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const pending = attention.filter((item) => !item.resolved);
  const users = mock.users.filter((user) =>
    `${user.username} ${user.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Sheet
      open={!!panel}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="left" className="ig-side-panel">
        <SheetTitle className="panel-title">{panel}</SheetTitle>
        <SheetDescription className="sr-only">
          {panel === "Search"
            ? "Find people and discover accounts"
            : "Pending replies, mentions and reviews from your teams"}
        </SheetDescription>
        {panel === "Search" ? (
          <>
            <label className="search-field">
              <Search size={18} />
              <input
                aria-label="Search accounts"
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
              />
              {query && (
                <button aria-label="Clear search" onClick={() => setQuery("")}>
                  <X size={15} />
                </button>
              )}
            </label>
            <h3>{query ? "Search results" : "Discover people"}</h3>
            <div className="search-results">
              {users.map((user) => (
                <button
                  key={user.id}
                  className="search-result"
                  onClick={() => {
                    onProfile(user.id);
                    onClose();
                  }}
                >
                  <Avatar user={user} size={47} />
                  <span>
                    <strong>
                      {user.username}
                      {user.verified && <Verified />}
                    </strong>
                    <span>{user.name}</span>
                  </span>
                </button>
              ))}
              {!users.length && (
                <p className="no-results">
                  No accounts found. Try another name.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="activity-list">
            <h3>Needs your reply</h3>
            {pending.map((item) => {
              const user = getUser(item.userId);
              const kindLabel = {
                dm: "Direct message",
                comment: "Comment",
                mention: "Mention",
                review: "Review request",
              }[item.kind];
              return (
                <div className="activity-row" key={item.id}>
                  <button
                    aria-label={`View ${user.name}'s profile`}
                    onClick={() => {
                      onProfile(user.id);
                      onClose();
                    }}
                  >
                    <Avatar user={user} size={44} />
                  </button>
                  <p>
                    <strong>{user.name}</strong> {item.title}
                    <span>
                      {kindLabel} · {item.time}
                    </span>
                  </p>
                  <button
                    className="secondary-button"
                    aria-label={`Open request from ${user.name}`}
                    onClick={() => {
                      onClose();
                      onOpenQueue(item.id);
                    }}
                  >
                    Reply
                  </button>
                </div>
              );
            })}
            {!pending.length && (
              <div className="empty-state">
                <Check size={32} />
                <h3>You’re all caught up</h3>
                <p>New requests from your teams will appear here.</p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function PostDialog({
  post,
  onClose,
  comments,
  onAdd,
  liked,
  onLike,
  response,
  expiresAt,
  onRespond,
}: {
  post: Post | null;
  onClose: () => void;
  comments: { userId: string; text: string }[];
  onAdd: (text: string) => boolean;
  liked: boolean;
  onLike: () => void;
  response?: string;
  expiresAt?: number;
  onRespond: (option: string) => void;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText("");
  }, [post?.id]);
  if (!post) return null;
  const user = getUser(post.userId);
  return (
    <Dialog
      open={!!post}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="post-dialog">
        <DialogTitle className="sr-only">Post by {user.username}</DialogTitle>
        <DialogDescription className="sr-only">
          {post.alt}. Read and add comments.
        </DialogDescription>
        <div className="dialog-photo">
          <MotionCarousel
            key={post.id}
            images={post.images}
            alt={post.alt}
            onDoubleTap={() => {
              if (!liked) onLike();
            }}
          />
        </div>
        <div className="dialog-discussion">
          <header>
            <Avatar user={user} size={34} />
            <strong>{user.username}</strong>
            {user.verified && <Verified />}
          </header>
          <div className="dialog-comments">
            {post.instant && (
              <InstantResponse
                instant={post.instant}
                selected={response}
                expiresAt={expiresAt}
                onRespond={onRespond}
              />
            )}
            <div className="comment-row">
              <Avatar user={user} size={32} />
              <p>
                <strong>{user.username}</strong> {post.caption}
                <span>{post.time}</span>
              </p>
            </div>
            {[...post.comments, ...comments].map((comment, index) => (
              <div className="comment-row" key={index}>
                <Avatar user={getUser(comment.userId)} size={32} />
                <p>
                  <strong>{getUser(comment.userId).username}</strong>{" "}
                  {comment.text}
                  <span>
                    {index < post.comments.length ? "1h" : "Just now"} · Reply
                  </span>
                </p>
                <Heart size={12} />
              </div>
            ))}
          </div>
          <div className="dialog-likes">
            <button
              className={`icon-button ${liked ? "liked" : ""}`}
              aria-label={liked ? "Unlike post" : "Like post"}
              aria-pressed={liked}
              onClick={onLike}
            >
              <Heart fill={liked ? "currentColor" : "none"} />
            </button>
            <strong>
              {(post.likes + (liked ? 1 : 0)).toLocaleString()} likes
            </strong>
            <span>{post.time} ago</span>
          </div>
          <form
            className="dialog-comment-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (text.trim() && onAdd(text.trim())) setText("");
            }}
          >
            <input
              aria-label="Write a comment"
              placeholder="Add a comment…"
              value={text}
              maxLength={4000}
              onChange={(event) => setText(event.target.value)}
            />
            <button
              type="submit"
              className="text-action"
              disabled={!text.trim()}
            >
              Post
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CreateDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (image: string, caption: string) => boolean;
}) {
  const [image, setImage] = useState("");
  const [caption, setCaption] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) {
      setImage("");
      setCaption("");
    }
  }, [open]);
  function readFile(selected?: File) {
    if (!selected) return;
    if (
      ![
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "image/avif",
      ].includes(selected.type)
    ) {
      toast.error("Choose a PNG, JPEG, WebP, GIF or AVIF image.");
      return;
    }
    if (selected.size > 1024 * 1024) {
      toast.error("Choose an image no larger than 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setImage(reader.result);
    };
    reader.onerror = () =>
      toast.error("This image could not be read. Try another file.");
    reader.readAsDataURL(selected);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="create-dialog">
        <DialogTitle className="dialog-title">Share work</DialogTitle>
        <DialogDescription className="sr-only">
          Choose a work preview and describe the feedback you need. Your post
          will appear in your team’s feed.
        </DialogDescription>
        {!image ? (
          <div
            className="upload-area"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              readFile(event.dataTransfer.files[0]);
            }}
          >
            <div className="upload-icon">
              <ImagePlus size={62} strokeWidth={1.2} />
            </div>
            <h2>Good work starts a conversation</h2>
            <p>Drop a screenshot or work preview here</p>
            <button
              className="primary-button"
              onClick={() => file.current?.click()}
            >
              Select from computer
            </button>
            <span>or use a sample from your team’s work</span>
            <div className="sample-photos">
              {mock.explore.slice(0, 3).map((item) => (
                <button
                  key={item.image}
                  aria-label={`Select ${item.alt}`}
                  onClick={() => setImage(item.image)}
                >
                  <Photo src={item.image} alt={item.alt} />
                </button>
              ))}
            </div>
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              hidden
              onChange={(event) => {
                readFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
        ) : (
          <>
            <div className="create-preview">
              <Photo src={image} alt="Work preview to share" />
            </div>
            <div className="create-caption">
              <Avatar user={mock.currentUser} size={30} />
              <strong>{mock.currentUser.username}</strong>
              <textarea
                maxLength={2200}
                placeholder="What are you working on, and what needs a reply?"
                aria-label="Write a caption"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
              />
              <div>
                <button className="text-action" onClick={() => setImage("")}>
                  Change preview
                </button>
                <span>{caption.length}/2,200</span>
              </div>
            </div>
            <button
              className="primary-button create-share"
              onClick={() => {
                if (onCreate(image, caption)) onClose();
              }}
            >
              Share to your feed
            </button>
            <p className="demo-message-note">
              Request feedback with a 30-minute response window.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ShareDialog({
  post,
  onClose,
  onSend,
}: {
  post: Post | null;
  onClose: () => void;
  onSend: (ids: string[], post: Post) => boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    setSelected([]);
    setQuery("");
  }, [post?.id]);
  return (
    <Dialog
      open={!!post}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="share-dialog">
        <DialogTitle className="dialog-title">Share</DialogTitle>
        <DialogDescription className="sr-only">
          Choose people or copy a link to this post.
        </DialogDescription>
        <label className="search-field">
          <Search size={17} />
          <input
            placeholder="Search people"
            aria-label="Search people to share with"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="share-people">
          {mock.users
            .filter((user) =>
              user.name.toLowerCase().includes(query.toLowerCase()),
            )
            .slice(0, 6)
            .map((user) => (
              <button
                className="search-result"
                key={user.id}
                onClick={() =>
                  setSelected(
                    selected.includes(user.id)
                      ? selected.filter((id) => id !== user.id)
                      : [...selected, user.id],
                  )
                }
              >
                <Avatar user={user} size={44} />
                <span>
                  <strong>{user.name}</strong>
                  <span>{user.username}</span>
                </span>
                <i className={selected.includes(user.id) ? "checked" : ""}>
                  {selected.includes(user.id) && <Check size={14} />}
                </i>
              </button>
            ))}
        </div>
        <div className="share-footer">
          <button
            className="secondary-button"
            onClick={async () => {
              try {
                if (!mock.posts.some((item) => item.id === post?.id)) {
                  toast(
                    "This post is only available in your current preview session.",
                  );
                  return;
                }
                await navigator.clipboard.writeText(
                  `${window.location.origin}/?post=${post?.id}`,
                );
                toast("Link copied");
              } catch {
                toast.error("Clipboard isn't available in this browser.");
              }
            }}
          >
            <Copy size={16} /> Copy link
          </button>
          <button
            className="primary-button"
            disabled={!selected.length}
            onClick={() => {
              if (!post || !onSend(selected, post)) return;
              toast(
                `Shared with ${selected.length} ${selected.length === 1 ? "person" : "people"} in this session`,
              );
              onClose();
            }}
          >
            Send
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
