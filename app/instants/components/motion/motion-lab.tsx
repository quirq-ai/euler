"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bookmark,
  Check,
  ChevronRight,
  Compass,
  Heart,
  Home,
  Moon,
  MoveHorizontal,
  Play,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { motion, scrollToTop, useReducedMotion } from "@/lib/motion";
import { Photo, PoweredBy, Wordmark } from "@/components/instagram/shared";
import { MotionCarousel } from "@/components/motion/carousel";
import { useClientReady } from "@/hooks/use-client-ready";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import mock from "@/data/mock.json";
import "./motion-lab.css";

const dockItems = [
  { name: "Feed", icon: Home },
  { name: "Explore", icon: Compass },
  { name: "Saved", icon: Bookmark },
  { name: "Profile", icon: User },
];
const tokenLabels: Record<string, string> = {
  press: "Press",
  standard: "Everyday",
  navigation: "Navigate",
  sheet: "Sheet",
  like: "Celebrate",
};

function subscribeTheme(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}
const readTheme = () =>
  document.documentElement.dataset.theme || brand.defaultTheme;
const readServerTheme = () => brand.defaultTheme;

function DemoHeading({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="motion-lab-card-heading">
      <span className="motion-lab-number">{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </div>
  );
}

export function MotionLab() {
  const ready = useClientReady();
  const reducedMotion = useReducedMotion();
  const theme = useSyncExternalStore(
    subscribeTheme,
    readTheme,
    readServerTheme,
  );
  const phoneScroll = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);
  const tapStart = useRef<{ x: number; y: number } | null>(null);
  const [activeDock, setActiveDock] = useState(0);
  const [carouselVersion, setCarouselVersion] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [heartVersion, setHeartVersion] = useState(0);
  const [selectedToken, setSelectedToken] =
    useState<keyof typeof motion.durations>("navigation");
  const [tokenAtEnd, setTokenAtEnd] = useState(false);
  const [sheetChoice, setSheetChoice] = useState("Both teams");
  const [savedChoice, setSavedChoice] = useState("Both teams");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("ig-ui-theme", next);
    } catch {
      /* Theme also works without storage. */
    }
  };
  const scrollPhone = (toTop = false) => {
    const element = phoneScroll.current;
    if (!element) return;
    element.scrollTo({
      top: toTop ? 0 : Math.min(element.scrollTop + 280, element.scrollHeight),
      behavior: reducedMotion ? "instant" : "smooth",
    });
  };
  const celebrate = () => {
    setLiked(true);
    setHeartVersion((value) => value + 1);
  };
  const replayCarousel = () => {
    setCarouselVersion((value) => value + 1);
    setCarouselIndex(0);
  };

  return (
    <div
      className="motion-lab"
      data-reduced-motion={reducedMotion}
      inert={!ready}
      aria-busy={!ready}
      data-app-ready={ready}
    >
      <header className="motion-lab-header">
        <div className="motion-lab-header-inner">
          <Link
            href="/"
            className="motion-lab-brand"
            aria-label={`${brand.name} home`}
          >
            <Wordmark />
          </Link>
          <span className="motion-lab-header-divider" aria-hidden="true" />
          <span className="motion-lab-header-label">Motion lab</span>
          <div className="motion-lab-header-actions">
            <PoweredBy />
            <button
              className="motion-lab-icon-button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <Link
              className="motion-lab-back"
              href="/"
              aria-label="Back to feed"
            >
              <ArrowLeft size={15} /> <span>Back to feed</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="motion-lab-main">
        <section className="motion-lab-intro">
          <div className="motion-lab-eyebrow">
            <span /> THE LITTLE DETAILS
          </div>
          <h1>
            Made to feel <span>natural.</span>
          </h1>
          <p>
            The small movements that make {brand.name} feel alive.
            <br className="motion-lab-desktop-break" /> Scroll, swipe, tap. Get
            a feel for it.
          </p>
          <div className="motion-lab-intro-bottom">
            <span className="motion-lab-live">
              <span /> Interactive playground
            </span>
            <span className="motion-lab-preference">
              <SlidersHorizontal size={14} />{" "}
              {reducedMotion
                ? "Reduced motion is on"
                : "Respects your motion preferences"}
            </span>
          </div>
        </section>

        <section
          className="motion-lab-feature"
          aria-labelledby="motion-scroll-title"
        >
          <div className="motion-lab-feature-copy">
            <span className="motion-lab-overline">01 / SCROLL & NAVIGATE</span>
            <h2 id="motion-scroll-title">
              A little momentum.
              <br />A lot of fluidity.
            </h2>
            <p>
              A feed that follows your lead, with a floating dock that settles
              softly into place.
            </p>
            <div className="motion-lab-feature-instructions">
              <div>
                <span>
                  <ArrowDown size={17} />
                </span>
                <p>
                  <strong>Give it a scroll</strong>
                  <small>Native scrolling. A smooth return home.</small>
                </p>
              </div>
              <div>
                <span>
                  <Compass size={17} />
                </span>
                <p>
                  <strong>Try the dock</strong>
                  <small>Tap a destination. Feel the transition.</small>
                </p>
              </div>
            </div>
            <div className="motion-lab-feature-buttons">
              <button
                className="motion-lab-button motion-lab-button-primary"
                onClick={() => scrollPhone()}
              >
                <ArrowDown size={15} /> Scroll preview
              </button>
              <button
                className="motion-lab-button"
                onClick={() => scrollPhone(true)}
              >
                <RotateCcw size={14} /> Replay
              </button>
            </div>
            <div className="motion-lab-feature-note">
              <span className="motion-lab-note-dot" />{" "}
              {motion.durations.navigation}ms navigation · spring easing
            </div>
          </div>

          <div className="motion-lab-phone-stage">
            <div className="motion-lab-phone">
              <div className="motion-lab-phone-top">
                <span>9:41</span>
                <span className="motion-lab-phone-island" />
                <span className="motion-lab-phone-battery" />
              </div>
              <div className="motion-lab-phone-heading">
                <Wordmark />
                <Heart size={19} />
              </div>
              <div
                className="motion-lab-phone-scroll"
                ref={phoneScroll}
                tabIndex={0}
                role="region"
                aria-label="Scrollable sample feed"
              >
                {mock.posts.slice(0, 3).map((post, index) => (
                  <article className="motion-lab-mini-post" key={post.id}>
                    <div className="motion-lab-mini-meta">
                      <span className="motion-lab-mini-avatar">
                        {post.userId.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <strong>
                          {
                            mock.users.find((user) => user.id === post.userId)
                              ?.username
                          }
                        </strong>
                        <small>{post.location}</small>
                      </div>
                      <span className="motion-lab-mini-more">···</span>
                    </div>
                    <Photo
                      src={post.images[0]}
                      alt={post.alt}
                      eager={index === 0}
                    />
                    <div className="motion-lab-mini-actions" aria-hidden="true">
                      <Heart size={19} />
                      <Send size={18} />
                      <Bookmark size={18} />
                    </div>
                    <p>
                      {
                        [
                          "A fresh build, ready for your review.",
                          "Try the preview. Share what you notice.",
                          "A quick decision keeps the team moving.",
                        ][index]
                      }
                    </p>
                  </article>
                ))}
                <button
                  className="motion-lab-phone-end"
                  onClick={() => scrollPhone(true)}
                >
                  <ArrowUp size={14} /> You’re all caught up. Back to top
                </button>
              </div>
              <div
                className="motion-lab-dock"
                aria-label="Navigation motion demo"
                role="group"
              >
                <span
                  className="motion-lab-dock-indicator"
                  style={{ transform: `translateX(${activeDock * 100}%)` }}
                />
                {dockItems.map(({ name, icon: Icon }, index) => (
                  <button
                    key={name}
                    onClick={() => {
                      setActiveDock(index);
                      if (index === 0) scrollPhone(true);
                    }}
                    aria-label={`Preview ${name} dock state`}
                    aria-pressed={activeDock === index}
                    className={activeDock === index ? "is-active" : ""}
                  >
                    <Icon
                      size={21}
                      strokeWidth={activeDock === index ? 2.2 : 1.7}
                    />
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            </div>
            <span className="motion-lab-phone-status" aria-live="polite">
              <span /> {dockItems[activeDock].name} selected
            </span>
          </div>
        </section>

        <div className="motion-lab-grid">
          <section className="motion-lab-card motion-lab-carousel-card">
            <DemoHeading
              number="02"
              title="One swipe closer."
              detail="A carousel that moves with you."
            />
            <div className="motion-lab-carousel-demo">
              <MotionCarousel
                key={carouselVersion}
                images={mock.posts[0].images}
                alt={mock.posts[0].alt}
                label="Work preview carousel"
                onIndexChange={setCarouselIndex}
              />
              <span className="motion-lab-image-label">
                <span /> A closer look at the work
              </span>
            </div>
            <div className="motion-lab-demo-footer">
              <span>
                <MoveHorizontal size={15} /> Swipe, drag, or use arrow keys{" "}
                <small>
                  {carouselIndex + 1} / {mock.posts[0].images.length}
                </small>
              </span>
              <button className="motion-lab-replay" onClick={replayCarousel}>
                <RotateCcw size={13} /> Replay
              </button>
            </div>
          </section>

          <section className="motion-lab-card">
            <DemoHeading
              number="03"
              title="Give good work some love."
              detail="Double-tap to appreciate a teammate's work."
            />
            <div className="motion-lab-heart-demo">
              <button
                className="motion-lab-heart-photo"
                aria-label="Double-tap this photo to like it, or press Enter"
                onPointerDown={(event) => {
                  if (event.isPrimary && event.button === 0)
                    tapStart.current = { x: event.clientX, y: event.clientY };
                }}
                onPointerCancel={() => {
                  tapStart.current = null;
                  lastTap.current = 0;
                }}
                onDragStart={(event) => event.preventDefault()}
                onPointerUp={(event) => {
                  const start = tapStart.current;
                  tapStart.current = null;
                  if (
                    !start ||
                    Math.hypot(
                      event.clientX - start.x,
                      event.clientY - start.y,
                    ) > 10
                  ) {
                    lastTap.current = 0;
                    return;
                  }
                  const now = Date.now();
                  if (now - lastTap.current < motion.gestures.doubleTapWindow) {
                    celebrate();
                    lastTap.current = 0;
                  } else lastTap.current = now;
                }}
                onClick={(event) => {
                  if (event.detail === 0) celebrate();
                }}
              >
                <Photo src={mock.posts[3].images[0]} alt={mock.posts[3].alt} />
                <span className="motion-lab-heart-hint">
                  <Heart size={15} /> Double-tap good work
                </span>
                {heartVersion > 0 && liked && (
                  <span
                    key={heartVersion}
                    className="motion-lab-heart-burst"
                    aria-hidden="true"
                  >
                    <Heart size={86} fill="currentColor" strokeWidth={0} />
                  </span>
                )}
              </button>
              <div className="motion-lab-heart-caption">
                <button
                  onClick={() => (liked ? setLiked(false) : celebrate())}
                  aria-label={liked ? "Unlike photo" : "Like photo"}
                  aria-pressed={liked}
                  className={liked ? "is-liked" : ""}
                >
                  <Heart size={22} fill={liked ? "currentColor" : "none"} />
                </button>
                <span aria-live="polite">
                  {liked
                    ? "You and 7 teammates liked this work"
                    : "Small feedback keeps work moving."}
                </span>
                <Bookmark size={20} aria-hidden="true" />
              </div>
            </div>
            <div className="motion-lab-demo-footer">
              <span>
                {motion.durations.like}ms{" "}
                <span className="motion-lab-separator">/</span> Just enough
                celebration
              </span>
              <button className="motion-lab-replay" onClick={celebrate}>
                <RotateCcw size={13} /> Replay
              </button>
            </div>
          </section>

          <section className="motion-lab-card motion-lab-surface-card">
            <DemoHeading
              number="04"
              title="Make a little room."
              detail="Focus arrives. Everything else steps back."
            />
            <div className="motion-lab-surfaces">
              <div className="motion-lab-surface-visual" aria-hidden="true">
                <span className="motion-lab-visual-line" />
                <span className="motion-lab-visual-line" />
                <div className="motion-lab-visual-dialog">
                  <span>
                    <Sparkles size={16} />
                  </span>
                  <i />
                  <i />
                  <b />
                </div>
              </div>
              <div className="motion-lab-surface-buttons">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="motion-lab-button">
                      Open dialog <ArrowRight size={14} />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="motion-lab-modal">
                    <div className="motion-lab-modal-icon">
                      <Sparkles size={24} />
                    </div>
                    <DialogHeader>
                      <DialogTitle>A moment of focus.</DialogTitle>
                      <DialogDescription>
                        A soft entrance, a clear next step. Close this dialog to
                        return to the playground.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="motion-lab-modal-caption">
                      <Check size={15} /> Keyboard focus stays with the dialog.
                    </div>
                    <DialogClose asChild>
                      <button className="motion-lab-button motion-lab-button-primary">
                        Feels good <Check size={16} />
                      </button>
                    </DialogClose>
                  </DialogContent>
                </Dialog>
                <Sheet
                  open={sheetOpen}
                  onOpenChange={(open) => {
                    setSheetOpen(open);
                    if (open) setSheetChoice(savedChoice);
                  }}
                >
                  <SheetTrigger asChild>
                    <button className="motion-lab-button">
                      Open sheet <ArrowUp size={14} />
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="motion-lab-sheet">
                    <div
                      className="motion-lab-sheet-handle"
                      aria-hidden="true"
                    />
                    <SheetHeader>
                      <SheetTitle>Who should review this?</SheetTitle>
                      <SheetDescription>
                        Preview a team choice. This demo does not send requests.
                      </SheetDescription>
                    </SheetHeader>
                    <div
                      className="motion-lab-audience"
                      role="group"
                      aria-label="Review team"
                    >
                      {[
                        {
                          title: "Both teams",
                          detail: "Build and review together",
                          icon: User,
                        },
                        {
                          title: "xo_builders",
                          detail: "Product, engineering, and testing",
                          icon: Heart,
                        },
                        {
                          title: "quirq_ai",
                          detail: "Design, AI, and product feedback",
                          icon: Compass,
                        },
                      ].map(({ title, detail, icon: Icon }) => (
                        <button
                          key={title}
                          aria-pressed={sheetChoice === title}
                          onClick={() => setSheetChoice(title)}
                        >
                          <Icon size={20} />
                          <span>
                            <strong>{title}</strong>
                            <small>{detail}</small>
                          </span>
                          <span className="motion-lab-radio">
                            {sheetChoice === title && <span />}
                          </span>
                        </button>
                      ))}
                    </div>
                    <SheetClose asChild>
                      <button
                        className="motion-lab-button motion-lab-button-primary"
                        onClick={() => setSavedChoice(sheetChoice)}
                      >
                        Done <Check size={15} />
                      </button>
                    </SheetClose>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
            <div className="motion-lab-demo-footer">
              <span>Dialog + bottom sheet</span>
              <span className="motion-lab-saved-choice" aria-live="polite">
                <Check size={13} /> {savedChoice}
              </span>
            </div>
          </section>

          <section className="motion-lab-card motion-lab-token-card">
            <DemoHeading
              number="05"
              title="The timing is everything."
              detail="One small system. A consistent feeling."
            />
            <div className="motion-lab-token-demo">
              <div className="motion-lab-token-track">
                <div
                  className="motion-lab-token-traveler"
                  style={{
                    left: tokenAtEnd ? "calc(100% - 48px)" : "0",
                    transitionDuration: `${motion.durations[selectedToken]}ms`,
                  }}
                >
                  <Sparkles size={20} />
                </div>
                <span />
              </div>
              <div
                className="motion-lab-token-options"
                role="group"
                aria-label="Choose a motion duration"
              >
                {Object.entries(motion.durations).map(([key, value]) => (
                  <button
                    key={key}
                    aria-pressed={selectedToken === key}
                    className={selectedToken === key ? "is-selected" : ""}
                    onClick={() => {
                      setSelectedToken(key as keyof typeof motion.durations);
                      setTokenAtEnd((value) => !value);
                    }}
                  >
                    <span>{tokenLabels[key] || key}</span>
                    <strong>
                      {value}
                      <small>ms</small>
                    </strong>
                  </button>
                ))}
              </div>
              <p className="motion-lab-token-easing">
                Standard easing <code>{motion.easing.standard}</code>
              </p>
            </div>
            <div className="motion-lab-demo-footer">
              <span>
                {reducedMotion
                  ? "Instant feedback · reduced motion"
                  : "Choose a duration to feel the difference"}
              </span>
              <button
                className="motion-lab-replay"
                onClick={() => setTokenAtEnd((value) => !value)}
              >
                <Play size={13} /> Replay
              </button>
            </div>
          </section>
        </div>

        <section className="motion-lab-outro">
          <span className="motion-lab-outro-icon">
            <Check size={19} />
          </span>
          <div>
            <h2>Good motion includes everyone.</h2>
            <p>
              These demos follow your device’s reduced-motion setting. Every
              interaction works with a keyboard, too.
            </p>
          </div>
          <Link href="/">
            Feel it in the feed <ChevronRight size={17} />
          </Link>
        </section>
      </main>
      <footer className="motion-lab-footer">
        <div>
          <span>
            {brand.name} <span className="motion-lab-footer-dot">/</span> Motion
            lab
          </span>
          <PoweredBy />
          <button onClick={() => scrollToTop()} className="motion-lab-replay">
            Back to top <ArrowUp size={14} />
          </button>
        </div>
      </footer>
    </div>
  );
}
