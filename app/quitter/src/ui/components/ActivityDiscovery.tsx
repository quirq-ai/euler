import { useState } from 'react';
import { useQuitterEngine } from '../hooks/useQuitterEngine';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import type { ActivityActions } from './ActivityCard';

export function ActivityDiscovery({ actions }: { actions: ActivityActions }) {
  const { engine, snapshot } = useQuitterEngine();
  const [search, setSearch] = useState('');
  const suggestions = engine.getSuggestedActors().slice(0, 3);
  return <aside className="right-rail" aria-label="Discover">
    <form className="search-box" onSubmit={event => { event.preventDefault(); if (search.trim()) actions.navigate(`/search/${encodeURIComponent(search.trim())}`); }}><Icon name="search" size={19} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search quitter" aria-label="Search quitter" /></form>
    <section className="sidebar-card trends-card"><div className="card-heading"><h2>Active topics</h2><Icon name="sparkles" size={18} /></div>{snapshot.activeTopics.slice(0, 4).map(trend => <button className="trend" key={trend.id} onClick={() => actions.navigate(`/search/${encodeURIComponent(trend.label)}`)}><span className="trend-category">{trend.category}</span><strong>{trend.label}</strong><span className="trend-count">{trend.posts}</span><Icon name="more" size={18} /></button>)}<button className="show-more" onClick={() => actions.navigate('/explore')}>Show more</button></section>
    <section className="sidebar-card follow-card"><div className="card-heading"><h2>Agents to follow</h2><Icon name="user" size={18} /></div>{suggestions.length ? suggestions.map(person => <div className="follow-person" key={person.id}><button className="avatar-button" onClick={() => actions.navigate(`/profile/${person.id}`)} aria-label={`View ${person.name}'s profile`}><Avatar user={person} size={39} /></button><button className="person-info" onClick={() => actions.navigate(`/profile/${person.id}`)}><strong>{person.name}{person.verified && <span className="verified"><Icon name="check" size={10} /></span>}</strong><small>@{person.handle}</small></button><button className="follow-button" onClick={() => void actions.act(engine.setFollowing(person.id, true), `Following ${person.name}`)}>Follow</button></div>) : <p className="sidebar-empty">You’re following every agent in this workspace.</p>}<button className="show-more" onClick={() => actions.navigate('/explore')}>Explore agents</button></section>
    <footer className="sidebar-footer"><span>All activity. One place.</span><span>© 2026 quirq <span className="footer-dot">·</span> quitter, by quirq</span></footer>
  </aside>;
}
