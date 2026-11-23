import { useEffect, useState } from 'react';
import { NodeResizer, NodeToolbar, Position, useReactFlow } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { BringToFront, Palette, SendToBack, StepBack, StepForward, Trash2 } from 'lucide-react';
import { ElementStylePanel, elementColorValue } from './ElementStylePanel';
import type { ElementColor, ElementStyleMode } from './ElementStylePanel';

export type ShapeKind = 'rectangle' | 'ellipse' | 'diamond';

export type ShapeNodeData = {
  instanceId: string;
  shape: ShapeKind;
  color?: ElementColor;
  colorStyle?: ElementStyleMode;
};

export type ShapeNodeType = Node<ShapeNodeData, 'shape'>;

export function ShapeNode({ data, draggable, dragging, id, selected }: NodeProps<ShapeNodeType>) {
  const [styling, setStyling] = useState(false);
  const { setNodes } = useReactFlow<ShapeNodeType>();
  const color = data.color ?? 'gray';
  const colorStyle = data.colorStyle ?? 'subtle';
  const colorValue = elementColorValue(color);
  const shapeVariables = {
    '--shape-border': colorStyle === 'outline' ? colorValue : `${colorValue}${colorStyle === 'tinted' ? 'a8' : '72'}`,
    '--shape-fill': colorStyle === 'tinted' ? `${colorValue}28` : colorStyle === 'outline' ? 'transparent' : `${colorValue}12`,
  } as CSSProperties;

  useEffect(() => {
    if (!selected) setStyling(false);
  }, [selected]);

  function updateStyle(update: { color?: ElementColor; colorStyle?: ElementStyleMode }) {
    setNodes((nodes) => nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, ...update } } : node));
  }

  function moveLayer(action: 'front' | 'forward' | 'backward' | 'back') {
    setNodes((nodes) => {
      const index = nodes.findIndex((node) => node.id === id);
      if (index < 0) return nodes;
      const target = action === 'front'
        ? nodes.length - 1
        : action === 'forward'
          ? Math.min(nodes.length - 1, index + 1)
          : action === 'backward'
            ? Math.max(0, index - 1)
            : 0;
      if (target === index) return nodes;
      const reordered = [...nodes];
      const [node] = reordered.splice(index, 1);
      reordered.splice(target, 0, node);
      return reordered;
    });
  }

  return (
    <>
      <NodeResizer
        isVisible={Boolean(selected && draggable && !dragging)}
        minWidth={40}
        minHeight={40}
        color="#8f8f8f"
        lineClassName="shape-resize-line"
        handleClassName="shape-resize-handle"
      />
      <NodeToolbar className="node-actions nodrag nopan" isVisible={selected && draggable && !dragging} position={Position.Top} offset={10}>
        {styling ? (
          <ElementStylePanel
            color={color}
            mode={colorStyle}
            onColorChange={(nextColor) => updateStyle({ color: nextColor })}
            onModeChange={(nextStyle) => updateStyle({ colorStyle: nextStyle })}
          />
        ) : (
          <>
            <button type="button" data-tooltip="Color and style" aria-label="Edit shape color and style" onClick={() => setStyling(true)}>
              <Palette size={15} aria-hidden="true" />
            </button>
            <span className="node-action-divider" aria-hidden="true" />
            <button type="button" data-tooltip="Bring to front" aria-label="Bring shape to front" onClick={() => moveLayer('front')}>
              <BringToFront size={15} aria-hidden="true" />
            </button>
            <button type="button" data-tooltip="Bring forward" aria-label="Bring shape forward" onClick={() => moveLayer('forward')}>
              <StepForward size={15} aria-hidden="true" />
            </button>
            <button type="button" data-tooltip="Send backward" aria-label="Send shape backward" onClick={() => moveLayer('backward')}>
              <StepBack size={15} aria-hidden="true" />
            </button>
            <button type="button" data-tooltip="Send to back" aria-label="Send shape to back" onClick={() => moveLayer('back')}>
              <SendToBack size={15} aria-hidden="true" />
            </button>
            <span className="node-action-divider" aria-hidden="true" />
            <button type="button" className="delete-action" data-tooltip="Delete" aria-label="Delete shape" onClick={() => setNodes((nodes) => nodes.filter((node) => node.id !== id))}>
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </>
        )}
      </NodeToolbar>
      <div className={`shape-node shape-${data.shape}${selected ? ' is-selected' : ''}`} style={shapeVariables}>
        {data.shape === 'diamond' ? (
          <svg className="shape-diamond-surface" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Conditional diamond">
            <polygon points="50,1 99,50 50,99 1,50" />
          </svg>
        ) : <div className="shape-surface" />}
      </div>
    </>
  );
}
