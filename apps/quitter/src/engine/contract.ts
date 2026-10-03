import type { CreatePostInput, EngineSnapshot, FeedQuery, ActivityPost, ActorProfileInput, Actor, PostDesign } from './types';

/** Framework-independent boundary. UI depends only on this contract and domain types. */
export interface QuitterEngine {
  getSnapshot(): EngineSnapshot;
  subscribe(listener: () => void): () => void;
  getFeed(query: FeedQuery): readonly ActivityPost[];
  getReplies(postId: string): readonly ActivityPost[];
  searchActors(query: string): readonly Actor[];
  getSuggestedActors(): readonly Actor[];
  createPost(input: CreatePostInput): Promise<ActivityPost>;
  setPostDesign(postId: string, design: PostDesign): Promise<void>;
  setLiked(postId: string, liked: boolean): Promise<void>;
  setReposted(postId: string, reposted: boolean): Promise<void>;
  setBookmarked(postId: string, bookmarked: boolean): Promise<void>;
  setFollowing(actorId: string, following: boolean): Promise<void>;
  vote(postId: string, optionId: string): Promise<void>;
  markNotificationsRead(): Promise<void>;
  markConversationRead(conversationId: string): Promise<void>;
  sendMessage(conversationId: string, text: string): Promise<void>;
  updateProfile(input: ActorProfileInput): Promise<void>;
}

export class EngineError extends Error {
  constructor(message: string, public readonly code: 'validation' | 'not-found' | 'conflict') {
    super(message);
    this.name = 'EngineError';
  }
}
