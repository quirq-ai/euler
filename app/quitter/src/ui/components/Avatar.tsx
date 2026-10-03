import type { Actor } from '../../engine/types';

export function Avatar({ user, size = 44 }: { user: Actor; size?: number }) {
  return <span className="avatar" style={{ width: size, height: size, background: user.color, fontSize: size * .32 }} aria-hidden="true">{user.initials}</span>;
}
