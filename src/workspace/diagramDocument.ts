import type { Viewport } from '@xyflow/react';
import type { InfrastructureEdgeType } from './InfrastructureEdge';
import type { InfrastructureNodeType } from './InfrastructureNode';
import type { ShapeNodeType } from './ShapeNode';
import type { TextNodeType } from './TextNode';
import type { ArrowStyle } from './InfrastructureEdge';
import type { ElementColor, ElementStyleMode } from './ElementStylePanel';

export const DOCUMENT_SCHEMA_VERSION = 1 as const;

export type CanvasNode = InfrastructureNodeType | TextNodeType | ShapeNodeType;
export type SnapSide = 'top' | 'right' | 'bottom' | 'left';
export type ArrowBinding = { nodeId: string; side: SnapSide };

export type FreeArrow = {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  label?: string;
  startBinding?: ArrowBinding;
  endBinding?: ArrowBinding;
  arrowStyle?: ArrowStyle;
  color?: ElementColor;
  colorStyle?: ElementStyleMode;
  fixedSegment?: { axis: 'x' | 'y'; value: number };
};

export type DiagramContent = {
  nodes: CanvasNode[];
  edges: InfrastructureEdgeType[];
  freeArrows: FreeArrow[];
  viewport: Viewport;
};

export type DiagramDocument = {
  schemaVersion: typeof DOCUMENT_SCHEMA_VERSION;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  content: DiagramContent;
};

export type DocumentSummary = Pick<DiagramDocument, 'id' | 'name' | 'createdAt' | 'updatedAt' | 'revision'>;

export const EMPTY_DIAGRAM_CONTENT: DiagramContent = {
  nodes: [],
  edges: [],
  freeArrows: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Removes React Flow's runtime-only state and returns a JSON-safe domain snapshot. */
export function createDiagramContent(
  nodes: CanvasNode[],
  edges: InfrastructureEdgeType[],
  freeArrows: FreeArrow[],
  viewport: Viewport,
): DiagramContent {
  const persistedNodes = nodes.map(({ selected: _selected, dragging: _dragging, measured: _measured, resizing: _resizing, ...node }) => node);
  const persistedEdges = edges.map(({ selected: _selected, ...edge }) => edge);
  return JSON.parse(JSON.stringify({
    nodes: persistedNodes,
    edges: persistedEdges,
    freeArrows,
    viewport: {
      x: finiteNumber(viewport.x, 0),
      y: finiteNumber(viewport.y, 0),
      zoom: finiteNumber(viewport.zoom, 1),
    },
  })) as DiagramContent;
}

export function serializeDiagramContent(content: DiagramContent) {
  return JSON.stringify(content);
}

export function parseDiagramDocument(value: unknown): DiagramDocument {
  if (!value || typeof value !== 'object') throw new Error('The backup must contain a document object.');
  const candidate = value as Partial<DiagramDocument>;
  if (candidate.schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported document schema version: ${String(candidate.schemaVersion)}.`);
  }
  if (!candidate.content || typeof candidate.content !== 'object') throw new Error('The backup is missing document content.');
  const content = candidate.content as Partial<DiagramContent>;
  if (!Array.isArray(content.nodes) || !Array.isArray(content.edges) || !Array.isArray(content.freeArrows)) {
    throw new Error('The backup must contain nodes, edges, and freeArrows arrays.');
  }
  if (!content.viewport || typeof content.viewport !== 'object') throw new Error('The backup is missing a viewport.');
  const viewport = content.viewport as Partial<Viewport>;
  if (![viewport.x, viewport.y, viewport.zoom].every((part) => typeof part === 'number' && Number.isFinite(part))) {
    throw new Error('The backup viewport is invalid.');
  }
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) throw new Error('The backup needs a document name.');

  const now = new Date().toISOString();
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : crypto.randomUUID(),
    name: candidate.name.trim(),
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : now,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : now,
    revision: typeof candidate.revision === 'number' ? candidate.revision : 0,
    content: createDiagramContent(
      content.nodes as CanvasNode[],
      content.edges as InfrastructureEdgeType[],
      content.freeArrows as FreeArrow[],
      viewport as Viewport,
    ),
  };
}
