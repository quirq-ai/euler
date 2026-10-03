import { useEffect, useId, useRef, useState } from 'react';
import type { ActivityPost, PostDesign } from '../../engine/types';
import { DEFAULT_POST_DESIGN } from '../../engine/postDesign';
import { useQuitterEngine } from '../hooks/useQuitterEngine';
import { ActivityBody, ActivityPresentation } from './ActivityPresentation';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

const layouts = [
  { value: 'plain', label: 'Plain', description: 'The familiar feed layout.' },
  { value: 'card', label: 'Card', description: 'A frame around the update.' },
  { value: 'compact', label: 'Compact', description: 'Less space, all the context.' },
] as const;
const accents = ['blue', 'mint', 'violet'] as const;

export function PostDesignEditor({ post, onClose, notify }: { post: ActivityPost; onClose: () => void; notify: (message: string) => void }) {
  const { engine, snapshot } = useQuitterEngine();
  const author = snapshot.actors[post.authorId];
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [draft, setDraft] = useState<PostDesign>(() => post.design ?? DEFAULT_POST_DESIGN);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const save = async () => {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      await engine.setPostDesign(post.id, draft);
      notify('Post design updated');
      dialog.current?.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your design. Try again.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  return <dialog ref={dialog} className="post-design-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onClose={() => { if (!dialog.current?.open) onClose(); }} onCancel={event => { if (pending.current) event.preventDefault(); }}>
    <div className="dialog-heading"><h2 id={`${id}-title`}>Customize post</h2><button className="icon-button" aria-label="Close post design" disabled={saving} onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
    <p id={`${id}-description`} className="design-description">Choose how this post looks in your feed. The content stays the same.</p>
    <div className="post-design-workspace">
      <div className="design-controls">
        <fieldset disabled={saving}><legend>Layout</legend>{layouts.map(layout => <label key={layout.value} className={`layout-choice ${draft.layout === layout.value ? 'selected' : ''}`}><input type="radio" name={`${id}-layout`} value={layout.value} checked={draft.layout === layout.value} onChange={() => setDraft({ ...draft, layout: layout.value })} /><span><strong>{layout.label}</strong><small>{layout.description}</small></span></label>)}</fieldset>
        <fieldset disabled={saving}><legend>Accent</legend><div className="accent-options">{accents.map(accent => <label key={accent} className={`accent-choice accent-${accent} ${draft.accent === accent ? 'selected' : ''}`}><input type="radio" name={`${id}-accent`} value={accent} checked={draft.accent === accent} onChange={() => setDraft({ ...draft, accent })} /><span className="accent-swatch" /><span>{accent}</span></label>)}</div></fieldset>
      </div>
      <section className="design-preview" aria-label="Post design preview"><span className="preview-label"><Icon name="sparkles" size={15} />Live preview</span><div className="preview-post"><div className="preview-author"><Avatar user={author} size={36} /><span><strong>{author.name}</strong><small>@{author.handle} · {author.kind === 'agent' ? 'Agent' : 'You'}</small></span></div><ActivityPresentation design={draft}><ActivityBody post={post} /></ActivityPresentation><div className="preview-actions" aria-hidden="true"><span><Icon name="reply" size={17} />{post.replies}</span><span><Icon name="repost" size={17} />{post.reposts}</span><span><Icon name="heart" size={17} />{post.likes}</span><Icon name="bookmark" size={17} /></div></div></section>
    </div>
    {error && <p className="design-error" role="alert">{error}</p>}
    <div className="design-footer"><button className="text-link" disabled={saving} onClick={() => setDraft(DEFAULT_POST_DESIGN)}>Reset design</button><div><button className="outline-button" disabled={saving} onClick={() => dialog.current?.close()}>Cancel</button><button className="primary-button" disabled={saving} onClick={() => void save()}>{saving ? 'Applying…' : 'Apply design'}</button></div></div>
  </dialog>;
}
