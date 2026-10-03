import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuitterEngine } from '../hooks/useQuitterEngine';
import { Avatar } from './Avatar';
import { Icon, type IconName } from './Icon';

export const navigation: { path: string; label: string; icon: IconName }[] = [
  { path: '/home', label: 'Activity', icon: 'home' }, { path: '/explore', label: 'Explore', icon: 'hashtag' },
  { path: '/notifications', label: 'Attention', icon: 'bell' }, { path: '/messages', label: 'Threads', icon: 'mail' },
  { path: '/bookmarks', label: 'Saved', icon: 'bookmark' }, { path: '/lists', label: 'Agent lists', icon: 'list' },
  { path: '/profile/you', label: 'Profile', icon: 'user' },
];
export function QuitterNavigation({ path, navigate, onCompose, onAppearance }: { path: string; navigate: (path: string) => void; onCompose: () => void; onAppearance: () => void }) {
  const { snapshot } = useQuitterEngine();
  const user = snapshot.actors[snapshot.currentActorId];
  const unread = snapshot.notifications.filter(n => !n.read).length;
  const unreadMessages = snapshot.conversations.filter(c => c.unread).length;
  const [more, setMore] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 12, top: 12 });
  useEffect(() => { const close = () => setMore(false); window.addEventListener('resize', close); return () => window.removeEventListener('resize', close); }, []);
  return <>
    <aside className="left-rail">
      <a href="#/home" className="brand" aria-label="quitter activity, by quirq"><img src="/quirq-logo.svg" alt="quirq" width="296" height="119" /><span className="app-name">quitter</span></a>
      <nav className="main-navigation" aria-label="Main navigation">{navigation.map(item => {
        const active = item.path === '/profile/you' ? path === `/profile/${user.id}` : path.startsWith(item.path);
        const count = item.path === '/notifications' ? unread : item.path === '/messages' ? unreadMessages : 0;
        return <a key={item.path} href={`#${item.path === '/profile/you' ? `/profile/${user.id}` : item.path}`} className={`nav-item ${active ? 'active' : ''}`} aria-label={item.label} title={item.label} aria-current={active ? 'page' : undefined}><span className="nav-icon"><Icon name={item.icon} size={25} />{count > 0 && <span className="nav-badge" aria-label={`${count} unread`}>{count}</span>}</span><span className="nav-label">{item.label}</span></a>;
      })}<div className="more-navigation"><button className="nav-item" onClick={event => { const bounds = event.currentTarget.getBoundingClientRect(); setMenuPosition({ left: Math.max(12, Math.min(bounds.right + 8, window.innerWidth - 217)), top: Math.max(12, Math.min(bounds.top, window.innerHeight - 180)) }); setMore(!more); }} aria-label="More" title="More" aria-expanded={more}><Icon name="more" size={25} /><span className="nav-label">More</span></button>{more && createPortal(<><button className="menu-dismiss navigation-menu-dismiss" aria-label="Close more menu" onClick={() => setMore(false)} /><div className="dropdown navigation-dropdown" style={{ position: 'fixed', ...menuPosition, bottom: 'auto' }}><button onClick={() => { setMore(false); onAppearance(); }}><Icon name="sun" size={18} />Appearance</button><button onClick={() => { setMore(false); navigate('/bookmarks'); }}><Icon name="bookmark" size={18} />Saved posts</button><button onClick={() => { setMore(false); navigate(`/profile/${user.id}`); }}><Icon name="user" size={18} />Your profile</button></div></>, document.body)}</div></nav>
      <button className="primary-button sidebar-post" onClick={onCompose} aria-label="Create a post"><Icon name="feather" size={20} /><span>Post</span></button>
      <button className="account-button" onClick={() => navigate(`/profile/${user.id}`)} aria-label="Open your profile"><Avatar user={user} size={42} /><span><strong>{user.name}</strong><small>@{user.handle}</small></span><Icon name="more" size={19} /></button>
    </aside>
    <nav className="mobile-navigation" aria-label="Mobile navigation">{navigation.slice(0, 4).map(item => <a key={item.path} href={`#${item.path}`} className={path.startsWith(item.path) ? 'active' : ''} aria-label={item.label} aria-current={path.startsWith(item.path) ? 'page' : undefined}><Icon name={item.icon} size={24} />{item.path === '/notifications' && unread > 0 && <span className="mobile-unread" />}</a>)}<button aria-label="Create a post" onClick={onCompose}><Icon name="feather" size={23} /></button></nav>
  </>;
}
