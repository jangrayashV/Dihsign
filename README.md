# CS diagram workspace

Initial canvas foundation: React, TypeScript, Vite and React Flow. This milestone is an empty canvas, with no component library, document model or persistence yet. All runtime resources are bundled locally; the interface makes no external resource requests.

## Development

Requires Node.js 22.12+.

```sh
npm ci
npm run dev
```

Vite prints the local preview URL. For a type-checked production build, run `npm run build`; `npm run preview` serves that build locally.

## Navigation

| Input | Action |
| --- | --- |
| Left or middle mouse drag on empty canvas | Pan |
| Mouse wheel / trackpad scroll | Zoom around the pointer |
| Pinch | Zoom |
| Minus / plus toolbar buttons | Zoom around viewport center |
| Percentage button | Return to 100%, preserving viewport center |
| Crosshair button | Reset position and zoom |
| Arrow keys with canvas focused | Pan (Shift for larger steps) |
| `+`, `-`, `0` with canvas focused | Zoom in, zoom out, reset view |

Zoom is bounded to 20–400%; panning has no document bounds. Click the canvas or Tab to focus it for keyboard navigation. Browser shortcuts are left intact. Discrete zoom controls animate, respecting reduced-motion preferences; native gestures update immediately.

## Structure

- `src/workspace/CanvasWorkspace.tsx`: workspace shell, React Flow viewport, grid and navigation controls.
- `src/styles.css`: grayscale palette and responsive shell.

React Flow owns viewport state and gesture handling. Its `Background` follows the same viewport transform; there is no separate CSS background or custom wheel handler. The workspace grid can accommodate a component sidebar later without changing the viewport implementation. There are no placeholder library/tool buttons.

## Manual interaction checks

- Drag in both axes and verify the dots follow the pointer without a jump.
- Zoom over a dot away from the viewport center; that point should stay beneath the pointer.
- Zoom out to 20% and in to 400%; verify controls disable at the limits.
- Reset after panning and zooming; the readout should return to 100%.
- Verify keyboard navigation, button focus and a narrow viewport.
- Check physical trackpad pinch and touch gestures on target hardware before claiming device-specific support.

## Local-first boundary

Future documents and user assets belong in IndexedDB, preferences in localStorage, and built-in components in the frontend repository. Editable import/export must preserve user ownership. This foundation does not initialize storage, backend services or analytics.

## Foundation verification

The production build and TypeScript check passed. In-browser checks verified drag panning, viewport/grid synchronization, cursor-centered wheel zoom, the 20–400% limits, toolbar zoom, percentage reset, full view reset and keyboard panning. At a sampled off-center pointer position, zoom anchor drift was below 0.01 screen pixels (using the rounded rendered transform). No browser console warnings/errors or page overflow were observed at the tested desktop viewport. Physical trackpad pinch and touch hardware have not been tested.
