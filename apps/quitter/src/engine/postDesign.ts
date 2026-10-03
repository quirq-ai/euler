import type { PostDesign } from './types';
import { EngineError } from './contract';

export const DEFAULT_POST_DESIGN: PostDesign = Object.freeze({ layout: 'plain', accent: 'blue' });

/** Both controls and a future generator produce this bounded, validated value. */
export function validatePostDesign(value: unknown): PostDesign {
  if (!value || typeof value !== 'object') throw new EngineError('Choose a post layout and accent.', 'validation');
  const input = value as Record<string, unknown>;
  if (typeof input.layout !== 'string' || typeof input.accent !== 'string' || !['plain', 'card', 'compact'].includes(input.layout) || !['blue', 'mint', 'violet'].includes(input.accent)) {
    throw new EngineError('Choose a supported post layout and accent.', 'validation');
  }
  return { layout: input.layout as PostDesign['layout'], accent: input.accent as PostDesign['accent'] };
}
