import type { ReactNode } from 'react';
import type { ActivityPost, PostDesign } from '../../engine/types';
import { DEFAULT_POST_DESIGN } from '../../engine/postDesign';
import { Icon } from './Icon';

export function ActivityPresentation({ design = DEFAULT_POST_DESIGN, children }: { design?: PostDesign; children: ReactNode }) {
  return <div className={`activity-presentation layout-${design.layout} accent-${design.accent}`} data-layout={design.layout} data-accent={design.accent}>{children}</div>;
}

function RichText({ text, onTag }: { text: string; onTag?: (tag: string) => void }) {
  return <>{text.split(/(#[\p{L}\p{N}_]+)/gu).map((part, i) => part.startsWith('#') ? onTag ? <button key={i} className="text-link hashtag-link" onClick={() => onTag(part)}>{part}</button> : <span key={i} className="text-link">{part}</span> : part)}</>;
}

/** The feed and design preview use the same content renderer. Preview has no commands. */
export function ActivityBody({ post, onOpen, onTag, onVote }: { post: ActivityPost; onOpen?: () => void; onTag?: (tag: string) => void; onVote?: (optionId: string) => void }) {
  const totalVotes = post.poll?.options.reduce((sum, option) => sum + option.votes, 0) ?? 0;
  const closed = !!post.poll && Date.parse(post.poll.endsAt) <= Date.now();
  const showResults = !!post.poll?.votedOptionId || closed;
  return <>
    {post.threadTitle && <div className="activity-context"><span className={`activity-kind kind-${post.kind ?? 'update'}`}>{post.kind ?? 'update'}</span>{onOpen ? <button onClick={onOpen}>{post.threadTitle}</button> : <span>{post.threadTitle}</span>}</div>}
    <div className="post-text"><RichText text={post.text} onTag={onTag} /></div>
    {post.image && (onOpen ? <button className="post-image-button" onClick={onOpen} aria-label="Open photo post"><img className="post-image" src={post.image.src} alt={post.image.alt} width="600" height="280" loading="lazy" /></button> : <div className="post-image-button"><img className="post-image" src={post.image.src} alt={post.image.alt} width="600" height="280" /></div>)}
    {post.poll && <div className="poll-options">{post.poll.options.map(option => {
      const percent = totalVotes ? Math.round(option.votes / totalVotes * 100) : 0;
      return <button key={option.id} className={`poll-option ${showResults ? 'poll-result' : ''} ${option.id === post.poll?.votedOptionId ? 'chosen' : ''}`} disabled={showResults || !onVote} onClick={() => onVote?.(option.id)}>
        {showResults && <span className="poll-bar" style={{ width: `${percent}%` }} />}<span>{option.text}{option.id === post.poll?.votedOptionId && <Icon name="check" size={15} />}</span>{showResults && <b>{percent}%</b>}
      </button>;
    })}<span className="poll-meta">{Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(totalVotes)} votes · {post.poll.votedOptionId ? 'You voted' : closed ? 'Poll closed' : '1 day left'}</span></div>}
  </>;
}
