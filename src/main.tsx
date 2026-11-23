import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasWorkspace } from './workspace/CanvasWorkspace';
import '@xyflow/react/dist/style.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CanvasWorkspace />
  </StrictMode>,
);
