import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Background,
  BackgroundVariant,
  PanOnScrollMode,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
} from '@xyflow/react';
import type { EdgeTypes, NodeChange, NodeTypes, XYPosition } from '@xyflow/react';
import {
  Check,
  Circle,
  Crosshair,
  Diamond,
  Hand,
  Keyboard,
  Library,
  LocateFixed,
  Minus,
  MoveRight,
  MousePointer2,
  Palette,
  Plus,
  Redo2,
  RouteOff,
  Search,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import { componentDefinitions, componentRegistry, isComponentId } from './componentRegistry';
import type { ComponentId } from './componentRegistry';
import { InfrastructureNode } from './InfrastructureNode';
import type { InfrastructureNodeType } from './InfrastructureNode';
import { arrowStyles, edgeStrokeDasharray, getManualEdgePath, InfrastructureEdge } from './InfrastructureEdge';
import type { ArrowStyle, InfrastructureEdgeType } from './InfrastructureEdge';
import { TextNode } from './TextNode';
import type { TextNodeType } from './TextNode';
import { ShapeNode } from './ShapeNode';
import type { ShapeKind, ShapeNodeType } from './ShapeNode';
import { ElementStylePanel, elementColorValue } from './ElementStylePanel';
import type { ElementColor, ElementStyleMode } from './ElementStylePanel';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const PINCH_ZOOM_STEP = 0.1;
const PINCH_MAX_DELTA = PINCH_ZOOM_STEP * 100;
const INITIAL_VIEWPORT = { x: 0, y: 0, zoom: 1 };

type TooltipState = { label: string; x: number; y: number; placement: 'top' | 'right' | 'bottom' } | null;

function TooltipLayer() {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    function hide() {
      window.clearTimeout(timerRef.current);
      setTooltip(null);
    }

    function show(target: Element, delay = 360) {
      const host = target.closest<HTMLElement>('[data-tooltip]');
      const label = host?.dataset.tooltip;
      if (!host || !label) return;

      const rect = host.getBoundingClientRect();
      const placement: NonNullable<TooltipState>['placement'] = host.closest('.tool-rail') ? 'right' : host.closest('.top-toolbar') ? 'bottom' : 'top';
      const next: NonNullable<TooltipState> = placement === 'right'
        ? { label, placement, x: rect.right + 9, y: rect.top + rect.height / 2 }
        : placement === 'bottom'
          ? { label, placement, x: rect.left + rect.width / 2, y: rect.bottom + 8 }
          : { label, placement, x: rect.left + rect.width / 2, y: rect.top - 8 };

      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setTooltip(next), delay);
    }

    function onMouseOver(event: MouseEvent) { if (event.target instanceof Element) show(event.target); }
    function onMouseOut(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const host = event.target.closest('[data-tooltip]');
      if (host && event.relatedTarget instanceof Node && host.contains(event.relatedTarget)) return;
      hide();
    }
    function onFocusIn(event: FocusEvent) { if (event.target instanceof Element) show(event.target, 120); }

    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mouseout', onMouseOut);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', hide);
    window.addEventListener('resize', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      hide();
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('mouseout', onMouseOut);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', hide);
      window.removeEventListener('resize', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  return createPortal(
    tooltip ? (
      <div
        className={`ui-tooltip ui-tooltip-${tooltip.placement}`}
        role="tooltip"
        style={{ left: tooltip.x, top: tooltip.y }}
      >
        {tooltip.label}
      </div>
    ) : null,
    document.body,
  );
}

type Tool = 'select' | 'hand' | 'rectangle' | 'circle' | 'diamond' | 'text' | 'arrow';
type CanvasNode = InfrastructureNodeType | TextNodeType | ShapeNodeType;
type SnapSide = 'top' | 'right' | 'bottom' | 'left';
type ArrowBinding = { nodeId: string; side: SnapSide };
type FreeArrow = {
  id: string;
  start: XYPosition;
  end: XYPosition;
  label?: string;
  startBinding?: ArrowBinding;
  endBinding?: ArrowBinding;
  arrowStyle?: ArrowStyle;
  color?: ElementColor;
  colorStyle?: ElementStyleMode;
  fixedSegment?: { axis: 'x' | 'y'; value: number };
};

type RouteRect = { x: number; y: number; width: number; height: number; id: string };

function canvasNodeSize(node: CanvasNode) {
  const styleWidth = typeof node.style?.width === 'number' ? node.style.width : undefined;
  const styleHeight = typeof node.style?.height === 'number' ? node.style.height : undefined;
  return {
    width: node.measured?.width ?? node.width ?? styleWidth ?? (node.type === 'text' ? 120 : node.type === 'shape' ? 100 : 156),
    height: node.measured?.height ?? node.height ?? styleHeight ?? (node.type === 'text' ? 32 : node.type === 'shape' ? 80 : 60),
  };
}

function sideDirection(side: SnapSide): XYPosition {
  if (side === 'top') return { x: 0, y: -1 };
  if (side === 'right') return { x: 1, y: 0 };
  if (side === 'bottom') return { x: 0, y: 1 };
  return { x: -1, y: 0 };
}

function simplifyRoute(points: XYPosition[]) {
  const unique = points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  return unique.filter((point, index) => {
    if (index === 0 || index === unique.length - 1) return true;
    const previous = unique[index - 1];
    const next = unique[index + 1];
    const continuesHorizontally = previous.y === point.y
      && point.y === next.y
      && (point.x - previous.x) * (next.x - point.x) > 0;
    const continuesVertically = previous.x === point.x
      && point.x === next.x
      && (point.y - previous.y) * (next.y - point.y) > 0;
    return !(continuesHorizontally || continuesVertically);
  });
}

function segmentCrossesRect(start: XYPosition, end: XYPosition, rect: RouteRect) {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  if (start.x === end.x) return start.x > left && start.x < right && Math.max(start.y, end.y) > top && Math.min(start.y, end.y) < bottom;
  if (start.y === end.y) return start.y > top && start.y < bottom && Math.max(start.x, end.x) > left && Math.min(start.x, end.x) < right;
  return true;
}

function routeScore(points: XYPosition[], obstacles: RouteRect[]) {
  let length = 0;
  let collisions = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    length += Math.abs(points[index + 1].x - points[index].x) + Math.abs(points[index + 1].y - points[index].y);
    collisions += obstacles.filter((rect) => segmentCrossesRect(points[index], points[index + 1], rect)).length;
  }
  return collisions * 1_000_000 + length + points.length * 4;
}

