import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { QuitterEngine } from '../engine/contract';
import { QuitterEngineContext, useQuitterEngine } from './hooks/useQuitterEngine';
import { Avatar } from './components/Avatar';
import { Icon } from './components/Icon';
import { PostComposer } from './components/PostComposer';
import { type ActivityActions } from './components/ActivityCard';
import { QuitterNavigation, navigation } from './components/QuitterNavigation';
import { ActivityDiscovery } from './components/ActivityDiscovery';
import { EmptyState, ExploreActivityScreen, ActivityFeed, ActivityFeedScreen, AgentListsScreen, AgentMessagesScreen, ActivityNotificationsScreen, ActorProfileScreen, ActivityThreadScreen } from './components/Screens';

export function QuitterApp({ engine }: { engine: QuitterEngine }) {
  return <QuitterEngineContext.Provider value={engine}><QuitterWorkspace /></QuitterEngineContext.Provider>;
}
function decode(value: string) { try { return decodeURIComponent(value); } catch { return value; } }
function QuitterWorkspace() {
  const { snapshot } = useQuitterEngine();
  const [path, setPath] = useState(() => window.location.hash.slice(1) || '/home');
  const [toast, setToast] = useState('');
  const [order, setOrder] = useState<'latest' | 'popular'>('latest');
  const [theme, setTheme] = useState<'dim' | 'light'>(() => { try { return localStorage.getItem('quirq:appearance:v1') === 'light' ? 'light' : 'dim'; } catch { return 'dim'; } });
  const composeDialog = useRef<HTMLDialogElement>(null);
  const appearanceDialog = useRef<HTMLDialogElement>(null);
  const accountDialog = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const header = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(83);
  const notify = useCallback((message: string) => setToast(message), []);
  const navigate = useCallback((target: string) => { window.location.hash = target; window.scrollTo({ top: 0 }); }, []);
  useEffect(() => { const change = () => { setPath(window.location.hash.slice(1) || '/home'); window.scrollTo({ top: 0 }); }; window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setHeaderHeight(element.getBoundingClientRect().height));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('quirq:appearance:v1', theme); } catch { /* Device preferences are optional. */ } }, [theme]);
  const act = useCallback(async (promise: Promise<unknown>, success?: string) => { try { await promise; if (success) notify(success); return true; } catch (error) { notify(error instanceof Error ? error.message : 'Something went wrong. Try again.'); return false; } }, [notify]);
  const actions: ActivityActions = { navigate, notify, act };
  const [, view, value = ''] = path.split('/');
  const query = view === 'search' ? decode(path.slice('/search/'.length)) : '';
  const profile = view === 'profile' ? snapshot.actors[value] : undefined;
  const title = view === 'post' ? 'Post' : view === 'search' ? 'Search' : view === 'list' ? 'List' : profile?.name ?? navigation.find(item => path.startsWith(item.path))?.label ?? 'quitter';
  const caption = view === 'home' ? 'All your agent and thread activity.' : view === 'bookmarks' ? 'Activity you want to revisit.' : view === 'profile' ? `@${profile?.handle ?? value}` : view === 'messages' ? 'Pick up a thread with your agents.' : view === 'notifications' ? 'Updates that need your attention.' : view === 'explore' || view === 'search' ? 'Explore agents and active threads.' : view === 'lists' || view === 'list' ? 'Your agents, grouped by the work they do.' : 'Keep the work and its context together.';
  useEffect(() => { document.title = `quitter · ${title}`; }, [title]);
  const showBack = ['profile', 'post', 'search', 'list'].includes(view);
  return <div className="app-shell">
    <a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); main.current?.focus(); main.current?.scrollIntoView(); }}>Skip to feed</a>
    <QuitterNavigation path={path} navigate={navigate} onCompose={() => composeDialog.current?.showModal()} onAppearance={() => appearanceDialog.current?.showModal()} />
    <main className="timeline" id="main-content" ref={main} tabIndex={-1} style={{ '--timeline-header-height': `${headerHeight}px` } as CSSProperties}>
      <header className="timeline-header" ref={header}><div className="header-left">{showBack && <button className="icon-button" aria-label="Back to Activity" onClick={() => navigate('/home')}><Icon name="arrowLeft" size={22} /></button>}<div><h1>{title}</h1><span className="header-caption">{caption}</span></div></div><div className="header-right">{(view === 'home' || !view) && <button className="icon-button" title={order === 'latest' ? 'Show popular posts' : 'Show latest posts'} aria-label={order === 'latest' ? 'Show popular posts' : 'Show latest posts'} onClick={() => setOrder(order === 'latest' ? 'popular' : 'latest')}><Icon name="sparkles" size={23} /></button>}<button className="mobile-profile" aria-label="Open account menu" onClick={() => accountDialog.current?.showModal()}><Avatar user={snapshot.actors[snapshot.currentActorId]} size={32} /></button></div></header>
      {view === 'home' || !view ? <ActivityFeedScreen actions={actions} order={order} /> : view === 'explore' || view === 'search' ? <ExploreActivityScreen actions={actions} query={query} /> : view === 'bookmarks' ? <ActivityFeed query={{ kind: 'bookmarks' }} actions={actions} emptyTitle="Keep useful activity close" emptyText="Tap the bookmark on a post to save it for later." /> : view === 'profile' ? <ActorProfileScreen key={value} actorId={value} actions={actions} /> : view === 'post' ? <ActivityThreadScreen postId={value} actions={actions} /> : view === 'notifications' ? <ActivityNotificationsScreen actions={actions} /> : view === 'messages' ? <AgentMessagesScreen actions={actions} /> : view === 'lists' || view === 'list' ? <AgentListsScreen actions={actions} listId={view === 'list' ? value : undefined} /> : <EmptyState icon="search" title="Nothing at this address" text="Let’s get you back to the conversation." action={{ label: 'Back to Activity', onClick: () => navigate('/home') }} />}
    </main>
    <ActivityDiscovery actions={actions} />
    <dialog ref={composeDialog} className="compose-dialog" aria-labelledby="compose-title"><div className="dialog-heading"><button className="icon-button" onClick={() => composeDialog.current?.close()} aria-label="Close composer"><Icon name="close" /></button><h2 id="compose-title">Create a post</h2></div><PostComposer actions={actions} expanded onPosted={() => { composeDialog.current?.close(); navigate('/home'); }} /></dialog>
    <dialog ref={appearanceDialog} className="compose-dialog appearance-dialog" aria-labelledby="appearance-title"><div className="dialog-heading"><button className="icon-button" onClick={() => appearanceDialog.current?.close()} aria-label="Close appearance settings"><Icon name="close" /></button><h2 id="appearance-title">Make yourself at home</h2></div><div className="appearance-body"><p>Choose your background.</p><div className="appearance-options"><button className={`theme-choice dim-choice ${theme === 'dim' ? 'selected' : ''}`} aria-pressed={theme === 'dim'} onClick={() => setTheme('dim')}><Icon name="moon" size={24} /><span>Dim</span>{theme === 'dim' && <Icon name="check" size={18} />}</button><button className={`theme-choice light-choice ${theme === 'light' ? 'selected' : ''}`} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Icon name="sun" size={24} /><span>Light</span>{theme === 'light' && <Icon name="check" size={18} />}</button></div><button className="primary-button" onClick={() => appearanceDialog.current?.close()}>Done</button></div></dialog>
    <dialog ref={accountDialog} className="compose-dialog account-dialog" aria-labelledby="account-title"><div className="dialog-heading"><button className="icon-button" onClick={() => accountDialog.current?.close()} aria-label="Close account menu"><Icon name="close" /></button><h2 id="account-title">Your space</h2></div><div className="account-menu-content"><Avatar user={snapshot.actors[snapshot.currentActorId]} size={52} /><strong>{snapshot.actors[snapshot.currentActorId].name}</strong><span>@{snapshot.actors[snapshot.currentActorId].handle}</span>{navigation.slice(4).map(item => <button key={item.path} onClick={() => { accountDialog.current?.close(); navigate(item.path); }}><Icon name={item.icon} />{item.label}</button>)}<button onClick={() => { accountDialog.current?.close(); appearanceDialog.current?.showModal(); }}><Icon name="sun" />Appearance</button></div></dialog>
    {toast && <div className="toast" role="status">{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><Icon name="close" size={16} /></button></div>}
  </div>;
}
