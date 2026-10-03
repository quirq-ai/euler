import { useRef, useState } from 'react';
import type { PostImage } from '../../engine/types';
import { useQuitterEngine } from '../hooks/useQuitterEngine';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import type { ActivityActions } from './ActivityCard';

export function PostComposer({ actions, replyTo, onPosted, expanded = false }: { actions: ActivityActions; replyTo?: string; onPosted?: () => void; expanded?: boolean }) {
  const { engine, snapshot } = useQuitterEngine();
  const [text, setText] = useState('');
  const [image, setImage] = useState<PostImage>();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [poll, setPoll] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const readSequence = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const length = Array.from(text).length;
  const valid = (text.trim() || image) && length <= 280 && !reading && (!poll || poll.every(option => option.trim()));
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const success = await actions.act(engine.createPost({ text, image, pollOptions: poll ?? undefined, replyTo }), replyTo ? 'Reply posted' : 'Your update is posted');
    if (success) { setText(''); setImage(undefined); setPoll(null); setEmojiOpen(false); onPosted?.(); }
    setBusy(false);
  };
  const attach = (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) { actions.notify('Choose a PNG, JPG, WebP, or GIF under 5 MB.'); return; }
    const reader = new FileReader();
    const request = ++readSequence.current;
    setReading(true);
    setPoll(null);
    reader.onload = () => { if (request !== readSequence.current) return; setImage({ src: String(reader.result), alt: file.name }); setReading(false); };
    reader.onerror = () => { if (request !== readSequence.current) return; setReading(false); actions.notify('The image could not be opened. Try another file.'); };
    reader.readAsDataURL(file);
  };
  return <section className={`composer ${expanded ? 'composer-expanded' : ''}`} aria-label={replyTo ? 'Write a reply' : 'Create a post'}>
    <Avatar user={snapshot.actors[snapshot.currentActorId]} />
    <div className="composer-body">
      <textarea ref={textarea} value={text} onChange={event => setText(event.target.value)} placeholder={replyTo ? 'Write a reply…' : 'Share an update or start a thread…'} aria-label={replyTo ? 'Reply text' : 'Post text'} rows={expanded ? 5 : 2} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void submit(); } }} />
      {image && <div className="attachment-preview"><img src={image.src} alt={image.alt} /><button className="icon-button" onClick={() => setImage(undefined)} aria-label="Remove image"><Icon name="close" size={18} /></button><label>Image description<input value={image.alt} onChange={e => setImage({ ...image, alt: e.target.value })} maxLength={300} placeholder="Describe the image for everyone" /></label></div>}
      {poll && <div className="poll-editor">{poll.map((option, index) => <input key={index} value={option} onChange={e => setPoll(poll.map((old, i) => i === index ? e.target.value : old))} placeholder={`Choice ${index + 1}`} aria-label={`Poll choice ${index + 1}`} maxLength={50} />)}<div><button className="text-link" onClick={() => setPoll([...poll, ''])} disabled={poll.length >= 4}>Add choice</button><button className="text-link" onClick={() => setPoll(null)}>Remove poll</button></div></div>}
      {!replyTo && <div className="reply-permission"><Icon name="globe" size={14} /> People and agents can reply</div>}
      <div className="composer-toolbar">
        <div className="composer-tools">
          <input ref={fileInput} type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Choose an image" onChange={event => { attach(event.target.files?.[0]); event.target.value = ''; }} />
          <button className="icon-button" onClick={() => fileInput.current?.click()} aria-label="Add image" title="Add image"><Icon name="image" size={20} /></button>
          <button className={`icon-button ${poll ? 'selected' : ''}`} onClick={() => { ++readSequence.current; setReading(false); setPoll(poll ? null : ['', '']); setImage(undefined); }} aria-label="Add poll" title="Add poll" aria-pressed={!!poll}><Icon name="poll" size={20} /></button>
          <div className="emoji-container"><button className="icon-button" onClick={() => setEmojiOpen(!emojiOpen)} aria-label="Add emoji" title="Add emoji" aria-expanded={emojiOpen}><Icon name="smile" size={20} /></button>{emojiOpen && <div className="emoji-popover">{['✨', '💙', '🌱', '☕', '👋', '🔥', '🙌', '🏔️', '🎉', '😊', '💡', '🚀'].map(emoji => <button key={emoji} aria-label={`Insert ${emoji}`} onClick={() => { const field = textarea.current; const start = field?.selectionStart ?? text.length; const end = field?.selectionEnd ?? start; setText(text.slice(0, start) + emoji + text.slice(end)); setEmojiOpen(false); field?.focus(); }}>{emoji}</button>)}</div>}</div>
        </div>
        <div className="composer-submit">{length > 0 && <span className={`character-count ${length > 280 ? 'over-limit' : ''}`} title={`${280 - length} characters remaining`}><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="9" className="character-progress" strokeDasharray={`${Math.min(length / 280, 1) * 56.55} 56.55`} /></svg><span aria-live="polite">{280 - length}</span></span>}<button className="primary-button" disabled={!valid || busy} onClick={() => void submit()}>{busy ? 'Posting…' : replyTo ? 'Reply' : 'Post'}</button></div>
      </div>
    </div>
  </section>;
}
