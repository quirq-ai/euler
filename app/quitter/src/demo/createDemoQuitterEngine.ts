import { EngineError, type QuitterEngine } from '../engine/contract';
import type { CreatePostInput, EngineSnapshot, FeedQuery, ActivityPost, ActorProfileInput } from '../engine/types';
import { createFixtures } from './fixtures';
import { DEFAULT_POST_DESIGN, validatePostDesign } from '../engine/postDesign';

/** In-memory demo adapter. It has no React, network, database, or storage dependency. */
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
export function createDemoQuitterEngine(initial = createFixtures()): QuitterEngine {
  let snapshot = freeze(structuredClone(initial));
  const listeners = new Set<() => void>();
  let sequence = 0;
  const id = (prefix: string) => `${prefix}-${Date.now()}-${++sequence}`;
  const publish = (next: EngineSnapshot) => { snapshot = freeze(next); listeners.forEach(listener => listener()); };
  const findPost = (postId: string) => {
    const found = snapshot.posts.find(p => p.id === postId);
    if (!found) throw new EngineError('This post is no longer available.', 'not-found');
    return found;
  };
  const updatePost = (postId: string, update: (post: ActivityPost) => ActivityPost) => {
    findPost(postId);
    publish({ ...snapshot, posts: snapshot.posts.map(p => p.id === postId ? update(p) : p) });
  };
  const textLength = (text: string) => Array.from(text).length;
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getFeed(query: FeedQuery) {
      let feed = snapshot.posts.filter(post => query.kind === 'bookmarks' || query.kind === 'search' ? true : query.kind === 'profile' && query.profileTab === 'replies' ? !!post.replyTo : !post.replyTo);
      if (query.kind === 'following') feed = feed.filter(post => snapshot.followingIds.includes(post.authorId) || post.authorId === snapshot.currentActorId);
      if (query.kind === 'bookmarks') feed = feed.filter(post => post.bookmarked);
      if (query.kind === 'profile') feed = feed.filter(post => post.authorId === query.actorId || (query.profileTab !== 'replies' && query.actorId === snapshot.currentActorId && post.reposted));
      if (query.kind === 'profile' && query.profileTab === 'media') feed = feed.filter(post => !!post.image);
      if (query.kind === 'list') {
        const list = snapshot.lists.find(list => list.id === query.listId);
        feed = feed.filter(post => list?.memberIds.includes(post.authorId));
      }
      if (query.kind === 'search') {
        const needle = (query.query ?? '').trim().toLowerCase();
        feed = feed.filter(post => `${post.text} ${snapshot.actors[post.authorId].name} ${snapshot.actors[post.authorId].handle}`.toLowerCase().includes(needle));
      }
      return [...feed].sort((a, b) => query.order === 'popular' ? b.likes - a.likes : Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
    getReplies: postId => snapshot.posts.filter(post => post.replyTo === postId).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    searchActors(query) {
      const needle = query.trim().replace(/^@/, '').toLowerCase();
      return Object.values(snapshot.actors).filter(user => user.id !== snapshot.currentActorId && `${user.name} ${user.handle} ${user.bio}`.toLowerCase().includes(needle));
    },
    getSuggestedActors: () => Object.values(snapshot.actors).filter(user => user.id !== snapshot.currentActorId && !snapshot.followingIds.includes(user.id)),
    async createPost(input: CreatePostInput) {
      const text = input.text.trim();
      if ((!text && !input.image) || textLength(text) > 280) throw new EngineError('Write something in 280 characters or fewer.', 'validation');
      if (input.image && !/^(data:image\/(png|jpeg|webp|gif);base64,|\/)/.test(input.image.src)) throw new EngineError('Choose a supported image file.', 'validation');
      if (input.replyTo) findPost(input.replyTo);
      const options = input.pollOptions?.map(option => option.trim());
      if (options && (options.length < 2 || options.length > 4 || options.some(option => !option || textLength(option) > 50))) throw new EngineError('Add 2–4 poll options, each up to 50 characters.', 'validation');
      if (options && input.image) throw new EngineError('Choose either an image or a poll.', 'validation');
      const created: ActivityPost = {
        id: id('post'), authorId: snapshot.currentActorId, text, createdAt: new Date().toISOString(),
        image: input.image ? { ...input.image } : undefined, replyTo: input.replyTo,
        poll: options ? { options: options.map(text => ({ id: id('option'), text, votes: 0 })), endsAt: new Date(Date.now() + 86_400_000).toISOString() } : undefined,
        likes: 0, reposts: 0, replies: 0, views: 1, liked: false, reposted: false, bookmarked: false,
      };
      publish({ ...snapshot, posts: [created, ...snapshot.posts.map(post => post.id === input.replyTo ? { ...post, replies: post.replies + 1 } : post)] });
      return created;
    },
    async setLiked(postId, liked) {
      const post = findPost(postId);
      if (post.liked === liked) return;
      updatePost(postId, post => ({ ...post, liked, likes: Math.max(0, post.likes + (liked ? 1 : -1)) }));
    },
    async setPostDesign(postId, input) {
      const post = findPost(postId);
      const design = validatePostDesign(input);
      const before = post.design ?? DEFAULT_POST_DESIGN;
      if (design.layout === before.layout && design.accent === before.accent) return;
      updatePost(postId, post => ({ ...post, design }));
    },
    async setReposted(postId, reposted) {
      const post = findPost(postId);
      if (post.reposted === reposted) return;
      updatePost(postId, post => ({ ...post, reposted, reposts: Math.max(0, post.reposts + (reposted ? 1 : -1)) }));
    },
    async setBookmarked(postId, bookmarked) {
      const post = findPost(postId);
      if (post.bookmarked === bookmarked) return;
      updatePost(postId, post => ({ ...post, bookmarked }));
    },
    async setFollowing(actorId, following) {
      if (!snapshot.actors[actorId]) throw new EngineError('This profile is unavailable.', 'not-found');
      if (actorId === snapshot.currentActorId) throw new EngineError('You cannot follow yourself.', 'validation');
      if (snapshot.followingIds.includes(actorId) === following) return;
      const difference = following ? 1 : -1;
      const target = snapshot.actors[actorId];
      const current = snapshot.actors[snapshot.currentActorId];
      publish({ ...snapshot,
        followingIds: following ? [...snapshot.followingIds, actorId] : snapshot.followingIds.filter(id => id !== actorId),
        actors: { ...snapshot.actors, [actorId]: { ...target, followers: Math.max(0, target.followers + difference) }, [current.id]: { ...current, following: Math.max(0, current.following + difference) } },
      });
    },
    async vote(postId, optionId) {
      const post = findPost(postId);
      if (!post.poll || !post.poll.options.some(option => option.id === optionId)) throw new EngineError('This poll option is unavailable.', 'not-found');
      if (post.poll.votedOptionId || Date.parse(post.poll.endsAt) <= Date.now()) throw new EngineError('This poll is closed or you have already voted.', 'conflict');
      updatePost(postId, post => ({ ...post, poll: { ...post.poll!, votedOptionId: optionId, options: post.poll!.options.map(option => option.id === optionId ? { ...option, votes: option.votes + 1 } : option) } }));
    },
    async markNotificationsRead() { if (snapshot.notifications.every(n => n.read)) return; publish({ ...snapshot, notifications: snapshot.notifications.map(n => ({ ...n, read: true })) }); },
    async markConversationRead(conversationId) {
      if (!snapshot.conversations.some(c => c.id === conversationId)) throw new EngineError('This conversation is unavailable.', 'not-found');
      if (snapshot.conversations.find(c => c.id === conversationId)?.unread === false) return;
      publish({ ...snapshot, conversations: snapshot.conversations.map(c => c.id === conversationId ? { ...c, unread: false } : c) });
    },
    async sendMessage(conversationId, value) {
      const text = value.trim();
      if (!text || textLength(text) > 2000) throw new EngineError('Write a message in 2,000 characters or fewer.', 'validation');
      if (!snapshot.conversations.some(c => c.id === conversationId)) throw new EngineError('This conversation is unavailable.', 'not-found');
      publish({ ...snapshot, messages: [...snapshot.messages, { id: id('message'), conversationId, text, authorId: snapshot.currentActorId, createdAt: new Date().toISOString() }] });
    },
    async updateProfile(input: ActorProfileInput) {
      if (!input.name.trim() || textLength(input.name.trim()) > 50 || textLength(input.bio) > 160 || textLength(input.location) > 50 || textLength(input.website) > 100) throw new EngineError('Check your name and profile field limits.', 'validation');
      const current = snapshot.actors[snapshot.currentActorId];
      publish({ ...snapshot, actors: { ...snapshot.actors, [current.id]: { ...current, ...input, name: input.name.trim() } } });
    },
  };
}
