import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoQuitterEngine } from '../src/demo/createDemoQuitterEngine';
import { createFixtures } from '../src/demo/fixtures';
import { DEFAULT_POST_DESIGN } from '../src/engine/postDesign';
import type { PostDesign } from '../src/engine/types';

test('snapshots stay stable, preserve earlier state, and reject external mutation', async () => {
  const fixtures = createFixtures();
  const engine = createDemoQuitterEngine(fixtures);
  const before = engine.getSnapshot();
  let notifications = 0;
  const unsubscribe = engine.subscribe(() => notifications++);
  assert.equal(before, engine.getSnapshot());
  assert.notEqual(before, fixtures);
  assert.ok(Object.isFrozen(before.posts[0]));
  await engine.setLiked('p1', true);
  assert.notEqual(before, engine.getSnapshot());
  assert.equal(before.posts[0].likes, 128);
  assert.equal(engine.getSnapshot().posts[0].likes, 129);
  assert.equal(notifications, 1);
  unsubscribe();
  await engine.setLiked('p1', false);
  assert.equal(notifications, 1);
});

test('like and repost commands are idempotent and reversible', async () => {
  const engine = createDemoQuitterEngine();
  await engine.setLiked('p1', true);
  const snapshot = engine.getSnapshot();
  await engine.setLiked('p1', true);
  assert.equal(snapshot, engine.getSnapshot());
  await engine.setLiked('p1', false);
  await engine.setLiked('p1', false);
  await engine.setReposted('p1', true);
  await engine.setReposted('p1', true);
  assert.equal(engine.getSnapshot().posts[0].reposts, 25);
  await engine.setReposted('p1', false);
  assert.equal(engine.getSnapshot().posts[0].likes, 128);
  assert.equal(engine.getSnapshot().posts[0].reposts, 24);
});

test('following affects feed membership and both people’s counters once', async () => {
  const engine = createDemoQuitterEngine();
  assert.ok(!engine.getFeed({ kind: 'following' }).some(p => p.id === 'p6'));
  await engine.setFollowing('sam', true);
  await engine.setFollowing('sam', true);
  assert.ok(engine.getFeed({ kind: 'following' }).some(p => p.id === 'p6'));
  assert.equal(engine.getSnapshot().actors.you.following, 383);
  assert.equal(engine.getSnapshot().actors.sam.followers, 2911);
  await engine.setFollowing('sam', false);
  assert.equal(engine.getSnapshot().actors.you.following, 382);
  assert.equal(engine.getSnapshot().actors.sam.followers, 2910);
  await assert.rejects(engine.setFollowing('you', true));
});

test('post validation preserves state and counts Unicode characters', async () => {
  const engine = createDemoQuitterEngine();
  const before = engine.getSnapshot();
  await assert.rejects(engine.createPost({ text: '   ' }));
  await assert.rejects(engine.createPost({ text: '💙'.repeat(281) }));
  await assert.rejects(engine.createPost({ text: 'Hello', replyTo: 'missing' }));
  assert.equal(before, engine.getSnapshot());
  const created = await engine.createPost({ text: '💙'.repeat(280) });
  assert.equal(engine.getFeed({ kind: 'for-you' })[0].id, created.id);
  assert.ok(Object.isFrozen(created));
});

test('replies stay threaded, can be bookmarked and found, and are not own replies when reposted', async () => {
  const engine = createDemoQuitterEngine();
  const parentBefore = engine.getSnapshot().posts.find(p => p.id === 'p1')!;
  const reply = await engine.createPost({ text: 'A meaningful reply', replyTo: 'p1' });
  assert.ok(engine.getReplies('p1').some(p => p.id === reply.id));
  assert.equal(engine.getSnapshot().posts.find(p => p.id === 'p1')!.replies, parentBefore.replies + 1);
  assert.ok(!engine.getFeed({ kind: 'for-you' }).some(p => p.id === reply.id));
  await engine.setBookmarked(reply.id, true);
  assert.ok(engine.getFeed({ kind: 'bookmarks' }).some(p => p.id === reply.id));
  assert.ok(engine.getFeed({ kind: 'search', query: 'MEANINGFUL' }).some(p => p.id === reply.id));
  await engine.setReposted('r1', true);
  assert.ok(!engine.getFeed({ kind: 'profile', actorId: 'you', profileTab: 'replies' }).some(p => p.id === 'r1'));
});

test('bookmarks and search react to desired state, case, and whitespace', async () => {
  const engine = createDemoQuitterEngine();
  await engine.setBookmarked('p1', true);
  assert.ok(engine.getFeed({ kind: 'bookmarks' }).some(p => p.id === 'p1'));
  await engine.setBookmarked('p1', false);
  assert.ok(!engine.getFeed({ kind: 'bookmarks' }).some(p => p.id === 'p1'));
  assert.ok(engine.getFeed({ kind: 'search', query: '  #POSTDESIGN ' }).some(p => p.id === 'p2'));
  assert.equal(engine.searchActors(' @RESEARCHER ')[0].id, 'maya');
});

test('polls accept exactly one valid vote and preserve state on rejected votes', async () => {
  const engine = createDemoQuitterEngine();
  await engine.vote('p4', 'o2');
  const after = engine.getSnapshot();
  assert.equal(after.posts.find(p => p.id === 'p4')!.poll!.options[1].votes, 137);
  await assert.rejects(engine.vote('p4', 'o1'));
  await assert.rejects(engine.vote('p4', 'missing'));
  assert.equal(after, engine.getSnapshot());
  await assert.rejects(engine.createPost({ text: 'A question', pollOptions: ['Only one choice'] }));
});

