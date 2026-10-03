import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createDemoQuitterEngine } from './demo/createDemoQuitterEngine';
import { QuitterApp } from './ui/QuitterApp';
import './ui/styles.css';

// Composition root: switch the adapter here when the real engine is ready.
const engine = createDemoQuitterEngine();
createRoot(document.getElementById('root')!).render(<StrictMode><QuitterApp engine={engine} /></StrictMode>);
