import { useRef } from 'react';

export function Tabs<T extends string>({ options, value, onChange, label, panelId }: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  panelId: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  return <div ref={group} className="feed-tabs" role="tablist" aria-label={label} onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = options.findIndex(option => option.value === value);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onChange(options[index].value);
    group.current?.querySelectorAll<HTMLButtonElement>('button')[index]?.focus();
  }}>{options.map(option => <button key={option.value} id={`${panelId}-${option.value}`} role="tab" aria-controls={panelId} aria-selected={option.value === value} tabIndex={option.value === value ? 0 : -1} className={option.value === value ? 'active' : ''} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}
