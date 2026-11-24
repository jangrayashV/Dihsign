import type { Node } from '@xyflow/react';

export type NodeLayerAction = 'front' | 'forward' | 'backward' | 'back';

export function moveNodeLayer<NodeType extends Node>(nodes: NodeType[], id: string, action: NodeLayerAction): NodeType[] {
  const ordered = nodes
    .map((node, sourceIndex) => ({ node, sourceIndex }))
    .sort((left, right) => {
      const layerDifference = (left.node.zIndex ?? 0) - (right.node.zIndex ?? 0);
      return layerDifference || left.sourceIndex - right.sourceIndex;
    })
    .map(({ node }) => node);
  const currentIndex = ordered.findIndex((node) => node.id === id);
  if (currentIndex === -1) return nodes;

  const targetIndex = action === 'front'
    ? ordered.length - 1
    : action === 'forward'
      ? Math.min(currentIndex + 1, ordered.length - 1)
      : action === 'backward'
        ? Math.max(currentIndex - 1, 0)
        : 0;
  if (currentIndex === targetIndex) return nodes;

  const [movingNode] = ordered.splice(currentIndex, 1);
  ordered.splice(targetIndex, 0, movingNode);
  const layers = new Map(ordered.map((node, index) => [node.id, index]));
  return nodes.map((node) => ({ ...node, zIndex: layers.get(node.id) ?? 0 }));
}
