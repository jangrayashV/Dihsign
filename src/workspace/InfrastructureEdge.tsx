import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow } from '@xyflow/react';
import type { Edge, EdgeProps, Node, XYPosition } from '@xyflow/react';
import { Check, Palette, PencilLine, RefreshCw, RouteOff, Tag, Trash2, X } from 'lucide-react';
import { ElementStylePanel, elementColorValue } from './ElementStylePanel';
import type { ElementColor, ElementStyleMode } from './ElementStylePanel';

export type ArrowStyle = 'normal' | 'dashed' | 'small-dashed';
export type ConnectionType = 'http' | 'grpc' | 'handshake' | 'api-call' | 'websocket' | 'database-query' | 'event';
export type InfrastructureEdgeData = {
  arrowStyle: ArrowStyle;
  connectionType?: ConnectionType;
  customLabel?: string;
  /** Canvas-space bend positions. Endpoints stay live and are supplied by React Flow. */
  controlPoints?: XYPosition[];
  color?: ElementColor;
  colorStyle?: ElementStyleMode;
};
export type InfrastructureEdgeType = Edge<InfrastructureEdgeData, 'infrastructure'>;

export const arrowStyles: Array<{ id: ArrowStyle; name: string }> = [
  { id: 'normal', name: 'Normal' },
  { id: 'dashed', name: 'Dashed' },
  { id: 'small-dashed', name: 'Small dashed' },
];

export const EDGE_CORNER_RADIUS = 10;

export const connectionTypes: Array<{ id: ConnectionType; name: string }> = [
  { id: 'http', name: 'HTTP' },
  { id: 'grpc', name: 'gRPC' },
  { id: 'handshake', name: 'Handshake' },
  { id: 'api-call', name: 'API call' },
  { id: 'websocket', name: 'WebSocket' },
  { id: 'database-query', name: 'Database query' },
  { id: 'event', name: 'Event' },
];

export function edgeStrokeDasharray(style: ArrowStyle) {
  if (style === 'dashed') return '10 7';
  if (style === 'small-dashed') return '3 4';
  return undefined;
}

function completeEdgeData(data?: InfrastructureEdgeData): InfrastructureEdgeData {
  return { ...data, arrowStyle: data?.arrowStyle ?? 'normal' };
}

type RoutedPath = { path: string; labelX: number; labelY: number };

function pointAlongRoute(points: XYPosition[], fraction: number) {
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const routeLength = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = routeLength * fraction;

  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const ratio = lengths[index] === 0 ? 0 : remaining / lengths[index];
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * ratio,
        y: points[index].y + (points[index + 1].y - points[index].y) * ratio,
      };
    }
    remaining -= lengths[index];
  }

  return points[0];
}

function distanceToSegment(point: XYPosition, start: XYPosition, end: XYPosition) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
}

/** Builds a lightly rounded polyline whose intermediate anchors remain easy to edit. */
export function getManualEdgePath(source: XYPosition, target: XYPosition, controlPoints: XYPosition[]): RoutedPath {
  const points = [source, ...controlPoints, target];
  let path = `M ${source.x} ${source.y}`;

  controlPoints.forEach((point, index) => {
    const previous = points[index];
    const next = points[index + 2];
    const incomingLength = Math.hypot(point.x - previous.x, point.y - previous.y);
    const outgoingLength = Math.hypot(next.x - point.x, next.y - point.y);
    const radius = Math.min(16, incomingLength / 2, outgoingLength / 2);
    const before = incomingLength === 0 ? point : {
      x: point.x + ((previous.x - point.x) * radius) / incomingLength,
      y: point.y + ((previous.y - point.y) * radius) / incomingLength,
    };
    const after = outgoingLength === 0 ? point : {
      x: point.x + ((next.x - point.x) * radius) / outgoingLength,
      y: point.y + ((next.y - point.y) * radius) / outgoingLength,
    };
    path += ` L ${before.x} ${before.y} Q ${point.x} ${point.y} ${after.x} ${after.y}`;
  });

  path += ` L ${target.x} ${target.y}`;
  const label = pointAlongRoute(points, 0.5);
  return { path, labelX: label.x, labelY: label.y };
}

