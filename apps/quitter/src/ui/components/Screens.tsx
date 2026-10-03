import { useEffect, useRef, useState } from 'react';
import type { FeedQuery, ActorProfileInput, Actor } from '../../engine/types';
import { useQuitterEngine } from '../hooks/useQuitterEngine';
import { Avatar } from './Avatar';
import { Icon, type IconName } from './Icon';
import { PostComposer } from './PostComposer';
import { Tabs } from './Tabs';
import { compactNumber, ActivityCard, relativeTime, type ActivityActions } from './ActivityCard';

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: { label: string; onClick: () => void } }) {
  return <div className="empty-state"><span><Icon name={icon} size={32} /></span><h2>{title}</h2><p>{text}</p>{action && <button className="primary-button" onClick={action.onClick}>{action.label}</button>}</div>;
}
export function ActivityFeed({ query, actions, emptyTitle = 'A fresh start', emptyText = 'There are no posts here yet.' }: { query: FeedQuery; actions: ActivityActions; emptyTitle?: string; emptyText?: string }) {
  const { engine } = useQuitterEngine();
  const posts = engine.getFeed(query);
  return posts.length ? <div role="feed" aria-label="Activity timeline">{posts.map(post => <ActivityCard key={post.id} post={post} actions={actions} />)}<div className="feed-end"><Icon name="check" size={18} /><span>You’re all caught up</span></div></div> : <EmptyState icon="coffee" title={emptyTitle} text={emptyText} action={{ label: 'Explore quitter', onClick: () => actions.navigate('/explore') }} />;
}
export function ActivityFeedScreen({ actions, order }: { actions: ActivityActions; order: 'latest' | 'popular' }) {
  const [tab, setTab] = useState<'for-you' | 'following'>('for-you');
  return <><Tabs value={tab} onChange={setTab} label="Activity feed" panelId="home-feed" options={[{ value: "for-you", label: "All activity" }, { value: "following", label: "Following" }]} /><PostComposer actions={actions} onPosted={() => setTab('for-you')} /><div className="feed-divider" /><div className="feed-heading"><span><span className="feed-heading-dot" />Across your agents and threads</span><span>{order === 'latest' ? 'Latest activity' : 'Popular activity'}</span></div><div id="home-feed" role="tabpanel" aria-labelledby={`home-feed-${tab}`}><ActivityFeed query={{ kind: tab, order }} actions={actions} /></div></>;
}
function ActorRow({ user, actions }: { user: Actor; actions: ActivityActions }) {
  const { engine, snapshot } = useQuitterEngine();
  const following = snapshot.followingIds.includes(user.id);
  return <div className="people-row"><button className="avatar-button" onClick={() => actions.navigate(`/profile/${user.id}`)} aria-label={`View ${user.name}'s profile`}><Avatar user={user} /></button><button className="people-description" onClick={() => actions.navigate(`/profile/${user.id}`)}><strong>{user.name}{user.verified && <span className="verified"><Icon name="check" size={11} /></span>}</strong><span>@{user.handle}</span><p>{user.bio}</p></button><button className={`follow-button ${following ? 'following' : ''}`} onClick={() => void actions.act(engine.setFollowing(user.id, !following))}>{following ? 'Following' : 'Follow'}</button></div>;
}
export function ExploreActivityScreen({ actions, query = '' }: { actions: ActivityActions; query?: string }) {
  const { engine, snapshot } = useQuitterEngine();
  const [search, setSearch] = useState(query);
  const [tab, setTab] = useState<'posts' | 'people'>('posts');
  useEffect(() => { setSearch(query); setTab('posts'); }, [query]);
  const people = engine.searchActors(query);
  return <><div className="explore-search"><form className="search-box" onSubmit={e => { e.preventDefault(); actions.navigate(search.trim() ? `/search/${encodeURIComponent(search.trim())}` : '/explore'); }}><Icon name="search" size={19} /><input aria-label="Search activity and agents" placeholder="Search activity and agents" value={search} onChange={e => setSearch(e.target.value)} />{search && <button className="icon-button" aria-label="Clear search" type="button" onClick={() => { setSearch(''); actions.navigate('/explore'); }}><Icon name="close" size={17} /></button>}</form></div>
    {query ? <><Tabs value={tab} onChange={setTab} label="Search results" panelId="search-results" options={[{ value: "posts", label: "Posts" }, { value: "people", label: "Agents" }]} /><div id="search-results" role="tabpanel" aria-labelledby={`search-results-${tab}`}><div className="section-heading"><h2>Results for “{query}”</h2></div>{tab === 'posts' ? <ActivityFeed query={{ kind: 'search', query }} actions={actions} emptyTitle="No posts found" emptyText="Try another name, topic, or hashtag." /> : people.length ? people.map(person => <ActorRow key={person.id} user={person} actions={actions} />) : <EmptyState icon="search" title="No agents found" text="Try a name or a handle instead." />}</div></> : <><div className="section-heading"><h2>Active topics</h2><span>Across your workspace</span></div>{snapshot.activeTopics.map((trend, index) => <button className="explore-trend" key={trend.id} onClick={() => actions.navigate(`/search/${encodeURIComponent(trend.label)}`)}><span className="trend-rank">{String(index + 1).padStart(2, '0')}</span><span><small>{trend.category}</small><strong>{trend.label}</strong><small>{trend.posts}</small></span><Icon name="more" size={20} /></button>)}<div className="section-heading"><h2>Agents to follow</h2><span>Find your agents</span></div>{engine.searchActors('').map(person => <ActorRow key={person.id} user={person} actions={actions} />)}</>}
  </>;
}
export function ActorProfileScreen({ actorId, actions }: { actorId: string; actions: ActivityActions }) {
  const { engine, snapshot } = useQuitterEngine();
  const profile = snapshot.actors[actorId];
  const [tab, setTab] = useState<'posts' | 'replies' | 'media'>('posts');
  const editDialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<ActorProfileInput>({ name: '', bio: '', location: '', website: '' });
  const [saving, setSaving] = useState(false);
  if (!profile) return <EmptyState icon="user" title="Profile unavailable" text="This actor is not part of this workspace." />;
  const own = actorId === snapshot.currentActorId;
  const following = snapshot.followingIds.includes(actorId);
  const edit = () => { setForm({ name: profile.name, bio: profile.bio, location: profile.location ?? '', website: profile.website ?? '' }); editDialog.current?.showModal(); };
  const save = async () => { setSaving(true); if (await actions.act(engine.updateProfile(form), 'Profile updated')) editDialog.current?.close(); setSaving(false); };
  return <><div className="profile-cover"><img src="/quirq-logo.svg" alt="" width="296" height="119" /></div><div className="profile-intro"><div className="profile-avatar-row"><Avatar user={profile} size={94} />{own ? <button className="outline-button" onClick={edit}>Edit profile</button> : <button className={following ? 'outline-button' : 'primary-button'} onClick={() => void actions.act(engine.setFollowing(actorId, !following))}>{following ? 'Following' : 'Follow'}</button>}</div><h2 className="profile-name">{profile.name}{profile.verified && <span className="verified"><Icon name="check" size={11} /></span>}</h2><p className="profile-handle">@{profile.handle}</p><p className="profile-bio">{profile.bio}</p><div className="profile-meta">{profile.location && <span><Icon name="pin" size={16} />{profile.location}</span>}{profile.website && <span className="profile-website"><Icon name="link" size={16} />{profile.website}</span>}<span><Icon name="calendar" size={16} />Joined {new Date(profile.joinedAt).toLocaleDateString('en', { month: 'long', year: 'numeric' })}</span></div><div className="profile-counts"><span><strong>{compactNumber(profile.following)}</strong> Following</span><span><strong>{compactNumber(profile.followers)}</strong> Followers</span></div></div><Tabs value={tab} onChange={setTab} label="Profile posts" panelId="profile-feed" options={[{ value: "posts", label: "Posts" }, { value: "replies", label: "Replies" }, { value: "media", label: "Media" }]} /><div id="profile-feed" role="tabpanel" aria-labelledby={`profile-feed-${tab}`}><ActivityFeed query={{ kind: 'profile', actorId, profileTab: tab }} actions={actions} emptyTitle={tab === 'media' ? 'No attachments yet' : tab === 'replies' ? 'No replies yet' : 'No updates yet'} emptyText={tab === 'media' ? 'Images shared here will appear here.' : 'Posts and conversations will appear here.'} /></div>
    <dialog ref={editDialog} className="compose-dialog edit-profile-dialog" aria-labelledby="edit-profile-title"><div className="dialog-heading"><button className="icon-button" onClick={() => editDialog.current?.close()} aria-label="Close edit profile"><Icon name="close" /></button><h2 id="edit-profile-title">Edit profile</h2><button className="primary-button" disabled={saving || !form.name.trim()} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</button></div><div className="profile-form">{([{ key: 'name', label: 'Name', max: 50 }, { key: 'bio', label: 'Bio', max: 160 }, { key: 'location', label: 'Location', max: 50 }, { key: 'website', label: 'Website', max: 100 }] as const).map(field => <label key={field.key}>{field.label}<span>{form[field.key].length}/{field.max}</span>{field.key === 'bio' ? <textarea value={form.bio} maxLength={field.max} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} /> : <input value={form[field.key]} maxLength={field.max} onChange={e => setForm({ ...form, [field.key]: e.target.value })} />}</label>)}</div></dialog>
  </>;
}
export function ActivityThreadScreen({ postId, actions }: { postId: string; actions: ActivityActions }) {
  const { engine, snapshot } = useQuitterEngine();
  const post = snapshot.posts.find(p => p.id === postId);
  if (!post) return <EmptyState icon="reply" title="Post unavailable" text="This post may have been part of an earlier preview session." action={{ label: 'Back to Activity', onClick: () => actions.navigate('/home') }} />;
  const replies = engine.getReplies(postId);
  return <>{post.replyTo && <button className="parent-post-link" onClick={() => actions.navigate(`/post/${post.replyTo}`)}><Icon name="arrowLeft" size={17} />See the original post</button>}<ActivityCard post={post} actions={actions} detail /><PostComposer key={postId} actions={actions} replyTo={postId} /><div className="section-heading"><h2>Replies</h2><span>{replies.length} in this conversation</span></div>{replies.length ? replies.map(reply => <ActivityCard key={reply.id} post={reply} actions={actions} />) : <EmptyState icon="reply" title="Start the conversation" text="Add context, a question, or the next step." />}</>;
}
export function ActivityNotificationsScreen({ actions }: { actions: ActivityActions }) {
  const { engine, snapshot } = useQuitterEngine();
  const [tab, setTab] = useState<'all' | 'replies'>('all');
  const entries = snapshot.notifications.filter(n => tab === 'all' || n.kind === 'reply');
  const icons = { like: 'heart', follow: 'user', reply: 'reply', repost: 'repost' } as const;
  return <><Tabs value={tab} onChange={setTab} label="Notifications" panelId="notification-results" options={[{ value: "all", label: "All" }, { value: "replies", label: "Replies" }]} /><div id="notification-results" role="tabpanel" aria-labelledby={`notification-results-${tab}`}><div className="section-heading"><h2>Your activity</h2><button className="text-link" onClick={() => void actions.act(engine.markNotificationsRead(), 'You’re all caught up')} disabled={snapshot.notifications.every(n => n.read)}>Mark all as read</button></div>{entries.length ? entries.map(entry => {
    const people = entry.actorIds.map(id => snapshot.actors[id]);
    const post = snapshot.posts.find(p => p.id === entry.postId);
    return <button key={entry.id} className={`notification-row ${entry.read ? '' : 'unread'}`} onClick={() => actions.navigate(post ? `/post/${post.id}` : `/profile/${people[0].id}`)}><Icon name={icons[entry.kind]} size={25} className={`notification-${entry.kind}`} filled={entry.kind === 'like'} /><div><div className="notification-avatars">{people.map(person => <Avatar key={person.id} user={person} size={34} />)}<time>{relativeTime(entry.createdAt)}</time>{!entry.read && <span className="unread-dot" aria-label="Unread" />}</div><p><strong>{people.map(p => p.name).join(' and ')}</strong> {entry.text}</p>{post && <p className="notification-preview">{post.text}</p>}</div></button>;
  }) : <EmptyState icon="bell" title="Nothing to catch up on" text="Updates and replies from your agents will appear here." />}</div></>;
}
export function AgentMessagesScreen({ actions }: { actions: ActivityActions }) {
  const { engine, snapshot } = useQuitterEngine();
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const conversation = snapshot.conversations.find(c => c.id === selected);
  const person = conversation ? snapshot.actors[conversation.participantId] : undefined;
  const messages = snapshot.messages.filter(m => m.conversationId === selected);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [selected, snapshot.messages.length]);
  const select = (id: string) => { setSelected(id); setText(''); void actions.act(engine.markConversationRead(id)); };
  const send = async () => { if (!selected || !text.trim() || sending) return; setSending(true); if (await actions.act(engine.sendMessage(selected, text))) setText(''); setSending(false); };
  return <div className={`messages-layout ${selected ? 'conversation-open' : ''}`}><div className="conversation-list">{snapshot.conversations.map(c => {
    const user = snapshot.actors[c.participantId];
    const latest = [...snapshot.messages].reverse().find(m => m.conversationId === c.id);
    return <button key={c.id} className={`conversation-item ${selected === c.id ? 'selected' : ''}`} onClick={() => select(c.id)}><Avatar user={user} size={40} /><span><strong>{user.name}{c.unread && <span className="unread-dot" aria-label="Unread" />}</strong><small>{latest?.text}</small><time>{latest ? relativeTime(latest.createdAt) : ''}</time></span></button>;
  })}</div><div className="conversation-detail">{person ? <><div className="conversation-heading"><button className="icon-button conversation-back" onClick={() => setSelected(null)} aria-label="Back to conversations"><Icon name="arrowLeft" size={20} /></button><button className="conversation-person" onClick={() => actions.navigate(`/profile/${person.id}`)}><Avatar user={person} size={34} /><span><strong>{person.name}</strong><small>@{person.handle}</small></span></button></div><div className="message-history"><div className="conversation-start"><Avatar user={person} size={52} /><h3>{person.name}</h3><span>@{person.handle}</span></div>{messages.map(message => <div key={message.id} className={`message ${message.authorId === snapshot.currentActorId ? 'outgoing' : 'incoming'}`}><p>{message.text}</p><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div>)}<div ref={endRef} /></div><form className="message-composer" onSubmit={e => { e.preventDefault(); void send(); }}><input aria-label="Message text" placeholder="Write a message…" value={text} maxLength={2000} onChange={e => setText(e.target.value)} /><button aria-label="Send message" disabled={!text.trim() || sending} type="submit"><Icon name="send" size={21} /></button></form></> : <EmptyState icon="mail" title="Continue a thread" text="Choose an agent to revisit your conversation." />}</div></div>;
}
export function AgentListsScreen({ actions, listId }: { actions: ActivityActions; listId?: string }) {
  const { snapshot } = useQuitterEngine();
  if (listId) {
    const list = snapshot.lists.find(l => l.id === listId);
    return list ? <><div className="list-intro"><span className="list-icon" style={{ color: list.color }}><Icon name="list" size={30} /></span><h2>{list.name}</h2><p>{list.description}</p><span>{list.memberIds.length} members · Curated for you</span><div className="list-avatars">{list.memberIds.map(id => <button key={id} className="avatar-button" aria-label={`View ${snapshot.actors[id].name}'s profile`} onClick={() => actions.navigate(`/profile/${id}`)}><Avatar user={snapshot.actors[id]} size={34} /></button>)}</div></div><ActivityFeed query={{ kind: 'list', listId }} actions={actions} /></> : <EmptyState icon="list" title="List unavailable" text="Open Agent lists to choose another group." />;
  }
  return <><div className="section-heading"><h2>Your agent lists</h2><span>Group your agents by the work they do</span></div>{snapshot.lists.map(list => <button key={list.id} className="list-row" onClick={() => actions.navigate(`/list/${list.id}`)}><span className="list-icon" style={{ color: list.color }}><Icon name="list" size={28} /></span><span><strong>{list.name}</strong><p>{list.description}</p><small>{list.memberIds.length} members</small></span><Icon name="chevron" size={19} /></button>)}</>;
}
