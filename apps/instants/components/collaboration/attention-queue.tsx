"use client";
import { useState } from "react";
import {
  AtSign,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Plus,
  Send,
  ClipboardCheck,
  ArrowUpRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, Photo } from "@/components/instagram/shared";
import {
  getCompany,
  getUser,
  mock,
  type AttentionKind,
  type Post,
  type QueueItem,
} from "@/lib/data";
import { useSwipeGesture } from "@/lib/motion";
import "./collaboration.css";

const kinds = {
  dm: { label: "DM", plural: "DMs", icon: Send },
  comment: { label: "Comment", plural: "Comments", icon: MessageCircle },
  mention: { label: "Mention", plural: "Mentions", icon: AtSign },
  review: { label: "Review", plural: "Reviews", icon: ClipboardCheck },
};

export function AttentionQueue({
  items,
  onOpen,
  onCreate,
}: {
  items: QueueItem[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const [category, setCategory] = useState<"all" | AttentionKind>("all");
  const [showReplied, setShowReplied] = useState(false);
  const pending = items.filter((item) => !item.resolved);
  const visible = items.filter(
    (item) =>
      (showReplied || !item.resolved) &&
      (category === "all" || item.kind === category),
  );
  return (
    <section className="attention-queue" aria-label="Reply queue">
      <div className="attention-heading">
        <h2>
          Needs your reply <span>{pending.length}</span>
        </h2>
        <button
          onClick={() => setShowReplied(!showReplied)}
          aria-pressed={showReplied}
        >
          {showReplied ? "Pending only" : "Show completed"}
        </button>
      </div>
      <div
        className="attention-categories"
        role="group"
        aria-label="Filter reply queue"
      >
        <button
          aria-pressed={category === "all"}
          onClick={() => setCategory("all")}
        >
          All
        </button>
        {(Object.keys(kinds) as AttentionKind[]).map((kind) => (
          <button
            key={kind}
            aria-pressed={category === kind}
            onClick={() => setCategory(kind)}
          >
            {kinds[kind].plural}
            <span>{pending.filter((item) => item.kind === kind).length}</span>
          </button>
        ))}
      </div>
      <div className="stories attention-people">
        <button className="story your-story" onClick={onCreate}>
          <span className="own-story-wrap">
            <Avatar user={mock.currentUser} size={64} />
            <span className="add-story">
              <Plus size={13} />
            </span>
          </span>
          <span>Ask team</span>
          <small>Share work</small>
        </button>
        {visible.map((item) => {
          const user = getUser(item.userId),
            KindIcon = kinds[item.kind].icon;
          return (
            <button
              className={`story attention-person ${item.resolved ? "is-replied" : ""}`}
              key={item.id}
              data-queue-id={item.id}
              onClick={() => onOpen(item.id)}
              aria-label={`${user.name}: ${kinds[item.kind].label} — ${item.title}`}
            >
              <span className="attention-avatar">
                <Avatar user={user} size={66} ring seen={item.resolved} />
                <span
                  className={`attention-type ${item.priority === "urgent" && !item.resolved ? "urgent" : ""}`}
                >
                  {item.resolved ? <Check size={12} /> : <KindIcon size={12} />}
                </span>
              </span>
              <span>{user.name.split(" ")[0]}</span>
              <small>
                {item.resolved
                  ? item.replies.length
                    ? "Replied"
                    : "Done"
                  : kinds[item.kind].label}
              </small>
            </button>
          );
        })}
        {!visible.length && (
          <div className="attention-empty">
            <Check size={20} />
            <span>
              {pending.length
                ? "No requests in this category."
                : "Nothing waiting on you."}
              <small>You’re up to date.</small>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

export function QueueReplyDialog({
  item,
  items,
  posts,
  onClose,
  onOpen,
  onReply,
  onResolve,
  onOpenPost,
}: {
  item: QueueItem;
  items: QueueItem[];
  posts: Post[];
  onClose: () => void;
  onOpen: (id: string) => void;
  onReply: (item: QueueItem, text: string) => boolean;
  onResolve: (item: QueueItem, resolved: boolean) => void;
  onOpenPost: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const user = getUser(item.userId),
    company = getCompany(item.companyId),
    KindIcon = kinds[item.kind].icon;
  const index = items.findIndex((entry) => entry.id === item.id);
  const move = (delta: number) => {
    const next = items[index + delta];
    if (next) onOpen(next.id);
  };
  const gesture = useSwipeGesture({
    onLeft: () => move(1),
    onRight: () => move(-1),
    onDown: onClose,
  });
  const post = posts.find((post) => post.id === item.postId);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="attention-dialog">
        <div className="attention-swipe-zone" {...gesture}>
          <div className="attention-dialog-topline">
            <span>
              <KindIcon size={14} />
              {kinds[item.kind].label}
            </span>
            <span className={item.resolved ? "resolved" : "waiting"}>
              {item.resolved
                ? item.replies.length
                  ? "Replied"
                  : "Done"
                : item.priority === "urgent"
                  ? "Needs you now"
                  : "Awaiting your reply"}
            </span>
          </div>
          <header className="attention-person-header">
            <Avatar user={user} size={46} ring seen={item.resolved} />
            <div>
              <DialogTitle>Reply to {user.name.split(" ")[0]}</DialogTitle>
              <DialogDescription>
                @{company?.handle} · {user.role}
              </DialogDescription>
            </div>
          </header>
        </div>
        <div className="attention-context">
          <p className="attention-time">
            {item.time} · Only visible in your session
          </p>
          <h2>{item.title}</h2>
          {post && (
            <button
              className="attention-post-link"
              onClick={() => onOpenPost(post.id)}
            >
              <Photo src={post.images[0]} alt={post.alt} />
              <span>
                <small>
                  {post.workType} · @{company?.handle}
                </small>
                <strong>{post.instant?.title || post.caption}</strong>
              </span>
              <ArrowUpRight size={18} />
            </button>
          )}
          <div
            className="attention-conversation"
            aria-label="Request conversation"
          >
            {(item.messages.length
              ? item.messages
              : [{ mine: false, text: item.preview }]
            ).map((message, i) => (
              <p
                key={`seed-${i}`}
                className={`attention-bubble ${message.mine ? "mine" : ""}`}
              >
                {message.text}
              </p>
            ))}
            {item.replies.map((message, i) => (
              <p key={`reply-${i}`} className="attention-bubble mine">
                {message.text}
              </p>
            ))}
          </div>
        </div>
        <form
          className="attention-reply"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim() && onReply(item, text.trim())) setText("");
          }}
        >
          <label className="sr-only" htmlFor="queue-reply">
            Your reply
          </label>
          <textarea
            id="queue-reply"
            aria-label="Your reply"
            placeholder={`Reply to ${user.name.split(" ")[0]}…`}
            value={text}
            maxLength={4000}
            onChange={(event) => setText(event.target.value)}
            rows={2}
          />
          <button
            className="primary-button"
            disabled={!text.trim()}
            type="submit"
          >
            <Send size={15} /> Send reply
          </button>
        </form>
        <footer className="attention-dialog-footer">
          <button
            className="attention-resolve"
            onClick={() => onResolve(item, !item.resolved)}
          >
            <Check size={15} />
            {item.resolved ? "Reopen request" : "Mark as done"}
          </button>
          <div>
            <button
              className="icon-button"
              aria-label="Previous request"
              disabled={index <= 0}
              onClick={() => move(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {index + 1} / {items.length}
            </span>
            <button
              className="icon-button"
              aria-label="Next request"
              disabled={index >= items.length - 1}
              onClick={() => move(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