function elbowRoute(
  start: XYPosition,
  end: XYPosition,
  startBinding: ArrowBinding | undefined,
  endBinding: ArrowBinding | undefined,
  obstacles: RouteRect[],
  fixedSegment?: FreeArrow['fixedSegment'],
) {
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  const startDirection = startBinding
    ? sideDirection(startBinding.side)
    : horizontal
      ? { x: end.x >= start.x ? 1 : -1, y: 0 }
      : { x: 0, y: end.y >= start.y ? 1 : -1 };
  const endDirection = endBinding
    ? sideDirection(endBinding.side)
    : { x: -startDirection.x, y: -startDirection.y };
  const stubLength = 24;
  const sourceStub = { x: start.x + startDirection.x * stubLength, y: start.y + startDirection.y * stubLength };
  const targetStub = { x: end.x + endDirection.x * stubLength, y: end.y + endDirection.y * stubLength };
  const automaticMiddle = () => {
    const clearance = 24;
    const xCandidates = [
      (sourceStub.x + targetStub.x) / 2,
      ...obstacles.flatMap((rect) => [rect.x - clearance, rect.x + rect.width + clearance]),
    ];
    const yCandidates = [
      (sourceStub.y + targetStub.y) / 2,
      ...obstacles.flatMap((rect) => [rect.y - clearance, rect.y + rect.height + clearance]),
    ];
    const candidates = [
      ...xCandidates.map((x) => [sourceStub, { x, y: sourceStub.y }, { x, y: targetStub.y }, targetStub]),
      ...yCandidates.map((y) => [sourceStub, { x: sourceStub.x, y }, { x: targetStub.x, y }, targetStub]),
    ];
    let best = candidates[0];
    let bestScore = routeScore(best, obstacles);
    for (let index = 1; index < candidates.length; index += 1) {
      const score = routeScore(candidates[index], obstacles);
      if (score < bestScore) {
        best = candidates[index];
        bestScore = score;
      }
    }
    return best.slice(1, -1);
  };

  let middle: XYPosition[];
  if (fixedSegment?.axis === 'x') {
    const fixedMiddle = [{ x: fixedSegment.value, y: sourceStub.y }, { x: fixedSegment.value, y: targetStub.y }];
    middle = routeScore([sourceStub, ...fixedMiddle, targetStub], obstacles) < 1_000_000
      ? fixedMiddle
      : automaticMiddle();
  } else if (fixedSegment?.axis === 'y') {
    const fixedMiddle = [{ x: sourceStub.x, y: fixedSegment.value }, { x: targetStub.x, y: fixedSegment.value }];
    middle = routeScore([sourceStub, ...fixedMiddle, targetStub], obstacles) < 1_000_000
      ? fixedMiddle
      : automaticMiddle();
  } else {
    middle = automaticMiddle();
  }

  return simplifyRoute([start, sourceStub, ...middle, targetStub, end]);
}

function translateFreeArrow(arrow: FreeArrow, delta: XYPosition): FreeArrow {
  return {
    ...arrow,
    start: { x: arrow.start.x + delta.x, y: arrow.start.y + delta.y },
    end: { x: arrow.end.x + delta.x, y: arrow.end.y + delta.y },
    fixedSegment: arrow.fixedSegment ? {
      ...arrow.fixedSegment,
      value: arrow.fixedSegment.value + (arrow.fixedSegment.axis === 'x' ? delta.x : delta.y),
    } : undefined,
  };
}

const tools = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
  { id: 'hand', label: 'Hand tool', shortcut: 'H', icon: Hand },
  { id: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: Square },
  { id: 'circle', label: 'Ellipse', shortcut: 'O', icon: Circle },
  { id: 'diamond', label: 'Conditional diamond', shortcut: 'D', icon: Diamond },
  { id: 'text', label: 'Text', shortcut: 'T', icon: Type },
] as const;

