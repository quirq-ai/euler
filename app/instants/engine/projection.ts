import type { SessionDocument } from "./types";
import type { Comment, Post, QueueItem, SeedData, Thread } from "@/lib/data";

export type SessionView = {
  liked: string[];
  saved: string[];
  following: string[];
  allPosts: Post[];
  comments: Record<string, Comment[]>;
  responses: Record<string, string>;
  deadlines: Record<string, number>;
  threads: Thread[];
  attention: QueueItem[];
};

/** A deterministic projection: fixtures + activity are the entire application state. */
export function projectSession(
  seed: SeedData,
  session: SessionDocument | null,
): SessionView {
  const state: SessionView = {
    liked: [],
    saved: [],
    following: seed.users
      .filter((user) => user.following)
      .map((user) => user.id),
    allPosts: [...seed.posts],
    // IDs are data, including valid strings such as "constructor". Do not let
    // inherited Object properties participate in lookup or assignment.
    comments: Object.create(null),
    responses: Object.create(null),
    deadlines: Object.create(null),
    threads: seed.messages.map((thread) => ({
      ...thread,
      messages: [...thread.messages],
    })),
    attention: seed.attention.map((item) => ({
      ...item,
      resolved: false,
      replies: [],
    })),
  };
  if (!session) return state;
  for (const post of state.allPosts)
    if (post.instant)
      state.deadlines[post.id] =
        Date.parse(session.createdAt) + post.instant.expiresInMinutes * 60_000;
  function toggle(values: string[], id: string, enabled: boolean) {
    return enabled
      ? [...new Set([...values, id])]
      : values.filter((value) => value !== id);
  }
  function comment(postId: string, text: string) {
    if (state.allPosts.some((post) => post.id === postId))
      (state.comments[postId] ??= []).push({ userId: "you", text });
  }
  function message(userId: string, text: string) {
    let thread = state.threads.find((item) => item.userId === userId);
    if (!thread) {
      thread = {
        userId,
        preview: "",
        time: "now",
        unread: false,
        messages: [],
      };
      state.threads.unshift(thread);
    }
    thread.messages.push({ mine: true, text });
    thread.preview = `You: ${text}`;
    thread.time = "now";
    thread.unread = false;
  }
  for (const event of session.activity) {
    switch (event.type) {
      case "post.like":
        state.liked = toggle(state.liked, event.data.postId, event.data.liked);
        break;
      case "post.save":
        state.saved = toggle(state.saved, event.data.postId, event.data.saved);
        break;
      case "person.follow":
        state.following = toggle(
          state.following,
          event.data.userId,
          event.data.following,
        );
        break;
      case "post.respond": {
        const post = state.allPosts.find(
          (post) => post.id === event.data.postId,
        );
        if (
          post?.instant?.options.some(
            (option) => option.id === event.data.optionId,
          ) &&
          Date.parse(event.at) < state.deadlines[post.id]
        )
          state.responses[post.id] = event.data.optionId;
        break;
      }
      case "post.comment":
        comment(event.data.postId, event.data.text);
        break;
      case "message.send":
        message(event.data.userId, event.data.text);
        for (const item of state.attention)
          if (
            item.kind === "dm" &&
            item.userId === event.data.userId &&
            !item.resolved
          ) {
            item.resolved = true;
            item.replies.push({ mine: true, text: event.data.text });
          }
        break;
      case "message.read": {
        const thread = state.threads.find(
          (thread) => thread.userId === event.data.userId,
        );
        if (thread) thread.unread = false;
        break;
      }
      case "queue.reply": {
        const item = state.attention.find(
          (item) => item.id === event.data.itemId,
        );
        if (!item) break;
        // Route from trusted fixture context rather than client-supplied targets.
        if (item.kind !== "dm" && item.postId)
          comment(item.postId, event.data.text);
        else message(item.userId, event.data.text);
        item.resolved = true;
        item.replies.push({ mine: true, text: event.data.text });
        break;
      }
      case "queue.resolve": {
        const item = state.attention.find(
          (item) => item.id === event.data.itemId,
        );
        if (item) item.resolved = event.data.resolved;
        break;
      }
      case "post.create": {
        if (state.allPosts.some((post) => post.id === event.data.post.id))
          break;
        const post = event.data.post as Post;
        state.allPosts.unshift(post);
        if (post.instant)
          state.deadlines[post.id] =
            Date.parse(event.at) + post.instant.expiresInMinutes * 60_000;
        break;
      }
    }
  }
  return state;
}