export function InfrastructureEdge({ id, data, markerEnd, selected, sourceX, sourceY, sourcePosition, style, targetX, targetY, targetPosition }: EdgeProps<InfrastructureEdgeType>) {
  const [replacing, setReplacing] = useState(false);
  const [describing, setDescribing] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [styling, setStyling] = useState(false);
  const [customDraft, setCustomDraft] = useState(data?.customLabel ?? '');
  const stopDraggingRef = useRef<(() => void) | null>(null);
  const { screenToFlowPosition, setEdges } = useReactFlow<Node, InfrastructureEdgeType>();
  const controlPoints = data?.controlPoints;
  const automaticPath = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: EDGE_CORNER_RADIUS,
  });
  const routedPath = controlPoints?.length
    ? getManualEdgePath({ x: sourceX, y: sourceY }, { x: targetX, y: targetY }, controlPoints)
    : { path: automaticPath[0], labelX: automaticPath[1], labelY: automaticPath[2] };
  const { path, labelX, labelY } = routedPath;
  const arrowStyle = data?.arrowStyle ?? 'normal';
  const connectionType = data?.connectionType;
  const customLabel = data?.customLabel;
  const color = data?.color ?? 'gray';
  const colorStyle = data?.colorStyle ?? 'subtle';
  const colorValue = elementColorValue(color);
  const strokeWidth = colorStyle === 'tinted' ? 2.4 : colorStyle === 'outline' ? 1.8 : 1.4;
  const strokeOpacity = colorStyle === 'subtle' ? 0.78 : 1;

  useEffect(() => () => stopDraggingRef.current?.(), []);
  useEffect(() => {
    if (!selected) {
      setStyling(false);
      setCustomizing(false);
      setDescribing(false);
      setReplacing(false);
    }
  }, [selected]);

  function updateVisualStyle(update: { color?: ElementColor; colorStyle?: ElementStyleMode }) {
    setEdges((edges) => edges.map((edge) => {
      if (edge.id !== id) return edge;
      const nextData = { ...completeEdgeData(edge.data), ...update };
      const nextColor = elementColorValue(nextData.color ?? 'gray');
      const nextMode = nextData.colorStyle ?? 'subtle';
      return {
        ...edge,
        data: nextData,
        markerEnd: typeof edge.markerEnd === 'object' ? { ...edge.markerEnd, color: nextColor } : edge.markerEnd,
        style: {
          ...edge.style,
          stroke: nextColor,
          strokeOpacity: nextMode === 'subtle' ? 0.78 : 1,
          strokeWidth: nextMode === 'tinted' ? 2.4 : nextMode === 'outline' ? 1.8 : 1.4,
        },
      };
    }));
  }

  function setControlPoints(nextPoints?: XYPosition[]) {
    setEdges((edges) => edges.map((edge) => edge.id === id ? {
      ...edge,
      data: { ...completeEdgeData(edge.data), controlPoints: nextPoints?.length ? nextPoints : undefined },
    } : edge));
  }

  function startDraggingPoint(event: ReactPointerEvent<HTMLButtonElement>, pointIndex: number, initialPoints: XYPosition[]) {
    event.preventDefault();
    event.stopPropagation();
    stopDraggingRef.current?.();

    const move = (pointerEvent: PointerEvent) => {
      const position = screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY });
      setEdges((edges) => edges.map((edge) => {
        if (edge.id !== id) return edge;
        const currentPoints = edge.data?.controlPoints ?? initialPoints;
        return {
          ...edge,
          data: {
            ...completeEdgeData(edge.data),
            controlPoints: currentPoints.map((point, index) => index === pointIndex ? position : point),
          },
        };
      }));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      stopDraggingRef.current = null;
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    stopDraggingRef.current = stop;
  }

  function addControlPoint(position: XYPosition) {
    const routePoints = [{ x: sourceX, y: sourceY }, ...(controlPoints ?? []), { x: targetX, y: targetY }];
    let segmentIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    routePoints.slice(0, -1).forEach((point, index) => {
      const distance = distanceToSegment(position, point, routePoints[index + 1]);
      if (distance < closestDistance) {
        closestDistance = distance;
        segmentIndex = index;
      }
    });
    const nextPoints = [...(controlPoints ?? [])];
    nextPoints.splice(segmentIndex, 0, position);
    setControlPoints(nextPoints);
  }

  function removeControlPoint(index: number) {
    setControlPoints(controlPoints?.filter((_, pointIndex) => pointIndex !== index));
  }

  function replaceWith(nextStyle: ArrowStyle) {
    setEdges((edges) => edges.map((edge) => edge.id === id ? { ...edge, data: { ...completeEdgeData(edge.data), arrowStyle: nextStyle }, style: { ...edge.style, strokeDasharray: edgeStrokeDasharray(nextStyle) } } : edge));
    setReplacing(false);
  }

  function describeAs(nextType?: ConnectionType) {
    setEdges((edges) => edges.map((edge) => edge.id === id ? { ...edge, data: { ...completeEdgeData(edge.data), connectionType: nextType, customLabel: undefined } } : edge));
    setDescribing(false);
  }

  function saveCustomLabel() {
    const label = customDraft.trim();
    setEdges((edges) => edges.map((edge) => edge.id === id ? { ...edge, data: { ...completeEdgeData(edge.data), connectionType: undefined, customLabel: label || undefined } } : edge));
    setCustomizing(false);
    setDescribing(false);
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ ...style, stroke: colorValue, strokeWidth, strokeOpacity, strokeDasharray: edgeStrokeDasharray(arrowStyle) }}
        interactionWidth={30}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          addControlPoint(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        }}
      />
      <EdgeLabelRenderer>
        {selected && (
          <>
            {controlPoints?.map((point, index) => (
              <button
                type="button"
                className="edge-point edge-point-control nodrag nopan"
                aria-label={`Bend point ${index + 1}. Drag to move; double click to remove`}
                data-tooltip="Drag to move · Double-click to remove"
                key={`control-${index}`}
                style={{ left: point.x, top: point.y }}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); removeControlPoint(index); }}
                onKeyDown={(event) => {
                  if (event.key === 'Backspace' || event.key === 'Delete') {
                    event.preventDefault();
                    event.stopPropagation();
                    removeControlPoint(index);
                  }
                }}
                onPointerDown={(event) => startDraggingPoint(event, index, controlPoints)}
              />
            ))}
          </>
        )}
        {(connectionType || customLabel) && (
          <div className="connection-label" style={{ left: labelX, top: labelY + 10, transform: 'translate(-50%, 0)' }}>
            {customLabel || connectionTypes.find((type) => type.id === connectionType)?.name}
          </div>
        )}
        {selected && (
          <div
            className="edge-actions nodrag nopan"
            style={{ left: labelX, top: labelY - 18, transform: 'translate(-50%, -100%)' }}
          >
            {styling ? (
              <ElementStylePanel
                color={color}
                mode={colorStyle}
                onColorChange={(nextColor) => updateVisualStyle({ color: nextColor })}
                onModeChange={(nextStyle) => updateVisualStyle({ colorStyle: nextStyle })}
              />
            ) : customizing ? (
              <div className="custom-connection-editor">
                <input
                  autoFocus
                  aria-label="Custom connection label"
                  placeholder="Custom label"
                  value={customDraft}
                  onChange={(event) => setCustomDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') saveCustomLabel();
                    if (event.key === 'Escape') setCustomizing(false);
                  }}
                />
                <button type="button" data-tooltip="Save label" aria-label="Save custom connection label" onClick={saveCustomLabel}><Check size={15} aria-hidden="true" /></button>
                <button type="button" data-tooltip="Cancel" aria-label="Cancel custom connection label" onClick={() => setCustomizing(false)}><X size={15} aria-hidden="true" /></button>
              </div>
            ) : describing ? (
              <div className="connection-type-options" aria-label="Describe connection">
                <button type="button" aria-pressed={!connectionType && !customLabel} className={!connectionType && !customLabel ? 'is-current' : undefined} onClick={() => describeAs(undefined)}>
                  None
                </button>
                {connectionTypes.map((option) => (
                  <button type="button" aria-pressed={option.id === connectionType} className={option.id === connectionType ? 'is-current' : undefined} key={option.id} onClick={() => describeAs(option.id)}>
                    {option.name}
                  </button>
                ))}
              </div>
            ) : replacing ? (
              <div className="edge-style-options" aria-label="Replace arrow style">
                {arrowStyles.map((option) => (
                  <button type="button" aria-label={`Use ${option.name} arrow`} aria-pressed={option.id === arrowStyle} className={option.id === arrowStyle ? 'is-current' : undefined} key={option.id} onClick={() => replaceWith(option.id)}>
                    <span className={`arrow-swatch arrow-swatch-${option.id}`} />
                  </button>
                ))}
              </div>
            ) : (
              <>
                <button type="button" data-tooltip="Color and style" aria-label="Edit arrow color and style" onClick={() => setStyling(true)}><Palette size={15} aria-hidden="true" /></button>
                {controlPoints?.length ? (
                  <button type="button" data-tooltip="Reset automatic route" aria-label="Reset automatic edge routing" onClick={() => setControlPoints(undefined)}><RouteOff size={15} aria-hidden="true" /></button>
                ) : null}
                <button type="button" data-tooltip="Describe connection" aria-label="Describe connection" onClick={() => setDescribing(true)}><Tag size={15} aria-hidden="true" /></button>
                <button
                  type="button"
                  className={customLabel ? 'is-active' : undefined}
                  data-tooltip="Custom label"
                  aria-label="Edit custom connection label"
                  aria-pressed={Boolean(customLabel)}
                  onClick={() => { setCustomDraft(customLabel ?? ''); setCustomizing(true); }}
                >
                  <PencilLine size={15} aria-hidden="true" />
                </button>
                <button type="button" data-tooltip="Replace arrow" aria-label="Replace arrow" onClick={() => setReplacing(true)}><RefreshCw size={15} aria-hidden="true" /></button>
                <button type="button" className="delete-action" data-tooltip="Delete arrow" aria-label="Delete arrow" onClick={() => setEdges((edges) => edges.filter((edge) => edge.id !== id))}><Trash2 size={15} aria-hidden="true" /></button>
              </>
            )}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
