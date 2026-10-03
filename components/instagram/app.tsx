"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Search,
  Compass,
  Clapperboard,
  Send,
  Heart,
  SquarePlus,
  Menu,
  Zap,
  Moon,
  Sun,
  ChevronRight,
  Download,
  Bookmark,
  Check,
} from "lucide-react";
import { Sidebar, SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster, toast } from "sonner";
import { brand, Theme } from "@/lib/brand";
import {
  HomeIcon,
  Avatar,
  Wordmark,
  PoweredBy,
  Verified,
  mock,
  Post,
} from "./shared";
import PostCard from "./post-card";
import { ExploreView, ProfileView, MessagesView, ReelsView } from "./views";
import { SidePanel, PostDialog, CreateDialog, ShareDialog } from "./overlays";
import { useThemeTool } from "./use-theme-tool";
import { scrollToTop } from "@/lib/motion";
import { useClientReady } from "@/hooks/use-client-ready";
import { useSession } from "@/hooks/use-session";
import {
  AttentionQueue,
  QueueReplyDialog,
} from "@/components/collaboration/attention-queue";
import { getCompany } from "@/lib/data";

const nav = [
  { name: "Home", icon: HomeIcon },
  { name: "Search", icon: Search },
  { name: "Explore", icon: Compass },
  { name: "Reels", icon: Clapperboard },
  { name: "Messages", icon: Send },
  { name: "Notifications", icon: Heart },
  { name: "Create", icon: SquarePlus },
];
export default function InstantsApp() {
  const hydrated = useClientReady();
  const activity = useSession();
  const ready = hydrated && activity.ready;
  const {
    liked,
    saved,
    following,
    allPosts,
    comments,
    threads,
    responses,
    deadlines,
    attention,
  } = activity.state;
  const record = activity.record;
  useEffect(() => {
    if (activity.error)
      toast.error(activity.error, { id: "session-error", duration: 8000 });
    else toast.dismiss("session-error");
  }, [activity.error]);
  const [theme, setTheme] = useState<Theme>(brand.defaultTheme as Theme);
  const [view, setView] = useState("Home");
  const [feed, setFeed] = useState("all");
  const [panel, setPanel] = useState<string | null>(null);
  const [queueId, setQueueId] = useState<string | null>(null);
  const queueItem = attention.find((item) => item.id === queueId);
  const teamQueue = attention.filter(
    (item) => feed === "all" || item.companyId === feed,
  );
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [creating, setCreating] = useState(false);
  const [profileId, setProfileId] = useState("you");
  const scrollPositions = useRef<Record<string, number>>({});
  const viewKey = view === "Profile" ? `Profile:${profileId}` : view;
  const restoredView = useRef(viewKey);
  useLayoutEffect(() => {
    if (restoredView.current === viewKey) return;
    restoredView.current = viewKey;
    window.scrollTo({
      top: scrollPositions.current[viewKey] ?? 0,
      behavior: "instant",
    });
  }, [viewKey]);
  function showView(name: string, account = "you", reset = false) {
    const nextKey = name === "Profile" ? `Profile:${account}` : name;
    if (nextKey === viewKey) {
      scrollToTop();
      return;
    }
    scrollPositions.current[viewKey] = window.scrollY;
    if (reset) scrollPositions.current[nextKey] = 0;
    if (name === "Profile") setProfileId(account);
    setView(name);
  }
  function respond(post: Post, option: string) {
    if (
      !post.instant?.options.some((item) => item.id === option) ||
      (deadlines[post.id] && deadlines[post.id] <= Date.now())
    )
      return;
    record({
      type: "post.respond",
      data: { postId: post.id, optionId: option },
    });
  }
  const openedDeepLink = useRef(false);
  useEffect(() => {
    if (!ready || openedDeepLink.current) return;
    openedDeepLink.current = true;
    const id = new URLSearchParams(window.location.search).get("post");
    const post = allPosts.find((item) => item.id === id);
    if (post) setActivePost(post);
  }, [ready, allPosts]);
  useEffect(() => {
    setTheme(
      document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    );
  }, []);
  function applyTheme(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("ig-ui-theme", next);
    } catch {}
  }
  function switchTheme() {
    applyTheme(theme === "light" ? "dark" : "light");
  }
  useThemeTool(applyTheme);
  const follow = (userId: string) =>
    record({
      type: "person.follow",
      data: { userId, following: !following.includes(userId) },
    });
  const like = (postId: string) =>
    record({
      type: "post.like",
      data: { postId, liked: !liked.includes(postId) },
    });
  function navigate(name: string) {
    if (name === "Search" || name === "Notifications") {
      setPanel(name);
      return;
    }
    if (name === "Create") {
      setCreating(true);
      return;
    }
    showView(name);
  }
  function openProfile(id: string) {
    showView("Profile", id);
  }
  function addComment(postId: string, text: string) {
    return record({ type: "post.comment", data: { postId, text } });
  }
  const dockView = panel === "Search" || view === "Explore" ? "Search" : view;
  const posts = allPosts
    .filter((post) => view !== "Saved" || saved.includes(post.id))
    .filter(
      (post) => view === "Saved" || feed === "all" || post.companyId === feed,
    );
  return (
    <SidebarProvider
      className="ig-app"
      inert={!ready}
      aria-busy={!ready}
      data-app-ready={ready}
      data-session-mode={activity.mode}
      data-session-status={activity.status}
    >
      <Sidebar collapsible="none" className="ig-sidebar">
        <button
          className="brand"
          aria-label={`${brand.name} home`}
          onClick={() => navigate("Home")}
        >
          <Wordmark />
          <Zap className="compact-logo" size={27} />
        </button>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${view === item.name ? "active" : ""}`}
              aria-label={item.name}
              aria-current={view === item.name ? "page" : undefined}
              onClick={() => navigate(item.name)}
            >
              <span className="nav-icon">
                <item.icon
                  size={25}
                  strokeWidth={view === item.name ? 2.4 : 1.8}
                  fill={
                    item.name === "Home" && view === "Home"
                      ? "currentColor"
                      : "none"
                  }
                />
                {item.name === "Messages" &&
                  threads.some((thread) => thread.unread) && (
                    <span className="notification-badge">
                      {threads.filter((thread) => thread.unread).length}
                    </span>
                  )}
              </span>
              <span className="nav-label">{item.name}</span>
            </button>
          ))}
          <button
            className={`nav-item ${view === "Profile" ? "active" : ""}`}
            aria-label="Profile"
            onClick={() => navigate("Profile")}
          >
            <Avatar user={mock.currentUser} size={26} />
            <span className="nav-label">Profile</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-item theme-button"
            onClick={switchTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? (
              <Moon size={25} strokeWidth={1.8} />
            ) : (
              <Sun size={25} strokeWidth={1.8} />
            )}
            <span className="nav-label">
              {theme === "light" ? "Dark mode" : "Light mode"}
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="nav-item" aria-label="More">
                <Menu size={25} strokeWidth={1.8} />
                <span className="nav-label">More</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="ig-menu more-menu"
            >
              <DropdownMenuItem onClick={() => navigate("Saved")}>
                <Bookmark size={18} /> Saved
              </DropdownMenuItem>
              <DropdownMenuItem onClick={activity.exportSession}>
                <Download size={18} /> Export session
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/motion">
                  <Zap size={18} /> Motion lab
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={switchTheme}>
                {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}{" "}
                Switch appearance
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  toast("You're viewing a UI prototype with sample content.")
                }
              >
                About this prototype
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <PoweredBy className="sidebar-credit" />
        </div>
      </Sidebar>
      <header className="mobile-header">
        <div className="mobile-brand">
          <button
            onClick={() => navigate("Home")}
            aria-label={`${brand.name} home`}
          >
            <Wordmark />
          </button>
          <PoweredBy />
        </div>
        <div>
          <button
            className="icon-button"
            onClick={switchTheme}
            aria-label="Switch appearance"
          >
            {theme === "light" ? <Moon /> : <Sun />}
          </button>
          <button
            className="icon-button"
            aria-label="Create"
            onClick={() => navigate("Create")}
          >
            <SquarePlus />
          </button>
          <button
            className="icon-button"
            aria-label="Notifications"
            onClick={() => navigate("Notifications")}
          >
            <Heart />
          </button>
        </div>
      </header>
      <main
        key={viewKey}
        className={`ig-main ${view === "Messages" ? "messages-main" : ""}`}
      >
        {activity.error && (
          <div className="session-feedback" role="alert">
            <span>{activity.error}</span>
            <button onClick={activity.retry}>Retry</button>
            <button onClick={activity.exportSession}>Export session</button>
          </div>
        )}
        {view === "Explore" && (
          <ExploreView
            onOpen={setActivePost}
            onSearch={() => setPanel("Search")}
          />
        )}
        {view === "Profile" && (
          <ProfileView
            key={profileId}
            userId={profileId}
            posts={allPosts}
            saved={saved}
            following={following}
            onFollow={() => follow(profileId)}
            onOpen={setActivePost}
            onSaved={() => navigate("Home")}
            onEdit={switchTheme}
          />
        )}
        {view === "Messages" && (
          <MessagesView
            onProfile={openProfile}
            threads={threads}
            onSend={(userId, text) =>
              record({ type: "message.send", data: { userId, text } })
            }
            onRead={(userId) => {
              if (threads.find((thread) => thread.userId === userId)?.unread)
                record({ type: "message.read", data: { userId } });
            }}
          />
        )}
        {view === "Reels" && <ReelsView onOpen={setActivePost} />}
        {(view === "Home" || view === "Saved") && (
          <div className="home-layout">
            <section className="feed-column" aria-label="Feed">
              <div className="feed-tabs-row">
                <Tabs
                  value={view === "Saved" ? "all" : feed}
                  onValueChange={setFeed}
                >
                  <TabsList variant="line" className="feed-tabs team-feed-tabs">
                    <TabsTrigger value="all">
                      {view === "Saved" ? "Saved work" : "All teams"}
                    </TabsTrigger>
                    {view !== "Saved" &&
                      mock.companies.map((company) => (
                        <TabsTrigger key={company.id} value={company.id}>
                          {company.handle}
                        </TabsTrigger>
                      ))}
                  </TabsList>
                </Tabs>
                <span className="feed-wordmark">{brand.tagline}</span>
                {view !== "Saved" && (
                  <span className="live-feed-status">
                    <i />
                    {teamQueue.filter((item) => !item.resolved).length} awaiting
                    you
                  </span>
                )}
              </div>
              {view !== "Saved" && (
                <AttentionQueue
                  items={teamQueue}
                  onOpen={setQueueId}
                  onCreate={() => setCreating(true)}
                />
              )}
              <div className="posts">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={{
                      ...post,
                      commentCount:
                        post.commentCount + (comments[post.id]?.length || 0),
                    }}
                    liked={liked.includes(post.id)}
                    saved={saved.includes(post.id)}
                    onLike={() => like(post.id)}
                    onSave={() => {
                      if (
                        record({
                          type: "post.save",
                          data: {
                            postId: post.id,
                            saved: !saved.includes(post.id),
                          },
                        })
                      )
                        toast(
                          saved.includes(post.id)
                            ? "Removed from saved"
                            : "Saved to your collection",
                        );
                    }}
                    onComment={(text) => {
                      if (text) {
                        if (!addComment(post.id, text)) return false;
                        toast("Comment added");
                      }
                      setActivePost(post);
                      return true;
                    }}
                    onShare={() => setSharePost(post)}
                    onProfile={openProfile}
                    response={responses[post.id]}
                    expiresAt={deadlines[post.id]}
                    onRespond={(option) => respond(post, option)}
                  />
                ))}
                {!posts.length && (
                  <div className="empty-state">
                    <Bookmark size={44} />
                    <h2>Keep work close</h2>
                    <p>Save a post to return to its discussion.</p>
                    <button
                      className="primary-button"
                      onClick={() => navigate("Home")}
                    >
                      Explore your feed
                    </button>
                  </div>
                )}
                {!!posts.length && (
                  <div className="caught-up">
                    <span>
                      <Check size={28} />
                    </span>
                    <h3>That&apos;s the latest from your teams</h3>
                    <p>Good work moves forward with a reply.</p>
                    <button className="text-action" onClick={scrollToTop}>
                      Back to top
                    </button>
                    <a className="motion-lab-link" href="/motion">
                      Explore the motion lab <ChevronRight size={14} />
                    </a>
                    <p className="session-status" role="status">
                      {activity.label}
                    </p>
                    <button
                      className="session-export"
                      onClick={activity.exportSession}
                    >
                      <Download size={13} />
                      Export session
                    </button>
                  </div>
                )}
              </div>
            </section>
            <aside className="suggestions">
              <div className="account-row current-account">
                <button onClick={() => navigate("Profile")}>
                  <Avatar user={mock.currentUser} size={46} />
                </button>
                <button
                  className="account-info"
                  onClick={() => navigate("Profile")}
                >
                  <strong>{mock.currentUser.username}</strong>
                  <span>{mock.currentUser.name}</span>
                </button>
                <button
                  className="text-action"
                  onClick={() =>
                    toast("You're using the Alex Morgan demo account.")
                  }
                >
                  Switch
                </button>
              </div>
              <div className="team-summary">
                {mock.companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => {
                      setFeed(company.id);
                      showView("Home", "you", true);
                    }}
                  >
                    <span className="team-monogram">{company.initials}</span>
                    <span>
                      <strong>{company.handle}</strong>
                      <small>
                        {
                          attention.filter(
                            (item) =>
                              item.companyId === company.id && !item.resolved,
                          ).length
                        }{" "}
                        requests waiting
                      </small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
              <div className="suggestions-heading">
                <h2>Your people</h2>
                <button onClick={() => navigate("Explore")}>See All</button>
              </div>
              {mock.users.slice(0, 5).map((user) => (
                <div className="account-row" key={user.id}>
                  <button onClick={() => openProfile(user.id)}>
                    <Avatar user={user} size={44} />
                  </button>
                  <button
                    className="account-info"
                    onClick={() => openProfile(user.id)}
                  >
                    <strong>
                      {user.username}
                      {user.verified && <Verified />}
                    </strong>
                    <span>
                      {user.role} · {getCompany(user.companyId)?.handle}
                    </span>
                  </button>
                  <button
                    className={`text-action ${following.includes(user.id) ? "is-following" : ""}`}
                    onClick={() => follow(user.id)}
                  >
                    {following.includes(user.id) ? "Following" : "Follow"}
                  </button>
                </div>
              ))}
              <footer className="side-footer">
                <p>{brand.tagline}</p>
                <p className="session-status">
                  <i />
                  {activity.label}
                </p>
                <button
                  className="session-export"
                  onClick={activity.exportSession}
                >
                  <Download size={13} />
                  Export session
                </button>
                <PoweredBy />
                <p className="footer-copyright">
                  &copy; {new Date().getFullYear()} {brand.name}
                </p>
              </footer>
            </aside>
          </div>
        )}
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <span
          className="dock-selection"
          aria-hidden="true"
          style={{
            transform: `translateX(${Math.max(0, ["Home", "Reels", "Messages", "Search", "Profile"].indexOf(dockView)) * 100}%)`,
          }}
        />
        {[nav[0], nav[3], nav[4], nav[1]].map((item) => (
          <button
            className={`dock-button ${dockView === item.name ? "active" : ""}`}
            key={item.name}
            aria-label={item.name}
            aria-current={dockView === item.name ? "page" : undefined}
            onClick={() =>
              navigate(item.name === "Search" ? "Explore" : item.name)
            }
          >
            <span className="dock-icon">
              <item.icon
                fill={
                  item.name === view && view === "Home"
                    ? "currentColor"
                    : "none"
                }
              />
              {item.name === "Messages" &&
                threads.some((thread) => thread.unread) && (
                  <span className="dock-unread" />
                )}
            </span>
          </button>
        ))}
        <button
          className={`dock-button ${view === "Profile" ? "active" : ""}`}
          aria-label="Profile"
          aria-current={view === "Profile" ? "page" : undefined}
          onClick={() => navigate("Profile")}
        >
          <Avatar user={mock.currentUser} size={25} />
        </button>
      </nav>
      <SidePanel
        panel={panel}
        onClose={() => setPanel(null)}
        onProfile={openProfile}
        attention={attention}
        onOpenQueue={(id) => {
          setPanel(null);
          setQueueId(id);
        }}
      />
      {queueItem && (
        <QueueReplyDialog
          key={queueItem.id}
          item={queueItem}
          items={attention}
          posts={allPosts}
          onClose={() => setQueueId(null)}
          onOpen={setQueueId}
          onReply={(item, text) =>
            record({
              type: "queue.reply",
              data: {
                itemId: item.id,
                userId: item.userId,
                kind: item.kind,
                ...(item.postId ? { postId: item.postId } : {}),
                text,
              },
            })
          }
          onResolve={(item, resolved) =>
            record({
              type: "queue.resolve",
              data: { itemId: item.id, resolved },
            })
          }
          onOpenPost={(id) => {
            setQueueId(null);
            setActivePost(allPosts.find((post) => post.id === id) || null);
          }}
        />
      )}
      <PostDialog
        post={activePost}
        onClose={() => setActivePost(null)}
        comments={activePost ? comments[activePost.id] || [] : []}
        onAdd={(text) => {
          return activePost ? addComment(activePost.id, text) : false;
        }}
        liked={!!activePost && liked.includes(activePost.id)}
        onLike={() => {
          if (activePost) like(activePost.id);
        }}
        response={activePost ? responses[activePost.id] : undefined}
        expiresAt={activePost ? deadlines[activePost.id] : undefined}
        onRespond={(option) => {
          if (activePost) respond(activePost, option);
        }}
      />
      <ShareDialog
        post={sharePost}
        onClose={() => setSharePost(null)}
        onSend={(ids, post) =>
          activity.recordBatch(
            ids.map((userId) => ({
              type: "message.send",
              data: { userId, text: `Shared work: ${post.caption}` },
            })),
          )
        }
      />
      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(image, caption) => {
          const newPost: Post = {
            id: `local-${Date.now()}`,
            userId: "you",
            companyId: feed === "all" ? mock.currentUser.companyId : feed,
            requesterId: "you",
            workType: "Feedback",
            location: "Ready for feedback",
            time: "now",
            images: [image],
            alt: caption || "Your work preview",
            caption,
            tags: "",
            likes: 0,
            commentCount: 0,
            comments: [],
            instant: {
              kind: "invite",
              title:
                caption.split("\n")[0].slice(0, 80) ||
                "Could you take a look at this?",
              expiresInMinutes: 30,
              options: [
                { id: "reviewed", label: "Reviewed", count: 0 },
                { id: "discuss", label: "Let's discuss", count: 0 },
              ],
            },
          };
          if (!record({ type: "post.create", data: { post: newPost } }))
            return false;
          showView("Home", "you", true);
          toast("Your work is ready for feedback in this session");
          return true;
        }}
      />
      <Toaster
        position="bottom-center"
        theme={theme}
        toastOptions={{
          style: {
            background: "var(--ig-surface)",
            color: "var(--ig-foreground)",
            borderColor: "var(--ig-border)",
          },
        }}
      />
    </SidebarProvider>
  );
}
