import type { CSSProperties } from 'react';

const paths = {
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  search: 'm21 21-5-5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z',
  hashtag: 'm5 9 15 0M4 15h15M11 3 7 21M17 3l-4 18',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  mail: 'M3 5h18v14H3ZM3 6l9 7 9-7',
  bookmark: 'M6 3h12v18l-6-4-6 4Z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21a8 8 0 0 1 16 0',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  feather: 'm3 21 5-5M7 17l-1-5L16 2a4.2 4.2 0 0 1 6 6L12 18ZM12 12l5-5',
  arrowLeft: 'M20 12H4m6-6-6 6 6 6',
  chevron: 'm6 9 6 6 6-6',
  sparkles: 'm14 2 2.5 6.5L23 11l-6.5 2.5L14 20l-2.5-6.5L5 11l6.5-2.5ZM4 2v4M2 4h4M5 18v4M3 20h4',
  close: 'm6 6 12 12M6 18 18 6',
  image: 'M3 3h18v18H3Zm0 13 6-6 12 11M15 8h.01',
  smile: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 9h.01M16 9h.01M8 14c2 3 6 3 8 0',
  poll: 'M4 20V10M12 20V4M20 20v-7',
  reply: 'M21 11a8 8 0 0 1-8 8H8l-5 3 1-6a8 8 0 1 1 17-5Z',
  repost: 'm4 7 3-3 3 3M7 4v11a3 3 0 0 0 3 3h3M20 17l-3 3-3-3M17 20V9a3 3 0 0 0-3-3h-3',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  share: 'M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7',
  views: 'M4 20V13M10 20V7M16 20V3M22 20V10',
  check: 'm5 12 4 4L19 6',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',
  pin: 'M19 9c0 6-7 12-7 12S5 15 5 9a7 7 0 1 1 14 0ZM15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  calendar: 'M3 5h18v16H3ZM3 10h18M7 2v6M17 2v6',
  link: 'm10 13 4-4M9 15l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M15 9l2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
  settings: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1',
  moon: 'M20 15a9 9 0 0 1-11-11 9 9 0 1 0 11 11Z',
  send: 'm22 2-7 20-4-9-9-4Zm0 0L11 13',
  coffee: 'M3 8h12v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4ZM15 8h3a3 3 0 1 1 0 6h-3M6 2v3M10 2v3',
  grid: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
} as const;

export type IconName = keyof typeof paths;
export function Icon({ name, size = 22, className = '', filled = false, style }: { name: IconName; size?: number; className?: string; filled?: boolean; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}><path d={paths[name]} /></svg>;
}
