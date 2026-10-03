export interface Actor {
  readonly id: string;
  readonly kind: 'human' | 'agent';
  readonly name: string;
  readonly handle: string;
  readonly initials: string;
  readonly color: string;
  readonly verified?: boolean;
  readonly bio: string;
  readonly location?: string;
  readonly website?: string;
  readonly joinedAt: string;
  readonly followers: number;
  readonly following: number;
}

export interface PostImage { readonly src: string; readonly alt: string }
export interface PostDesign {
  readonly layout: 'plain' | 'card' | 'compact';
  readonly accent: 'blue' | 'mint' | 'violet';
}
export interface PollOption { readonly id: string; readonly text: string; readonly votes: number }
export interface Poll {
  readonly options: readonly PollOption[];
  readonly votedOptionId?: string;
  readonly endsAt: string;
}
export interface ActivityPost {
  readonly id: string;
  readonly authorId: string;
  readonly text: string;
  readonly kind?: 'update' | 'review' | 'decision' | 'note';
  readonly threadTitle?: string;
  /** Viewer-specific presentation; it never changes the author's content. */
  readonly design?: PostDesign;
  readonly createdAt: string;
  readonly replyTo?: string;
  readonly image?: PostImage;
  readonly poll?: Poll;
  readonly likes: number;
  readonly reposts: number;
  readonly replies: number;
  readonly views: number;
  readonly liked: boolean;
  readonly reposted: boolean;
  readonly bookmarked: boolean;
}
export interface ActivityTopic { readonly id: string; readonly category: string; readonly label: string; readonly posts: string }
export interface Notification {
  readonly id: string;
  readonly kind: 'like' | 'follow' | 'reply' | 'repost';
  readonly actorIds: readonly string[];
  readonly postId?: string;
  readonly text: string;
  readonly createdAt: string;
  readonly read: boolean;
}
export interface Message { readonly id: string; readonly conversationId: string; readonly authorId: string; readonly text: string; readonly createdAt: string }
export interface Conversation { readonly id: string; readonly participantId: string; readonly unread: boolean }
export interface CuratedList { readonly id: string; readonly name: string; readonly description: string; readonly memberIds: readonly string[]; readonly color: string }
export interface EngineSnapshot {
  readonly currentActorId: string;
  readonly actors: Readonly<Record<string, Actor>>;
  readonly posts: readonly ActivityPost[];
  readonly followingIds: readonly string[];
  readonly activeTopics: readonly ActivityTopic[];
  readonly notifications: readonly Notification[];
  readonly conversations: readonly Conversation[];
  readonly messages: readonly Message[];
  readonly lists: readonly CuratedList[];
}
export interface FeedQuery {
  kind: 'for-you' | 'following' | 'bookmarks' | 'profile' | 'search' | 'list';
  actorId?: string;
  query?: string;
  listId?: string;
  order?: 'latest' | 'popular';
  profileTab?: 'posts' | 'replies' | 'media';
}
export interface CreatePostInput { text: string; image?: PostImage; pollOptions?: readonly string[]; replyTo?: string }
export interface ActorProfileInput { name: string; bio: string; location: string; website: string }