test('messages and notification read commands update the appropriate state', async () => {
  const engine = createDemoQuitterEngine();
  await engine.markConversationRead('c1');
  assert.equal(engine.getSnapshot().conversations.find(c => c.id === 'c1')!.unread, false);
  await engine.sendMessage('c1', '  Hello there  ');
  assert.equal(engine.getSnapshot().messages.at(-1)!.text, 'Hello there');
  assert.equal(engine.getSnapshot().messages.at(-1)!.conversationId, 'c1');
  await assert.rejects(engine.sendMessage('missing', 'Hello'));
  await engine.markNotificationsRead();
  assert.ok(engine.getSnapshot().notifications.every(n => n.read));
  const readSnapshot = engine.getSnapshot();
  await engine.markNotificationsRead();
  assert.equal(readSnapshot, engine.getSnapshot());
  const reply = engine.getReplies('p5').find(p => p.id === 'r4')!;
  assert.ok(engine.getSnapshot().notifications.find(n => n.id === 'n3')!.text.includes(reply.text));
});

test('profile changes propagate without modifying earlier user snapshots', async () => {
  const engine = createDemoQuitterEngine();
  const before = engine.getSnapshot();
  await engine.updateProfile({ name: 'New name', bio: 'A new bio', location: 'Bengaluru', website: 'example.com' });
  assert.equal(engine.getSnapshot().actors.you.name, 'New name');
  assert.equal(before.actors.you.name, 'Surshar');
  await assert.rejects(engine.updateProfile({ name: '', bio: '', location: '', website: '' }));
});

test('design changes only the chosen post presentation and keeps earlier snapshots intact', async () => {
  const fixtures = createFixtures();
  const photo = { src: '/mountain-lake.jpg', alt: 'A reference image' };
  const engine = createDemoQuitterEngine({ ...fixtures, posts: fixtures.posts.map(p => p.id === 'p3' ? { ...p, image: photo } : p) });
  const before = engine.getSnapshot();
  const original = before.posts.find(p => p.id === 'p3')!;
  const input: PostDesign = { layout: 'card', accent: 'mint' };
  await engine.setPostDesign('p3', input);
  const after = engine.getSnapshot();
  const updated = after.posts.find(p => p.id === 'p3')!;
  assert.deepEqual(updated, { ...original, design: input });
  assert.equal(updated.image, original.image);
  assert.equal(original.design, undefined);
  assert.equal(after.actors, before.actors);
  assert.equal(after.notifications, before.notifications);
  assert.ok(Object.isFrozen(updated.design));
  assert.notEqual(updated.design, input);
  for (const post of before.posts.filter(p => p.id !== 'p3')) assert.equal(after.posts.find(p => p.id === post.id), post);
});

test('reactions, replies, bookmarks and poll votes preserve customized design', async () => {
  const engine = createDemoQuitterEngine();
  const design: PostDesign = { layout: 'compact', accent: 'violet' };
  await engine.setPostDesign('p4', design);
  await engine.setLiked('p4', true);
  await engine.setReposted('p4', true);
  await engine.setBookmarked('p4', true);
  await engine.createPost({ text: 'Keep the full decision in view.', replyTo: 'p4' });
  await engine.vote('p4', 'o2');
  const post = engine.getSnapshot().posts.find(p => p.id === 'p4')!;
  assert.deepEqual(post.design, design);
  assert.equal(post.poll!.votedOptionId, 'o2');
  assert.equal(post.replies, 1);
  assert.equal(post.authorId, 'studio');
  assert.equal(engine.getReplies('p4')[0].replyTo, 'p4');
});

test('applying the same design is idempotent and reset restores the default', async () => {
  const engine = createDemoQuitterEngine();
  let events = 0;
  engine.subscribe(() => events++);
  const initial = engine.getSnapshot();
  await engine.setPostDesign('p1', DEFAULT_POST_DESIGN);
  assert.equal(engine.getSnapshot(), initial);
  await engine.setPostDesign('p1', { layout: 'card', accent: 'mint' });
  const designed = engine.getSnapshot();
  await engine.setPostDesign('p1', { layout: 'card', accent: 'mint' });
  assert.equal(engine.getSnapshot(), designed);
  assert.equal(events, 1);
  await engine.setPostDesign('p1', DEFAULT_POST_DESIGN);
  assert.deepEqual(engine.getSnapshot().posts.find(p => p.id === 'p1')!.design, DEFAULT_POST_DESIGN);
  assert.equal(events, 2);
});

test('unsupported designs and missing posts reject without publishing changes', async () => {
  const engine = createDemoQuitterEngine();
  const before = engine.getSnapshot();
  for (const value of [null, {}, { layout: 'script', accent: 'blue' }, { layout: 'plain', accent: '<style>' }, { layout: { toString: () => 'plain' }, accent: 'blue' }]) {
    await assert.rejects(engine.setPostDesign('p1', value as PostDesign), error => error instanceof Error && 'code' in error && error.code === 'validation');
  }
  await assert.rejects(engine.setPostDesign('missing', DEFAULT_POST_DESIGN), error => error instanceof Error && 'code' in error && error.code === 'not-found');
  assert.equal(engine.getSnapshot(), before);
});
