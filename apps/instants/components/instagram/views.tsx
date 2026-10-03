"use client";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Grid3X3,
  Contact,
  Settings,
  ChevronDown,
  PenSquare,
  Phone,
  Video,
  Info,
  Smile,
  ArrowLeft,
  Layers3,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getCompany, type Thread } from "@/lib/data";
import { useSwipeGesture, prefersReducedMotion } from "@/lib/motion";
import { Avatar, Photo, Verified, getUser, mock, Post } from "./shared";

export function ExploreView({
  onOpen,
  onSearch,
}: {
  onOpen: (post: Post) => void;
  onSearch: () => void;
}) {
  const [category, setCategory] = useState("All work");
  const [query, setQuery] = useState("");
  const items = mock.explore.filter(
    (item) =>
      (category === "All work" || item.category === category) &&
      `${item.alt} ${item.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="explore-page">
      <div className="page-heading">
        <div>
          <h1>Explore</h1>
          <p>See what your teams are building, testing and sharing.</p>
        </div>
        <label className="search-field explore-search">
          <Search size={18} />
          <input
            placeholder="Search shared work"
            aria-label="Search shared work"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <button className="explore-people-search search-field" onClick={onSearch}>
        <Search size={18} />
        Search your teammates
      </button>
      <Tabs value={category} onValueChange={setCategory}>
        <TabsList className="category-tabs">
          {[
            "All work",
            ...new Set(mock.explore.map((item) => item.category)),
          ].map((item) => (
            <TabsTrigger key={item} value={item}>
              {item}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="explore-grid">
        {items.map((item, index) => (
          <button
            className={`explore-tile ${category === "All work" && index === 2 ? "tall" : ""}`}
            key={`${item.image}-${index}`}
            aria-label={`Open ${item.alt}`}
            onClick={() =>
              onOpen(
                mock.posts.find((post) => post.images.includes(item.image)) ??
                  mock.posts[0],
              )
            }
          >
            <Photo src={item.image} alt={item.alt} />
            {(mock.posts.find((post) => post.images.includes(item.image))
              ?.images.length ?? 0) > 1 && (
              <Layers3 className="tile-type" size={22} />
            )}
            <span className="tile-overlay">
              <Heart fill="white" size={22} />
              {item.likes}
              <MessageCircle fill="white" size={22} />
              {mock.posts.find((post) => post.images.includes(item.image))
                ?.commentCount ?? 0}
            </span>
          </button>
        ))}
      </div>
      {!items.length && (
        <div className="empty-state">
          <Search size={40} />
          <h2>No results found</h2>
          <p>Try a different word or category.</p>
        </div>
      )}
    </section>
  );
}

export function ProfileView({
  userId,
  posts,
  saved,
  following,
  onFollow,
  onOpen,
  onSaved,
  onEdit,
}: {
  userId: string;
  posts: Post[];
  saved: string[];
  following: string[];
  onFollow: () => void;
  onOpen: (post: Post) => void;
  onSaved: () => void;
  onEdit: () => void;
}) {
  const [tab, setTab] = useState("posts");
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: mock.currentUser.name,
    bio: mock.currentUser.bio,
  });
  const [draft, setDraft] = useState(profile);
  const user = getUser(userId);
  const own = userId === "you";
  const company = getCompany(user.companyId);
  const teammates =
    mock.users.filter(
      (person) => person.companyId === user.companyId && person.id !== user.id,
    ).length +
    (!own && mock.currentUser.companyIds.includes(user.companyId) ? 1 : 0);
  const selected =
    tab === "saved"
      ? posts.filter((post) => saved.includes(post.id))
      : tab === "tagged"
        ? posts.filter((post) => post.caption.includes(`@${user.username}`))
        : own
          ? posts.filter((post) => post.userId === "you")
          : posts.filter((post) => post.userId === userId);
  const gallery = selected;
  return (
    <section className="profile-page">
      <header className="profile-header">
        <Avatar user={user} size={150} ring />
        <div className="profile-details">
          <div className="profile-title">
            <h1>{user.username}</h1>
            {user.verified && <Verified />}
            {own ? (
              <>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setDraft(profile);
                    setEditing(true);
                  }}
                >
                  Edit profile
                </button>
                <button
                  className="icon-button"
                  aria-label="Appearance settings"
                  onClick={onEdit}
                >
                  <Settings size={22} />
                </button>
              </>
            ) : (
              <button
                className={
                  following.includes(userId)
                    ? "secondary-button"
                    : "primary-button"
                }
                onClick={onFollow}
              >
                {following.includes(userId) ? "Following" : "Follow"}
              </button>
            )}
          </div>
          <div className="profile-stats">
            <span>
              <strong>{gallery.length}</strong> posts
            </span>
            <span>
              <strong>{teammates}</strong> teammates
            </span>
            <span>
              <strong>{own ? mock.currentUser.companyIds.length : 1}</strong>{" "}
              {own ? "teams" : "team"}
            </span>
          </div>
          <strong>{own ? profile.name : user.name}</strong>
          <p className="profile-bio">
            {own
              ? profile.bio
              : `${user.role} at ${company?.name ?? "your team"}.\nSharing work, asking good questions and moving things forward.`}
          </p>
          <span className="profile-link">
            {user.role} · @{company?.handle}
          </span>
        </div>
      </header>
      <div className="highlights">
        {["Design reviews", "Testing", "Mobile flows", "Prototypes"].map(
          (label, index) => (
            <button
              key={label}
              onClick={() =>
                onOpen(
                  mock.posts.find((post) =>
                    post.images.includes(mock.explore[index].image),
                  ) ?? mock.posts[0],
                )
              }
            >
              <span>
                <Photo src={mock.explore[index].image} alt={label} />
              </span>
              <strong>{label}</strong>
            </button>
          ),
        )}
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" className="profile-tabs">
          <TabsTrigger value="posts">
            <Grid3X3 size={13} /> WORK
          </TabsTrigger>
          {own && (
            <TabsTrigger value="saved">
              <Bookmark size={13} /> SAVED
            </TabsTrigger>
          )}
          <TabsTrigger value="tagged">
            <Contact size={13} /> TAGGED
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="profile-grid">
        {gallery.map((post) => (
          <button
            key={post.id}
            onClick={() => onOpen(post)}
            aria-label={`Open ${post.alt}`}
          >
            <Photo src={post.images[0]} alt={post.alt} />
            <span className="tile-overlay">
              <Heart fill="white" />
              {post.likes.toLocaleString()}
            </span>
          </button>
        ))}
      </div>
      {!gallery.length && (
        <div className="empty-state">
          {tab === "saved" ? <Bookmark size={42} /> : <Contact size={42} />}
          <h2>
            {tab === "saved"
              ? "Keep useful work close"
              : tab === "tagged"
                ? "Work that mentions you"
                : "No shared work yet"}
          </h2>
          <p>
            {tab === "saved"
              ? "The posts you save will be collected here."
              : tab === "tagged"
                ? "Work that mentions you will appear here."
                : "Share a preview and ask your team for feedback."}
          </p>
          {tab === "saved" && (
            <button className="text-action" onClick={onSaved}>
              Browse your feed
            </button>
          )}
        </div>
      )}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="edit-profile-dialog">
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Help your teammates know what you work on.
          </DialogDescription>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setProfile(draft);
              setEditing(false);
            }}
          >
            <label>
              Name
              <input
                value={draft.name}
                required
                maxLength={60}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </label>
            <label>
              Bio
              <textarea
                value={draft.bio}
                maxLength={150}
                onChange={(event) =>
                  setDraft({ ...draft, bio: event.target.value })
                }
              />
            </label>
            <button className="primary-button" type="submit">
              Save changes
            </button>
            <p className="demo-message-note">
              Changes apply to this profile preview.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function MessagesView({
  onProfile,
  threads,
  onSend,
  onRead,
}: {
  onProfile: (id: string) => void;
  threads: Thread[];
  onSend: (userId: string, text: string) => boolean;
  onRead: (userId: string) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const thread = threads.find((item) => item.userId === active);
  const person = active ? getUser(active) : null;
  const [notice, setNotice] = useState("");
  useEffect(() => {
    bottom.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "instant" : "smooth",
      block: "nearest",
    });
  }, [threads, active]);
  function send() {
    if (!text.trim() || !active) return;
    if (onSend(active, text.trim())) setText("");
  }
  return (
    <section className={`messages-page ${active ? "has-conversation" : ""}`}>
      <aside className="inbox">
        <header>
          <h1>
            {mock.currentUser.username}
            <ChevronDown size={18} />
          </h1>
          <button
            className="icon-button"
            aria-label="New message"
            onClick={() => {
              setQuery("");
              setNotice("Choose someone below to start a conversation.");
            }}
          >
            <PenSquare />
          </button>
        </header>
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search messages"
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="inbox-label">
          <strong>Messages</strong>
          <span>{threads.filter((item) => item.unread).length} unread</span>
        </div>
        {notice && <p className="inline-notice">{notice}</p>}
        {threads
          .filter((item) =>
            getUser(item.userId)
              .name.toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((item) => {
            const user = getUser(item.userId);
            return (
              <button
                key={item.userId}
                className={`thread-row ${active === item.userId ? "selected" : ""}`}
                onClick={() => {
                  setActive(item.userId);
                  onRead(item.userId);
                  setNotice("");
                }}
              >
                <Avatar user={user} size={55} />
                <span>
                  <strong>{user.name}</strong>
                  <span>
                    {item.preview} · {item.time}
                  </span>
                </span>
                {item.unread && <i />}
              </button>
            );
          })}
      </aside>
      <div className="conversation">
        {person && thread ? (
          <>
            <header className="conversation-header">
              <button
                className="icon-button back-to-inbox"
                aria-label="Back to inbox"
                onClick={() => setActive(null)}
              >
                <ArrowLeft />
              </button>
              <button onClick={() => onProfile(person.id)}>
                <Avatar user={person} size={40} />
              </button>
              <button
                className="conversation-person"
                onClick={() => onProfile(person.id)}
              >
                <strong>{person.name}</strong>
                <span>
                  {person.role} · {getCompany(person.companyId)?.name}
                </span>
              </button>
              <button
                className="icon-button"
                aria-label="Audio call"
                onClick={() =>
                  setNotice(
                    "Calls are not connected in this collaboration preview.",
                  )
                }
              >
                <Phone />
              </button>
              <button
                className="icon-button"
                aria-label="Video call"
                onClick={() =>
                  setNotice(
                    "Video calls are not connected in this collaboration preview.",
                  )
                }
              >
                <Video />
              </button>
              <button
                className="icon-button"
                aria-label="View profile"
                onClick={() => onProfile(person.id)}
              >
                <Info />
              </button>
            </header>
            {notice && <p className="inline-notice">{notice}</p>}
            <div className="message-history">
              <div className="conversation-intro">
                <Avatar user={person} size={90} />
                <h2>{person.name}</h2>
                <p>
                  {person.username} · {getCompany(person.companyId)?.name}
                </p>
                <button
                  className="secondary-button"
                  onClick={() => onProfile(person.id)}
                >
                  View profile
                </button>
              </div>
              <p className="message-date">Team conversation</p>
              {thread.messages.map((message, index) => (
                <div
                  key={index}
                  className={`message-bubble ${message.mine ? "mine" : "theirs"}`}
                >
                  {message.text}
                </div>
              ))}
              <div ref={bottom} />
            </div>
            <form
              className="message-input"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <button
                type="button"
                className="icon-button"
                aria-label="Insert smile emoji"
                onClick={() =>
                  setText((current) => (current + " 🙂").slice(0, 4000))
                }
              >
                <Smile />
              </button>
              <input
                placeholder="Reply or share an update…"
                maxLength={4000}
                aria-label="Message"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
              <button
                type="submit"
                className="text-action"
                disabled={!text.trim()}
              >
                Send
              </button>
            </form>
            <p className="demo-message-note">
              Replies are saved in this session.
            </p>
          </>
        ) : (
          <div className="empty-state message-empty">
            <div className="outlined-icon">
              <Send size={43} />
            </div>
            <h2>Your messages</h2>
            <p>
              Reply to a teammate, ask a question or share work in progress.
            </p>
            <button
              className="primary-button"
              disabled={!threads.length}
              onClick={() => {
                if (!threads[0]) return;
                setActive(threads[0].userId);
                onRead(threads[0].userId);
              }}
            >
              Send message
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export function ReelsView({ onOpen }: { onOpen: (post: Post) => void }) {
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const item = mock.explore[index];
  const sourcePost =
    mock.posts.find((post) => post.images.includes(item.image)) ??
    mock.posts[0];
  const user = getUser(sourcePost.userId);
  function advance(delta: number) {
    setIndex(
      (current) =>
        (current + delta + mock.explore.length) % mock.explore.length,
    );
    setLiked(false);
  }
  const gesture = useSwipeGesture({
    onUp: () => advance(1),
    onDown: () => advance(-1),
  });
  return (
    <section className="reels-page">
      <div className="reel-player" {...gesture}>
        <Photo key={item.image} src={item.image} alt={item.alt} />
        <div className="reel-top">
          <strong>Work previews</strong>
          <span>Prototype preview</span>
        </div>
        <div className="reel-gradient" />
        <div className="reel-copy">
          <div>
            <Avatar user={user} size={34} />
            <strong>{user.username}</strong>
            <Verified />
          </div>
          <p>{item.alt}. Leave a thought to help the team move forward.</p>
          <span>
            {item.category} · @{getCompany(sourcePost.companyId)?.handle}
          </span>
        </div>
      </div>
      <div className="reel-actions">
        <button
          className={`icon-button ${liked ? "liked" : ""}`}
          aria-label="Like work preview"
          aria-pressed={liked}
          onClick={() => setLiked(!liked)}
        >
          <Heart fill={liked ? "currentColor" : "none"} />
        </button>
        <small>{item.likes}</small>
        <button
          className="icon-button"
          aria-label="Review this work"
          onClick={() => onOpen(sourcePost)}
        >
          <MessageCircle />
        </button>
        <small>{sourcePost.commentCount}</small>
        <button
          className="icon-button"
          aria-label="Next work preview"
          onClick={() => advance(1)}
        >
          <ChevronDown />
        </button>
        <small>Next</small>
      </div>
    </section>
  );
}
