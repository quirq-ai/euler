import { createContext, useContext, useSyncExternalStore } from 'react';
import type { QuitterEngine } from '../../engine/contract';

export const QuitterEngineContext = createContext<QuitterEngine | null>(null);
export function useQuitterEngine() {
  const engine = useContext(QuitterEngineContext);
  if (!engine) throw new Error('Provide a QuitterEngine to the UI.');
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  return { engine, snapshot };
}