function CanvasChrome({
  activeTool,
  libraryOpen,
  onLibraryToggle,
  onShortcutGuideToggle,
  onToolChange,
  shortcutGuideOpen,
}: {
  activeTool: Tool;
  libraryOpen: boolean;
  onLibraryToggle: () => void;
  onShortcutGuideToggle: () => void;
  onToolChange: (tool: Tool) => void;
  shortcutGuideOpen: boolean;
}) {
  return (
    <div className="top-toolbar" role="toolbar" aria-label="Canvas and document actions">
      <button
        type="button"
        className={libraryOpen ? 'is-active' : undefined}
        aria-label="Component library"
        aria-expanded={libraryOpen}
        data-tooltip="Component library"
        onClick={onLibraryToggle}
      >
        <Library size={17} aria-hidden="true" />
      </button>
      <span className="toolbar-divider" aria-hidden="true" />
      <div className="toolbar-tools" role="group" aria-label="Canvas tools">
        {tools.map(({ id, label, shortcut, icon: Icon }) => (
          <button
            type="button"
            className={`toolbar-tool-button${activeTool === id ? ' is-active' : ''}`}
            aria-label={label}
            aria-pressed={activeTool === id}
            data-tooltip={`${label}${shortcut ? ` (${shortcut})` : ''}`}
            key={id}
            onClick={() => onToolChange(id)}
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="tool-shortcut" aria-hidden="true">{shortcut}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`toolbar-tool-button${activeTool === 'arrow' ? ' is-active' : ''}`}
        aria-label="Draw free arrow"
        aria-pressed={activeTool === 'arrow'}
        data-tooltip="Draw free arrow"
        onClick={() => onToolChange('arrow')}
      >
        <MoveRight size={18} aria-hidden="true" />
        <span className="tool-shortcut" aria-hidden="true">A</span>
      </button>
      <span className="toolbar-divider" aria-hidden="true" />
      <button
        type="button"
        className={shortcutGuideOpen ? 'is-active' : undefined}
        aria-label="Keyboard shortcuts"
        aria-expanded={shortcutGuideOpen}
        data-tooltip="Keyboard shortcuts"
        onClick={onShortcutGuideToggle}
      >
        <Keyboard size={17} aria-hidden="true" />
      </button>
      <span className="toolbar-divider" aria-hidden="true" />
      <div className="history-actions">
        <button type="button" aria-label="Undo" data-tooltip="Undo" disabled>
          <Undo2 size={17} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Redo" data-tooltip="Redo" disabled>
          <Redo2 size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

const shortcutSections = [
  {
    title: 'Tools',
    shortcuts: [
      ['V', 'Select'],
      ['H', 'Hand tool'],
      ['R', 'Rectangle'],
      ['O', 'Ellipse'],
      ['D', 'Conditional diamond'],
      ['A', 'Free arrow'],
      ['T', 'Text'],
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      ['Ctrl/⌘ A', 'Select all'],
      ['Shift + click', 'Add to selection'],
      ['Alt + D', 'Duplicate selection'],
      ['Esc', 'Clear selection'],
      ['Delete', 'Delete selected'],
    ],
  },
  {
    title: 'Canvas',
    shortcuts: [
      ['Space + drag', 'Temporarily pan'],
      ['+ / −', 'Zoom'],
      ['Arrow keys', 'Pan canvas'],
      ['0', 'Reset view'],
    ],
  },
] as const;

function ShortcutGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="shortcut-guide-layer" role="presentation">
      <section
        className="shortcut-guide-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-guide-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <header>
          <div>
            <h2 id="shortcut-guide-title">Keyboard shortcuts</h2>
            <p>Move faster around the canvas</p>
          </div>
          <button type="button" autoFocus aria-label="Close keyboard shortcuts" data-tooltip="Close" onClick={onClose}>
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <div className="shortcut-guide-sections">
          {shortcutSections.map((section) => (
            <div className="shortcut-guide-section" key={section.title}>
              <h3>{section.title}</h3>
              {section.shortcuts.map(([keys, action]) => (
                <div className="shortcut-guide-row" key={action}>
                  <span>{action}</span>
                  <kbd>{keys}</kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ComponentLibrary({ onAdd }: { onAdd: (componentId: ComponentId) => void }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const groups = componentDefinitions.reduce((grouped, definition) => {
    const current = grouped.get(definition.category) ?? [];
    current.push(definition);
    grouped.set(definition.category, current);
    return grouped;
  }, new Map<string, typeof componentDefinitions>());

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedQuery
    ? componentDefinitions.filter((definition) => [
      definition.name,
      definition.category,
      ...definition.aliases,
      ...definition.keywords,
    ].some((term) => term.toLowerCase().includes(normalizedQuery)))
    : undefined;
  const activeDefinitions = searchResults ?? (activeCategory ? groups.get(activeCategory) : undefined);
  const activeTitle = searchResults ? 'Search results' : activeCategory;

  return (
    <div className="component-library-shell">
      <aside className="component-library" aria-label="Component library">
        <div className="library-heading">
          <div>
            <strong>Components</strong>
            <span>Choose a category</span>
          </div>
        </div>
        <label className="library-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            placeholder="Search components"
            aria-label="Search components"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        <div className="library-list">
          {Array.from(groups, ([category, definitions]) => {
            const isActive = activeCategory === category;
            return (
              <button
                type="button"
                className={`library-category${isActive ? ' is-active' : ''}`}
                aria-expanded={isActive}
                aria-controls="library-category-card"
                key={category}
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory(isActive && !normalizedQuery ? null : category);
                }}
              >
                <span>{category}</span>
                <small>{definitions.length}</small>
              </button>
            );
          })}
        </div>
      </aside>
      {activeTitle && activeDefinitions && (
        <section className="library-category-card" id="library-category-card" aria-label={`${activeTitle} components`}>
          <header>
            <div>
              <strong>{activeTitle}</strong>
              <span>{activeDefinitions.length} {activeDefinitions.length === 1 ? 'component' : 'components'}</span>
            </div>
            <button
              type="button"
              aria-label={`Close ${activeTitle}`}
              data-tooltip="Close"
              onClick={() => { setSearchQuery(''); setActiveCategory(null); }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>
          <div className="library-category-grid">
            {activeDefinitions.map((definition) => {
              const Icon = definition.icon;
              return (
                <button
                  type="button"
                  className="library-item"
                  draggable
                  key={definition.id}
                  onClick={() => onAdd(definition.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/cs-component', definition.id);
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                >
                  <span className="library-item-icon"><Icon size={20} strokeWidth={1.6} aria-hidden="true" /></span>
                  <strong>{definition.name}</strong>
                </button>
              );
            })}
            {activeDefinitions.length === 0 && (
              <p className="library-empty">No components match “{searchQuery.trim()}”.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// Native gestures remain immediate. Only discrete toolbar/keyboard zooms animate.
function animationOptions() {
  return {
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180,
  };
}

function ViewportControls() {
  const { zoomIn, zoomOut, zoomTo, setViewport } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <Panel position="bottom-right" className="viewport-controls" aria-label="Canvas view controls">
      <button
        type="button"
        aria-label="Zoom out"
        data-tooltip="Zoom out (−)"
        disabled={zoom <= MIN_ZOOM + 0.001}
        onClick={() => void zoomOut(animationOptions())}
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="zoom-level"
        aria-label={`Zoom ${Math.round(zoom * 100)}%. Reset to 100%`}
        data-tooltip="Zoom to 100%"
        onClick={() => void zoomTo(1, animationOptions())}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        data-tooltip="Zoom in (+)"
        disabled={zoom >= MAX_ZOOM - 0.001}
        onClick={() => void zoomIn(animationOptions())}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
      <span className="control-divider" aria-hidden="true" />
      <button
        type="button"
        aria-label="Reset view"
        data-tooltip="Reset view (0)"
        onClick={() => void setViewport(INITIAL_VIEWPORT, animationOptions())}
      >
        <Crosshair size={16} aria-hidden="true" />
      </button>
    </Panel>
  );
}

function Canvas() {
  const canvasRef = useRef<HTMLElement>(null);
  const pinchFrameRef = useRef<number | null>(null);
  const pinchDeltaRef = useRef(0);
  const pinchPointRef = useRef({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [freeArrows, setFreeArrows] = useState<FreeArrow[]>([]);
  const [selectedFreeArrowId, setSelectedFreeArrowId] = useState<string | null>(null);
  const [selectedFreeArrowIds, setSelectedFreeArrowIds] = useState<string[]>([]);
  const [allFreeArrowsSelected, setAllFreeArrowsSelected] = useState(false);
  const [freeArrowStyling, setFreeArrowStyling] = useState(false);
  const [freeArrowLabelEditing, setFreeArrowLabelEditing] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [shortcutGuideOpen, setShortcutGuideOpen] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<InfrastructureEdgeType>([]);
  const { getViewport, screenToFlowPosition, setViewport, zoomIn, zoomOut } = useReactFlow();
  const viewport = useViewport();
  const nodeTypes = useMemo<NodeTypes>(() => ({ infrastructure: InfrastructureNode, text: TextNode, shape: ShapeNode }), []);
  const edgeTypes = useMemo<EdgeTypes>(() => ({ infrastructure: InfrastructureEdge }), []);
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const routeObstacles = useMemo<RouteRect[]>(() => {
    const padding = 14;
    return nodes.map((node) => {
      const { width, height } = canvasNodeSize(node);
      return {
        id: node.id,
        x: node.position.x - padding,
        y: node.position.y - padding,
        width: width + padding * 2,
        height: height + padding * 2,
      };
    });
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Trackpads expose pinch as a Ctrl-modified wheel event. Handle only that
    // gesture here so its response curve can stay quick yet controlled, while
    // ordinary two-finger panning remains untouched.
    const handlePinch = (event: WheelEvent) => {
      if (!event.ctrlKey || !(event.target instanceof Element) || !event.target.closest('.react-flow__renderer')) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const deltaScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? canvas.clientHeight
          : 1;
      pinchDeltaRef.current += event.deltaY * deltaScale;
      pinchPointRef.current = { x: event.clientX, y: event.clientY };

      if (pinchFrameRef.current !== null) return;
      pinchFrameRef.current = window.requestAnimationFrame(() => {
        pinchFrameRef.current = null;
        const delta = pinchDeltaRef.current;
        pinchDeltaRef.current = 0;

        const current = getViewport();
        const direction = Math.sign(delta);
        const absoluteDelta = Math.abs(delta);
        const limitedDelta = Math.min(absoluteDelta, PINCH_MAX_DELTA) * direction;

        // Excalidraw-style response curve: a small gesture is immediately
        // useful, large gestures are capped, and zooming above 100% gains
        // extra speed so traversing the canvas never feels laborious.
        let nextZoom = current.zoom - limitedDelta / 100;
        nextZoom += Math.log10(Math.max(1, current.zoom))
          * -direction
          * Math.min(1, absoluteDelta / 20);
        nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
        if (Math.abs(nextZoom - current.zoom) < 0.0001) return;

        const bounds = canvas.getBoundingClientRect();
        const point = {
          x: pinchPointRef.current.x - bounds.left,
          y: pinchPointRef.current.y - bounds.top,
        };
        const zoomRatio = nextZoom / current.zoom;
        void setViewport({
          x: point.x - (point.x - current.x) * zoomRatio,
          y: point.y - (point.y - current.y) * zoomRatio,
          zoom: nextZoom,
        });
      });
    };

    canvas.addEventListener('wheel', handlePinch, { capture: true, passive: false });
    return () => {
      canvas.removeEventListener('wheel', handlePinch, { capture: true });
      if (pinchFrameRef.current !== null) window.cancelAnimationFrame(pinchFrameRef.current);
    };
  }, [getViewport, setViewport]);

  function bindingPosition(binding: ArrowBinding): XYPosition | null {
    const node = nodesById.get(binding.nodeId);
    if (!node || (node.type !== 'infrastructure' && node.type !== 'shape')) return null;
    const { width, height } = canvasNodeSize(node);
    const x = node.position.x;
    const y = node.position.y;
    if (binding.side === 'top') return { x: x + width / 2, y };
    if (binding.side === 'right') return { x: x + width, y: y + height / 2 };
    if (binding.side === 'bottom') return { x: x + width / 2, y: y + height };
    return { x, y: y + height / 2 };
  }

  function arrowRoutePoints(arrow: FreeArrow) {
    const start = arrow.startBinding ? bindingPosition(arrow.startBinding) ?? arrow.start : arrow.start;
    const end = arrow.endBinding ? bindingPosition(arrow.endBinding) ?? arrow.end : arrow.end;
    return elbowRoute(start, end, arrow.startBinding, arrow.endBinding, routeObstacles, arrow.fixedSegment);
  }

  function magneticSnap(position: XYPosition, forceNodeId?: string): { position: XYPosition; binding?: ArrowBinding } {
    const snapCandidates: Array<{ position: XYPosition; binding: ArrowBinding; distance: number }> = [];
    nodes.forEach((node) => {
      if ((node.type !== 'infrastructure' && node.type !== 'shape') || (forceNodeId && node.id !== forceNodeId)) return;
      const { width, height } = canvasNodeSize(node);
      const candidates: Array<{ side: SnapSide; position: XYPosition }> = [
        { side: 'top', position: { x: node.position.x + width / 2, y: node.position.y } },
        { side: 'right', position: { x: node.position.x + width, y: node.position.y + height / 2 } },
        { side: 'bottom', position: { x: node.position.x + width / 2, y: node.position.y + height } },
        { side: 'left', position: { x: node.position.x, y: node.position.y + height / 2 } },
      ];
      candidates.forEach((candidate) => {
        const distance = Math.hypot(position.x - candidate.position.x, position.y - candidate.position.y);
        snapCandidates.push({ position: candidate.position, binding: { nodeId: node.id, side: candidate.side }, distance });
      });
    });
    const closest = snapCandidates.reduce<(typeof snapCandidates)[number] | null>(
      (best, candidate) => !best || candidate.distance < best.distance ? candidate : best,
      null,
    );
    return closest && (Boolean(forceNodeId) || closest.distance <= 32 / viewport.zoom)
      ? { position: closest.position, binding: closest.binding }
      : { position };
  }

  function snapPointer(clientX: number, clientY: number) {
    const position = screenToFlowPosition({ x: clientX, y: clientY });
    const hitNode = [...nodes].reverse().find((node) => {
      if (node.type !== 'infrastructure' && node.type !== 'shape') return false;
      const { width, height } = canvasNodeSize(node);
      return position.x >= node.position.x
        && position.x <= node.position.x + width
        && position.y >= node.position.y
        && position.y <= node.position.y + height;
    });
    return magneticSnap(position, hitNode?.id);
  }

  const changeTool = useCallback((tool: Tool) => {
    setActiveTool(tool);
    setSelectedFreeArrowId(null);
    setSelectedFreeArrowIds([]);
    setAllFreeArrowsSelected(false);
    setFreeArrowStyling(false);
    setFreeArrowLabelEditing(false);
    if (tool !== 'select') {
      setNodes((currentNodes) => currentNodes.map((node) => node.selected ? { ...node, selected: false } : node));
      setEdges((currentEdges) => currentEdges.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    }
  }, [setEdges, setNodes]);

  const addComponent = useCallback((componentId: ComponentId, position?: XYPosition) => {
    const definition = componentRegistry[componentId];
    const instanceId = crypto.randomUUID();
    const fallbackPosition = screenToFlowPosition({
      x: window.innerWidth / 2 - 180 + (nodes.length % 3) * 200,
      y: window.innerHeight / 2 - 40 + Math.floor(nodes.length / 3) * 110,
    });

    setNodes((currentNodes) => currentNodes.concat({
      id: instanceId,
      type: 'infrastructure',
      position: position ?? fallbackPosition,
      data: {
        instanceId,
        componentId,
        properties: { ...definition.defaultProperties },
      },
    }));
    setActiveTool('select');
  }, [nodes.length, screenToFlowPosition, setNodes]);

  function handleNodesChange(changes: NodeChange<CanvasNode>[]) {
    if (allFreeArrowsSelected || selectedFreeArrowIds.length > 0) {
      const moved = changes.find((change) => change.type === 'position' && change.position);
      if (moved?.type === 'position' && moved.position) {
        const previous = nodes.find((node) => node.id === moved.id)?.position;
        if (previous) {
          const delta = { x: moved.position.x - previous.x, y: moved.position.y - previous.y };
          if (delta.x || delta.y) {
            setFreeArrows((arrows) => arrows.map((arrow) => allFreeArrowsSelected || selectedFreeArrowIds.includes(arrow.id)
              ? translateFreeArrow(arrow, delta)
              : arrow));
          }
        }
      }
    }
    onNodesChange(changes);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const value = event.dataTransfer.getData('application/cs-component');
    if (!isComponentId(value)) return;
    addComponent(value, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }

  function startShapeDraw(event: ReactPointerEvent<HTMLElement>) {
    const shape: ShapeKind | null = activeTool === 'rectangle'
      ? 'rectangle'
      : activeTool === 'circle'
        ? 'ellipse'
        : activeTool === 'diamond'
          ? 'diamond'
          : null;
    if (!shape || event.button !== 0) return;
    if (!(event.target instanceof Element) || !event.target.closest('.react-flow__pane')) return;

    event.preventDefault();
    event.stopPropagation();
    const id = crypto.randomUUID();
    const start = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const geometry = (clientX: number, clientY: number) => {
      const point = screenToFlowPosition({ x: clientX, y: clientY });
      return {
        position: { x: Math.min(start.x, point.x), y: Math.min(start.y, point.y) },
        width: Math.max(1, Math.abs(point.x - start.x)),
        height: Math.max(1, Math.abs(point.y - start.y)),
      };
    };

    setSelectedFreeArrowId(null);
    setSelectedFreeArrowIds([]);
    setAllFreeArrowsSelected(false);
    setNodes((currentNodes) => currentNodes
      .map((node) => node.selected ? { ...node, selected: false } : node)
      .concat({
        id,
        type: 'shape',
        position: start,
        data: { instanceId: id, shape, color: 'gray', colorStyle: 'subtle' },
        style: { width: 1, height: 1 },
        selected: true,
      }));

    const move = (pointerEvent: PointerEvent) => {
      const next = geometry(pointerEvent.clientX, pointerEvent.clientY);
      setNodes((currentNodes) => currentNodes.map((node) => node.id === id ? {
        ...node,
        position: next.position,
        style: { ...node.style, width: next.width, height: next.height },
      } : node));
    };
    const stop = (pointerEvent: PointerEvent) => {
      const next = geometry(pointerEvent.clientX, pointerEvent.clientY);
      if (next.width < 8 || next.height < 8) {
        setNodes((currentNodes) => currentNodes.filter((node) => node.id !== id));
      } else {
        setNodes((currentNodes) => currentNodes.map((node) => node.id === id ? {
          ...node,
          position: next.position,
          style: { ...node.style, width: next.width, height: next.height },
          selected: true,
        } : node));
        setActiveTool('select');
      }
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', cancel);
    };
    const cancel = () => {
      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== id));
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', cancel);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', cancel);
  }

  function startFreeArrow(event: ReactPointerEvent<HTMLElement>) {
    if (activeTool !== 'arrow' || event.button !== 0) return;
    if (!(event.target instanceof Element) || event.target.closest('button, input, textarea, .node-actions')) return;
    if (!event.target.closest('.react-flow__pane, .react-flow__node-infrastructure, .react-flow__node-shape')) return;
    event.preventDefault();
    event.stopPropagation();
    const id = crypto.randomUUID();
    const snappedStart = snapPointer(event.clientX, event.clientY);
    const start = snappedStart.position;
    setFreeArrows((arrows) => arrows.concat({ id, start, end: start, startBinding: snappedStart.binding }));

    const move = (pointerEvent: PointerEvent) => {
      const snappedEnd = snapPointer(pointerEvent.clientX, pointerEvent.clientY);
      setFreeArrows((arrows) => arrows.map((arrow) => arrow.id === id ? { ...arrow, end: snappedEnd.position, endBinding: snappedEnd.binding } : arrow));
    };
    const stop = (pointerEvent: PointerEvent) => {
      const snappedEnd = snapPointer(pointerEvent.clientX, pointerEvent.clientY);
      const end = snappedEnd.position;
      const longEnough = Math.hypot(end.x - start.x, end.y - start.y) >= 8;
      setFreeArrows((arrows) => arrows
        .map((arrow) => arrow.id === id ? { ...arrow, end, endBinding: snappedEnd.binding } : arrow)
        .filter((arrow) => arrow.id !== id || Math.hypot(arrow.end.x - arrow.start.x, arrow.end.y - arrow.start.y) >= 8));
      if (longEnough) {
        setSelectedFreeArrowId(id);
        setSelectedFreeArrowIds([id]);
        setActiveTool('select');
      }
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', cancel);
    };
    const cancel = () => {
      setFreeArrows((arrows) => arrows.filter((arrow) => arrow.id !== id));
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', cancel);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', cancel);
  }

  function startFreeArrowEndpointDrag(event: ReactPointerEvent<SVGCircleElement>, id: string, endpoint: 'start' | 'end') {
    event.preventDefault();
    event.stopPropagation();
    const move = (pointerEvent: PointerEvent) => {
      const snapped = snapPointer(pointerEvent.clientX, pointerEvent.clientY);
      const bindingKey = endpoint === 'start' ? 'startBinding' : 'endBinding';
      setFreeArrows((arrows) => arrows.map((arrow) => arrow.id === id ? { ...arrow, [endpoint]: snapped.position, [bindingKey]: snapped.binding } : arrow));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  function startFreeArrowSegmentDrag(
    event: ReactPointerEvent<SVGCircleElement>,
    id: string,
    segmentStart: XYPosition,
    segmentEnd: XYPosition,
  ) {
    event.preventDefault();
    event.stopPropagation();
    const axis = segmentStart.x === segmentEnd.x ? 'x' : 'y';
    const move = (pointerEvent: PointerEvent) => {
      const position = screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY });
      setFreeArrows((arrows) => arrows.map((arrow) => arrow.id === id ? {
        ...arrow,
        fixedSegment: { axis, value: axis === 'x' ? position.x : position.y },
      } : arrow));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  function startFreeArrowDrag(event: ReactPointerEvent<SVGPathElement>, arrow: FreeArrow) {
    event.preventDefault();
    event.stopPropagation();
    const movingGroup = allFreeArrowsSelected || selectedFreeArrowIds.includes(arrow.id);
    if (!movingGroup) {
      setSelectedFreeArrowId(arrow.id);
      setSelectedFreeArrowIds([arrow.id]);
      setAllFreeArrowsSelected(false);
      setNodes((currentNodes) => currentNodes.map((node) => node.selected ? { ...node, selected: false } : node));
      setEdges((currentEdges) => currentEdges.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    }
    setFreeArrowStyling(false);
    setFreeArrowLabelEditing(false);
    setActiveTool('select');
    const pointerStart = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const originalStart = arrow.startBinding ? bindingPosition(arrow.startBinding) ?? arrow.start : arrow.start;
    const originalEnd = arrow.endBinding ? bindingPosition(arrow.endBinding) ?? arrow.end : arrow.end;
    const originalArrows = freeArrows;
    const originalNodePositions = new Map(nodes.map((node) => [node.id, node.position]));
    const move = (pointerEvent: PointerEvent) => {
      const pointer = screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY });
      const delta = { x: pointer.x - pointerStart.x, y: pointer.y - pointerStart.y };
      if (movingGroup) {
        setNodes((currentNodes) => currentNodes.map((node) => {
          const original = originalNodePositions.get(node.id);
          return node.selected && original ? { ...node, position: { x: original.x + delta.x, y: original.y + delta.y } } : node;
        }));
        setFreeArrows(originalArrows.map((candidate) => allFreeArrowsSelected || selectedFreeArrowIds.includes(candidate.id)
          ? translateFreeArrow(candidate, delta)
          : candidate));
        return;
      }
      setFreeArrows((arrows) => arrows.map((candidate) => candidate.id === arrow.id ? {
        ...candidate,
        start: { x: originalStart.x + delta.x, y: originalStart.y + delta.y },
        end: { x: originalEnd.x + delta.x, y: originalEnd.y + delta.y },
        startBinding: undefined,
        endBinding: undefined,
        fixedSegment: candidate.fixedSegment ? {
          ...candidate.fixedSegment,
          value: candidate.fixedSegment.value + (candidate.fixedSegment.axis === 'x' ? delta.x : delta.y),
        } : undefined,
      } : candidate));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  function updateFreeArrow(id: string, update: Partial<FreeArrow>) {
    setFreeArrows((arrows) => arrows.map((arrow) => arrow.id === id ? { ...arrow, ...update } : arrow));
  }

  function startArrowMarqueeSelection(event: ReactPointerEvent<HTMLElement>) {
    if (activeTool !== 'select' || event.button !== 0) return;
    if (!(event.target instanceof Element) || !event.target.closest('.react-flow__pane')) return;
    const start = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const stop = (pointerEvent: PointerEvent) => {
      const end = screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY });
      if (Math.hypot(end.x - start.x, end.y - start.y) >= 4 / viewport.zoom) {
        const bounds = {
          left: Math.min(start.x, end.x),
          right: Math.max(start.x, end.x),
          top: Math.min(start.y, end.y),
          bottom: Math.max(start.y, end.y),
        };
        const captured = freeArrows.filter((arrow) => {
          const arrowStart = arrow.startBinding ? bindingPosition(arrow.startBinding) ?? arrow.start : arrow.start;
          const arrowEnd = arrow.endBinding ? bindingPosition(arrow.endBinding) ?? arrow.end : arrow.end;
          const arrowBounds = {
            left: Math.min(arrowStart.x, arrowEnd.x),
            right: Math.max(arrowStart.x, arrowEnd.x),
            top: Math.min(arrowStart.y, arrowEnd.y),
            bottom: Math.max(arrowStart.y, arrowEnd.y),
          };
          return arrowBounds.right >= bounds.left && arrowBounds.left <= bounds.right && arrowBounds.bottom >= bounds.top && arrowBounds.top <= bounds.bottom;
        }).map((arrow) => arrow.id);
        setSelectedFreeArrowIds((current) => additive ? Array.from(new Set([...current, ...captured])) : captured);
        setSelectedFreeArrowId(captured.length === 1 ? captured[0] : null);
        setAllFreeArrowsSelected(false);
      }
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', cancel);
    };
    const cancel = () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', cancel);
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', cancel);
  }

  function duplicateSelection() {
    const offset = { x: 24, y: 24 };
    const selectedNodes = nodes.filter((node) => node.selected);
    const nodeIdMap = new Map(selectedNodes.map((node) => [node.id, crypto.randomUUID()]));
    const duplicateNodes = selectedNodes.map((node) => {
      const id = nodeIdMap.get(node.id)!;
      return {
        ...node,
        id,
        position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
        selected: true,
        data: { ...node.data, instanceId: id },
      } as CanvasNode;
    });
    if (duplicateNodes.length) {
      setNodes((currentNodes) => currentNodes.map((node) => node.selected ? { ...node, selected: false } : node).concat(duplicateNodes));
    }

    const arrowIds = allFreeArrowsSelected
      ? freeArrows.map((arrow) => arrow.id)
      : selectedFreeArrowIds.length
        ? selectedFreeArrowIds
        : selectedFreeArrowId ? [selectedFreeArrowId] : [];
    const duplicateArrows = freeArrows.filter((arrow) => arrowIds.includes(arrow.id)).map((arrow) => {
      const resolvedStart = arrow.startBinding ? bindingPosition(arrow.startBinding) ?? arrow.start : arrow.start;
      const resolvedEnd = arrow.endBinding ? bindingPosition(arrow.endBinding) ?? arrow.end : arrow.end;
      const remapBinding = (binding?: ArrowBinding) => binding && nodeIdMap.has(binding.nodeId)
        ? { ...binding, nodeId: nodeIdMap.get(binding.nodeId)! }
        : undefined;
      return {
        ...arrow,
        id: crypto.randomUUID(),
        start: { x: resolvedStart.x + offset.x, y: resolvedStart.y + offset.y },
        end: { x: resolvedEnd.x + offset.x, y: resolvedEnd.y + offset.y },
        startBinding: remapBinding(arrow.startBinding),
        endBinding: remapBinding(arrow.endBinding),
        fixedSegment: arrow.fixedSegment ? {
          ...arrow.fixedSegment,
          value: arrow.fixedSegment.value + (arrow.fixedSegment.axis === 'x' ? offset.x : offset.y),
        } : undefined,
      };
    });
    if (duplicateArrows.length) {
      setFreeArrows((arrows) => arrows.concat(duplicateArrows));
      const duplicateIds = duplicateArrows.map((arrow) => arrow.id);
      setSelectedFreeArrowIds(duplicateIds);
      setSelectedFreeArrowId(duplicateIds.length === 1 ? duplicateIds[0] : null);
      setAllFreeArrowsSelected(false);
    } else {
      setSelectedFreeArrowIds([]);
      setSelectedFreeArrowId(null);
      setAllFreeArrowsSelected(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    // Keep shortcuts scoped to the canvas and out of editable controls.
    if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"], button')) return;

    if (selectedFreeArrowId && (event.key === 'Backspace' || event.key === 'Delete')) {
      setFreeArrows((arrows) => arrows.filter((arrow) => arrow.id !== selectedFreeArrowId));
      setSelectedFreeArrowId(null);
      setSelectedFreeArrowIds([]);
      event.preventDefault();
      return;
    }
    if (selectedFreeArrowIds.length > 0 && (event.key === 'Backspace' || event.key === 'Delete')) {
      setFreeArrows((arrows) => arrows.filter((arrow) => !selectedFreeArrowIds.includes(arrow.id)));
      setSelectedFreeArrowIds([]);
      setAllFreeArrowsSelected(false);
      event.preventDefault();
      return;
    }
    if (allFreeArrowsSelected && (event.key === 'Backspace' || event.key === 'Delete')) {
      setFreeArrows([]);
      setAllFreeArrowsSelected(false);
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      setNodes((currentNodes) => currentNodes.map((node) => ({ ...node, selected: true })));
      setEdges((currentEdges) => currentEdges.map((edge) => ({ ...edge, selected: true })));
      setAllFreeArrowsSelected(true);
      setSelectedFreeArrowIds(freeArrows.map((arrow) => arrow.id));
      setSelectedFreeArrowId(null);
      setActiveTool('select');
      event.preventDefault();
      return;
    }

    if (event.altKey && event.key.toLowerCase() === 'd') {
      duplicateSelection();
      event.preventDefault();
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === 'v' || key === 'h' || key === 'r' || key === 'o' || key === 'd' || key === 't' || key === 'a') {
      const toolByKey: Record<'v' | 'h' | 'r' | 'o' | 'd' | 't' | 'a', Tool> = {
        v: 'select',
        h: 'hand',
        r: 'rectangle',
        o: 'circle',
        d: 'diamond',
        t: 'text',
        a: 'arrow',
      };
      changeTool(toolByKey[key]);
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape') {
      setShortcutGuideOpen(false);
      setSelectedFreeArrowId(null);
      setSelectedFreeArrowIds([]);
      setAllFreeArrowsSelected(false);
      setFreeArrowStyling(false);
      setFreeArrowLabelEditing(false);
      setNodes((currentNodes) => currentNodes.map((node) => node.selected ? { ...node, selected: false } : node));
      setEdges((currentEdges) => currentEdges.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
      event.preventDefault();
      return;
    }

    const viewport = getViewport();
    const step = event.shiftKey ? 200 : 60;
    switch (event.key) {
      case '+':
      case '=':
        void zoomIn(animationOptions());
        break;
      case '-':
      case '_':
        void zoomOut(animationOptions());
        break;
      case '0':
        void setViewport(INITIAL_VIEWPORT, animationOptions());
        break;
      case 'ArrowLeft':
        if (event.target !== event.currentTarget) return;
        void setViewport({ ...viewport, x: viewport.x + step });
        break;
      case 'ArrowRight':
        if (event.target !== event.currentTarget) return;
        void setViewport({ ...viewport, x: viewport.x - step });
        break;
      case 'ArrowUp':
        if (event.target !== event.currentTarget) return;
        void setViewport({ ...viewport, y: viewport.y + step });
        break;
      case 'ArrowDown':
        if (event.target !== event.currentTarget) return;
        void setViewport({ ...viewport, y: viewport.y - step });
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  const contentRects = [
    ...nodes.map((node) => ({
      x: node.position.x,
      y: node.position.y,
      ...canvasNodeSize(node),
    })),
    ...freeArrows.map((arrow) => {
      const start = arrow.startBinding ? bindingPosition(arrow.startBinding) ?? arrow.start : arrow.start;
      const end = arrow.endBinding ? bindingPosition(arrow.endBinding) ?? arrow.end : arrow.end;
      const padding = 12 / viewport.zoom;
      return {
        x: Math.min(start.x, end.x) - padding,
        y: Math.min(start.y, end.y) - padding,
        width: Math.max(Math.abs(end.x - start.x), padding * 2),
        height: Math.max(Math.abs(end.y - start.y), padding * 2),
      };
    }),
  ];
  const canvasWidth = canvasRef.current?.clientWidth ?? 0;
  const canvasHeight = canvasRef.current?.clientHeight ?? 0;
  const hasVisibleContent = contentRects.some((rect) => {
    const left = rect.x * viewport.zoom + viewport.x;
    const top = rect.y * viewport.zoom + viewport.y;
    const right = (rect.x + rect.width) * viewport.zoom + viewport.x;
    const bottom = (rect.y + rect.height) * viewport.zoom + viewport.y;
    return right >= 0 && left <= canvasWidth && bottom >= 0 && top <= canvasHeight;
  });
  const showReturnToContent = contentRects.length > 0 && canvasWidth > 0 && canvasHeight > 0 && !hasVisibleContent;

  function returnToContent() {
    const visibleCenter = {
      x: (canvasWidth / 2 - viewport.x) / viewport.zoom,
      y: (canvasHeight / 2 - viewport.y) / viewport.zoom,
    };
    const nearest = contentRects.reduce((closest, rect) => {
      const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      const distance = Math.hypot(center.x - visibleCenter.x, center.y - visibleCenter.y);
      return !closest || distance < closest.distance ? { center, distance } : closest;
    }, null as { center: XYPosition; distance: number } | null);
    if (!nearest) return;

    void setViewport({
      x: canvasWidth / 2 - nearest.center.x * viewport.zoom,
      y: canvasHeight / 2 - nearest.center.y * viewport.zoom,
      zoom: viewport.zoom,
    }, animationOptions());
  }

  const selectedArrowCount = allFreeArrowsSelected
    ? freeArrows.length
    : new Set([
      ...selectedFreeArrowIds,
      ...(selectedFreeArrowId ? [selectedFreeArrowId] : []),
    ]).size;
  const hasMultipleSelection = nodes.filter((node) => node.selected).length
    + edges.filter((edge) => edge.selected).length
    + selectedArrowCount > 1;

  return (
    <main
      ref={canvasRef}
      className={`canvas-region tool-${activeTool}${hasMultipleSelection ? ' has-multiple-selection' : ''}`}
      aria-label="Diagram canvas"
      aria-describedby="canvas-help"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('application/cs-component')) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={onDrop}
      onPointerDownCapture={(event) => {
        startArrowMarqueeSelection(event);
        startShapeDraw(event);
        startFreeArrow(event);
        if (event.target instanceof Element && event.target.closest('.react-flow__pane')) {
          canvasRef.current?.focus({ preventScroll: true });
        }
      }}
    >
      <CanvasChrome
        activeTool={activeTool}
        libraryOpen={libraryOpen}
        onLibraryToggle={() => setLibraryOpen((open) => !open)}
        onShortcutGuideToggle={() => setShortcutGuideOpen((open) => !open)}
        onToolChange={changeTool}
        shortcutGuideOpen={shortcutGuideOpen}
      />
      {libraryOpen && <ComponentLibrary onAdd={addComponent} />}
      {shortcutGuideOpen && <ShortcutGuide onClose={() => setShortcutGuideOpen(false)} />}
      {showReturnToContent && (
        <button type="button" className="return-to-content nodrag nopan" onClick={returnToContent}>
          <LocateFixed size={16} aria-hidden="true" />
          Back to content
        </button>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={(event) => {
          if (activeTool === 'arrow') return;
          setSelectedFreeArrowId(null);
          setSelectedFreeArrowIds([]);
          setAllFreeArrowsSelected(false);
          setFreeArrowStyling(false);
          if (activeTool !== 'text') return;
          const instanceId = crypto.randomUUID();
          setNodes((currentNodes) => currentNodes.concat({
            id: instanceId,
            type: 'text',
            position: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
            data: { instanceId, text: 'Write something', fontSize: 18, color: 'gray', colorStyle: 'subtle' },
            selected: true,
          }));
          setActiveTool('select');
        }}
        edgesReconnectable={false}
        elementsSelectable={activeTool === 'select'}
        nodesDraggable={activeTool === 'select'}
        connectionRadius={28}
        elevateNodesOnSelect={false}
        elevateEdgesOnSelect
        defaultViewport={INITIAL_VIEWPORT}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        colorMode="dark"
        panOnDrag={activeTool === 'hand' ? [0, 1] : [1]}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        preventScrolling
        selectionOnDrag={activeTool === 'select'}
        selectionKeyCode={null}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        deleteKeyCode={['Backspace', 'Delete']}
        attributionPosition="top-right"
      >
        <Background
          id="workspace-grid"
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#303030"
          bgColor="#0d0d0d"
        />
        <Panel position="bottom-left" className="canvas-hint">
          <p id="canvas-help">
            Two-finger move to pan <span aria-hidden="true">·</span> Pinch to zoom
            <span className="sr-only">. With the canvas focused, use arrow keys to pan, plus and minus to zoom, and 0 to reset the view.</span>
          </p>
        </Panel>
        <ViewportControls />
      </ReactFlow>
      <svg className="free-arrow-layer" aria-label="Free arrows">
        <defs>
          {freeArrows.map((arrow) => (
            <marker id={`free-arrow-head-${arrow.id}`} key={arrow.id} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 8 4 L 0 8 z" style={{ fill: elementColorValue(arrow.color ?? 'gray') }} />
            </marker>
          ))}
        </defs>
        {freeArrows.map((arrow) => {
          const route = arrowRoutePoints(arrow);
          const screenRoute = route.map((point) => ({ x: point.x * viewport.zoom + viewport.x, y: point.y * viewport.zoom + viewport.y }));
          const start = screenRoute[0];
          const end = screenRoute[screenRoute.length - 1];
          const routedPath = getManualEdgePath(start, end, screenRoute.slice(1, -1));
          const path = routedPath.path;
          const selected = allFreeArrowsSelected || selectedFreeArrowIds.includes(arrow.id) || arrow.id === selectedFreeArrowId;
          const color = elementColorValue(arrow.color ?? 'gray');
          const mode = arrow.colorStyle ?? 'subtle';
          return (
            <g key={arrow.id} className={selected ? 'is-selected' : undefined}>
              <path className="free-arrow-visible" d={path} markerEnd={`url(#free-arrow-head-${arrow.id})`} style={{ stroke: color, strokeDasharray: edgeStrokeDasharray(arrow.arrowStyle ?? 'normal'), strokeOpacity: mode === 'subtle' ? 0.78 : 1, strokeWidth: mode === 'tinted' ? 2.6 : mode === 'outline' ? 2 : 1.6 }} />
              <path className="free-arrow-hit-area" d={path} onPointerDown={(event) => startFreeArrowDrag(event, arrow)} />
              {arrow.label?.trim() && (() => {
                const labelWidth = Math.min(Math.max(arrow.label.trim().length * 7 + 20, 44), 220);
                return (
                  <foreignObject
                    className="free-arrow-label-foreign"
                    x={routedPath.labelX - labelWidth / 2}
                    y={routedPath.labelY - 12}
                    width={labelWidth}
                    height="24"
                    aria-label={`Arrow label: ${arrow.label}`}
                  >
                    <div className="free-arrow-label" title={arrow.label}>{arrow.label}</div>
                  </foreignObject>
                );
              })()}
              {selected && !hasMultipleSelection && (
                <>
                  <circle className="free-arrow-endpoint" cx={start.x} cy={start.y} r="6" onPointerDown={(event) => startFreeArrowEndpointDrag(event, arrow.id, 'start')} />
                  <circle className="free-arrow-endpoint" cx={end.x} cy={end.y} r="6" onPointerDown={(event) => startFreeArrowEndpointDrag(event, arrow.id, 'end')} />
                  {route.slice(1, -2).map((segmentStart, index) => {
                    const segmentEnd = route[index + 2];
                    const screenStart = screenRoute[index + 1];
                    const screenEnd = screenRoute[index + 2];
                    const length = Math.hypot(screenEnd.x - screenStart.x, screenEnd.y - screenStart.y);
                    if (length < 28) return null;
                    return (
                      <circle
                        className={`free-arrow-segment${arrow.fixedSegment?.axis === (segmentStart.x === segmentEnd.x ? 'x' : 'y') ? ' is-fixed' : ''}`}
                        cx={(screenStart.x + screenEnd.x) / 2}
                        cy={(screenStart.y + screenEnd.y) / 2}
                        r="5"
                        key={`${index}-${segmentStart.x}-${segmentStart.y}`}
                        onPointerDown={(event) => startFreeArrowSegmentDrag(event, arrow.id, segmentStart, segmentEnd)}
                      />
                    );
                  })}
                </>
              )}
            </g>
          );
        })}
      </svg>
      {selectedFreeArrowId && (() => {
        const arrow = freeArrows.find((candidate) => candidate.id === selectedFreeArrowId);
        if (!arrow) return null;
        const screenRoute = arrowRoutePoints(arrow).map((point) => ({ x: point.x * viewport.zoom + viewport.x, y: point.y * viewport.zoom + viewport.y }));
        const routedPath = getManualEdgePath(screenRoute[0], screenRoute[screenRoute.length - 1], screenRoute.slice(1, -1));
        const midpoint = { x: routedPath.labelX, y: routedPath.labelY };
        return (
          <div className="free-arrow-actions node-actions nodrag nopan" style={{ left: midpoint.x, top: midpoint.y }}>
            {freeArrowStyling ? (
              <ElementStylePanel
                color={arrow.color ?? 'gray'}
                mode={arrow.colorStyle ?? 'subtle'}
                onColorChange={(color) => updateFreeArrow(arrow.id, { color })}
                onModeChange={(colorStyle) => updateFreeArrow(arrow.id, { colorStyle })}
              />
            ) : freeArrowLabelEditing ? (
              <div className="free-arrow-label-editor">
                <input
                  type="text"
                  value={arrow.label ?? ''}
                  aria-label="Custom arrow label"
                  placeholder="Arrow label"
                  autoFocus
                  maxLength={80}
                  onChange={(event) => updateFreeArrow(arrow.id, { label: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      setFreeArrowLabelEditing(false);
                      event.preventDefault();
                    } else if (event.key === 'Escape') {
                      setFreeArrowLabelEditing(false);
                      event.stopPropagation();
                    }
                  }}
                />
                <button type="button" data-tooltip="Done" aria-label="Finish editing arrow label" onClick={() => setFreeArrowLabelEditing(false)}><Check size={15} aria-hidden="true" /></button>
                {arrow.label && (
                  <button type="button" data-tooltip="Clear label" aria-label="Clear arrow label" onClick={() => updateFreeArrow(arrow.id, { label: undefined })}><X size={15} aria-hidden="true" /></button>
                )}
              </div>
            ) : (
              <>
                <div className="free-arrow-style-options" role="group" aria-label="Arrow line style">
                  {arrowStyles.map((style) => (
                    <button
                      type="button"
                      className={(arrow.arrowStyle ?? 'normal') === style.id ? 'is-current' : undefined}
                      aria-label={`${style.name} line`}
                      aria-pressed={(arrow.arrowStyle ?? 'normal') === style.id}
                      data-tooltip={style.id === 'normal' ? 'Solid line' : style.id === 'dashed' ? 'Dashed line' : 'Dotted line'}
                      key={style.id}
                      onClick={() => updateFreeArrow(arrow.id, { arrowStyle: style.id })}
                    >
                      <span className={`arrow-swatch arrow-swatch-${style.id}`} />
                    </button>
                  ))}
                </div>
                <button type="button" data-tooltip={arrow.label ? 'Edit label' : 'Add label'} aria-label={arrow.label ? 'Edit arrow label' : 'Add arrow label'} onClick={() => { setFreeArrowStyling(false); setFreeArrowLabelEditing(true); }}><Type size={15} aria-hidden="true" /></button>
                <button type="button" data-tooltip="Color and style" aria-label="Edit arrow color and style" onClick={() => setFreeArrowStyling(true)}><Palette size={15} aria-hidden="true" /></button>
                {arrow.fixedSegment && (
                  <button type="button" data-tooltip="Reset automatic route" aria-label="Reset automatic arrow route" onClick={() => updateFreeArrow(arrow.id, { fixedSegment: undefined })}><RouteOff size={15} aria-hidden="true" /></button>
                )}
                <button type="button" className="delete-action" data-tooltip="Delete" aria-label="Delete arrow" onClick={() => { setFreeArrows((arrows) => arrows.filter((candidate) => candidate.id !== arrow.id)); setSelectedFreeArrowId(null); setSelectedFreeArrowIds([]); }}><Trash2 size={15} aria-hidden="true" /></button>
              </>
            )}
          </div>
        );
      })()}
    </main>
  );
}

export function CanvasWorkspace() {
  return (
    <>
      <div className="workspace">
        <header className="workspace-header">
          <span className="workspace-name">Canvas</span>
          <span className="workspace-description">CS workspace</span>
        </header>
        {/* A grid shell leaves room for a future library rail without coupling it to the viewport. */}
        <div className="workspace-body">
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
        </div>
      </div>
      <TooltipLayer />
    </>
  );
}
