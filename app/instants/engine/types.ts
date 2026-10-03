/** Portable activity contract. This module does not import server storage. */
export type QueueKind = "dm" | "comment" | "mention" | "review";

export type SessionPost = {
  id: string;
  userId: string;
  companyId?: string;
  requesterId?: string;
  location: string;
  time: string;
  images: string[];
  alt: string;
  caption: string;
  tags: string;
  likes: number;
  commentCount: number;
  comments: { userId: string; text: string }[];
  workType?: string;
  instant?: {
    kind: string;
    title: string;
    expiresInMinutes: number;
    options: { id: string; label: string; count: number }[];
  };
};

export type ActivityData = {
  "post.like": { postId: string; liked: boolean };
  "post.save": { postId: string; saved: boolean };
  "person.follow": { userId: string; following: boolean };
  "post.respond": { postId: string; optionId: string };
  "post.comment": { postId: string; text: string };
  "message.send": { userId: string; text: string };
  "message.read": { userId: string };
  "queue.reply": {
    itemId: string;
    userId: string;
    kind: QueueKind;
    postId?: string;
    text: string;
  };
  "queue.resolve": { itemId: string; resolved: boolean };
  "post.create": { post: SessionPost };
};

export type ActivityType = keyof ActivityData;
export type ActivityInput = {
  [Type in ActivityType]: { type: Type; data: ActivityData[Type] };
}[ActivityType];
export type Activity = ActivityInput & { id: string; at: string };

export type SessionDocument = {
  schemaVersion: 1;
  id: string;
  userId: "you";
  createdAt: string;
  updatedAt: string;
  activity: Activity[];
};

export type SessionResult =
  | { mode: "file"; session: SessionDocument }
  | { mode: "browser"; session: null };
