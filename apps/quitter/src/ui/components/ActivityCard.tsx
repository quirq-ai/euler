import { useRef, useState } from 'react';
import type { ActivityPost } from '../../engine/types';
import { useQuitterEngine } from '../hooks/useQuitterEngine';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { ActivityBody, ActivityPresentation } from './ActivityPresentation';
import { PostDesignEditor } from './PostDesignEditor';

export const compactNumber = (n: number) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60_000));
  return minutes < 1 ? 'now' : minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
}
export interface ActivityActions { navigate: (path: string) => void; notify: (message: string) => void; act: (promise: Promise<unknown>, success?: string) => Promise<boolean> }
export function ActivityCard({ post, actions, detail = false }: { post: ActivityPost; actions: ActivityActions; detail?: boolean }) {
  const { engine, snapshot } = useQuitterEngine();
  const author = snapshot.actors[post.authorId];
  const [menu, setMenu] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const navigatePost = () => actions.navigate(`/post/${post.id}`);
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/post/${post.id}`;
    try { await navigator.clipboard.writeText(url); actions.notify('Post link copied'); }
    catch { actions.notify('Open the post and copy its address to share it.'); }
    setMenu(false);
  };
  return <article className={`post-card ${detail ? 'post-detail' : ''}`}>
    {post.reposted && <div className="reposted-caption"><Icon name="repost" size={15} /> You reposted</div>}
    <div className="post-layout">
      <button className="avatar-button" onClick={() => actions.navigate(`/profile/${author.id}`)} aria-label={`View ${author.name}'s profile`}><Avatar user={author} /></button>
      <div className="post-content">
        <div className="post-heading">
          <button className="author-name" onClick={() => actions.navigate(`/profile/${author.id}`)}>{author.name}{author.verified && <span className="verified" aria-label="Verified"><Icon name="check" size={11} /></span>}</button>
          <span className="post-handle">@{author.handle}</span><span className="post-dot">·</span>
          <button className="post-time-link" onClick={navigatePost} aria-label={`Open ${author.name}'s post`}><time dateTime={post.createdAt} title={new Date(post.createdAt).toLocaleString()}>{relativeTime(post.createdAt)}</time></button>
          <div className="post-menu"><button ref={menuTrigger} className="icon-button" onClick={() => setMenu(!menu)} aria-label={`More options for ${author.name}'s post`} aria-expanded={menu}><Icon name="more" size={20} /></button>
            {menu && <><button className="menu-dismiss" onClick={() => setMenu(false)} aria-label="Close post menu" /><div className="dropdown"><button onClick={() => { setMenu(false); setCustomizing(true); }}><Icon name="grid" size={18} />Customize design</button><button onClick={() => { actions.navigate(`/profile/${author.id}`); setMenu(false); }}><Icon name="user" size={18} />View profile</button><button onClick={() => { void actions.act(engine.setBookmarked(post.id, !post.bookmarked)); setMenu(false); }}><Icon name="bookmark" size={18} />{post.bookmarked ? 'Remove bookmark' : 'Bookmark post'}</button><button onClick={() => void share()}><Icon name="link" size={18} />Copy post link</button></div></>}
          </div>
        </div>
        <ActivityPresentation design={post.design}><ActivityBody post={post} onOpen={navigatePost} onTag={tag => actions.navigate(`/search/${encodeURIComponent(tag)}`)} onVote={optionId => void actions.act(engine.vote(post.id, optionId), 'Your vote is in')} /></ActivityPresentation>
        {detail && <p className="detail-time">{new Date(post.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} · <strong>{compactNumber(post.views)}</strong> Views</p>}
        <div className="post-actions">
          <button className="post-action action-reply" onClick={navigatePost} aria-label={`Reply to ${author.name}'s post`}><Icon name="reply" size={18} /><span>{post.replies || ''}</span></button>
          <button className={`post-action action-repost ${post.reposted ? 'active' : ''}`} onClick={() => void actions.act(engine.setReposted(post.id, !post.reposted))} aria-label={post.reposted ? 'Undo repost' : 'Repost'} aria-pressed={post.reposted}><Icon name="repost" size={19} /><span>{post.reposts || ''}</span></button>
          <button className={`post-action action-like ${post.liked ? 'active' : ''}`} onClick={() => void actions.act(engine.setLiked(post.id, !post.liked))} aria-label={post.liked ? 'Unlike' : 'Like'} aria-pressed={post.liked}><Icon name="heart" size={18} filled={post.liked} /><span>{post.likes || ''}</span></button>
          <span className="post-action view-count" title={`${post.views} views`}><Icon name="views" size={17} /><span>{compactNumber(post.views)}</span></span>
          <div className="post-action-end"><button className={`post-action ${post.bookmarked ? 'active' : ''}`} aria-label={post.bookmarked ? 'Remove bookmark' : 'Bookmark'} aria-pressed={post.bookmarked} onClick={() => void actions.act(engine.setBookmarked(post.id, !post.bookmarked), post.bookmarked ? 'Bookmark removed' : 'Saved to your bookmarks')}><Icon name="bookmark" size={17} filled={post.bookmarked} /></button><button className="post-action" onClick={() => void share()} aria-label="Copy post link"><Icon name="share" size={17} /></button></div>
        </div>
      </div>
    </div>
    {customizing && <PostDesignEditor post={post} notify={actions.notify} onClose={() => { setCustomizing(false); menuTrigger.current?.focus(); }} />}
  </article>;
}
