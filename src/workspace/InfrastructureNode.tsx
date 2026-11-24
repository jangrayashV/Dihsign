import { useEffect, useState } from 'react';
import { NodeToolbar, Position, useReactFlow } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { BringToFront, Check, Palette, Pencil, RefreshCw, SendToBack, StepBack, StepForward, Trash2, X } from 'lucide-react';
import { componentDefinitions, componentRegistry } from './componentRegistry';
import type { ComponentId, ComponentProperties } from './componentRegistry';
import { ElementStylePanel, elementColorValue } from './ElementStylePanel';
import type { ElementColor, ElementStyleMode } from './ElementStylePanel';
import { RegistryIcon } from './RegistryIcon';
import { moveNodeLayer } from './nodeLayering';

export type InfrastructureNodeData = {
  instanceId: string;
  componentId: ComponentId;
  label?: string;
  properties: ComponentProperties;
  color?: ElementColor;
  colorStyle?: ElementStyleMode;
};

export type InfrastructureNodeType = Node<InfrastructureNodeData, 'infrastructure'>;

export function InfrastructureNode({ data, draggable, dragging, id, selected }: NodeProps<InfrastructureNodeType>) {
  const [replacing, setReplacing] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [styling, setStyling] = useState(false);
  const [labelDraft, setLabelDraft] = useState(data.label ?? '');
  const { setNodes } = useReactFlow<InfrastructureNodeType>();
  const definition = componentRegistry[data.componentId];
  const color = data.color ?? 'gray';
  const colorStyle = data.colorStyle ?? 'subtle';
  const colorValue = elementColorValue(color);
  const colorVariables = {
    '--node-accent': colorValue,
    '--node-border': colorStyle === 'outline' ? colorValue : `${colorValue}${colorStyle === 'tinted' ? '80' : '45'}`,
    '--node-background': colorStyle === 'tinted' ? `${colorValue}24` : colorStyle === 'outline' ? 'transparent' : '#171717',
    '--node-icon-background': colorStyle === 'tinted' ? `${colorValue}30` : colorStyle === 'outline' ? 'transparent' : `${colorValue}14`,
    '--node-icon-border': colorStyle === 'outline' ? colorValue : `${colorValue}55`,
    '--node-icon-color': colorValue,
  } as CSSProperties;

  useEffect(() => {
    if (!selected) {
      setStyling(false);
      setEditingLabel(false);
      setReplacing(false);
    }
  }, [selected]);

  function updateStyle(update: { color?: ElementColor; colorStyle?: ElementStyleMode }) {
    setNodes((nodes) => nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, ...update } } : node));
  }

  function replaceWith(componentId: ComponentId) {
    const replacement = componentRegistry[componentId];
    setNodes((nodes) => nodes.map((node) => node.id === id ? {
      ...node,
      data: {
        ...node.data,
        componentId,
        properties: { ...replacement.defaultProperties },
      },
    } : node));
    setReplacing(false);
  }

  function saveLabel() {
    const label = labelDraft.trim();
    setNodes((nodes) => nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, label: label || undefined } } : node));
    setEditingLabel(false);
  }

  function moveLayer(action: 'front' | 'forward' | 'backward' | 'back') {
    setNodes((nodes) => moveNodeLayer(nodes, id, action));
  }

  return (
    <>
      <NodeToolbar className="node-actions nodrag nopan" isVisible={selected && draggable && !dragging} position={Position.Top} offset={10}>
        {styling ? (
          <ElementStylePanel
            color={color}
            mode={colorStyle}
            onColorChange={(nextColor) => updateStyle({ color: nextColor })}
            onModeChange={(nextStyle) => updateStyle({ colorStyle: nextStyle })}
          />
        ) : editingLabel ? (
          <div className="label-editor">
            <input
              autoFocus
              aria-label="Component label"
              value={labelDraft}
              placeholder={definition.name}
              onChange={(event) => setLabelDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveLabel();
                if (event.key === 'Escape') setEditingLabel(false);
              }}
            />
            <button type="button" data-tooltip="Save label" aria-label="Save label" onClick={saveLabel}><Check size={15} aria-hidden="true" /></button>
            <button type="button" data-tooltip="Cancel" aria-label="Cancel label editing" onClick={() => setEditingLabel(false)}><X size={15} aria-hidden="true" /></button>
          </div>
        ) : replacing ? (
          <div className="replacement-options" aria-label="Replace component">
            {componentDefinitions.map((candidate) => {
              return (
                <button
                  type="button"
                  aria-label={`Replace with ${candidate.name}`}
                  aria-pressed={candidate.id === data.componentId}
                  className={candidate.id === data.componentId ? 'is-current' : undefined}
                  key={candidate.id}
                  onClick={() => replaceWith(candidate.id)}
                >
                  <RegistryIcon definition={candidate} size={15} />
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <button type="button" data-tooltip="Color and style" aria-label="Edit component color and style" onClick={() => setStyling(true)}>
              <Palette size={15} aria-hidden="true" />
            </button>
            {(!('library' in definition) || definition.library !== 'technology') && (
              <button type="button" data-tooltip="Edit label" aria-label="Edit component label" onClick={() => { setLabelDraft(data.label ?? ''); setEditingLabel(true); }}>
                <Pencil size={15} aria-hidden="true" />
              </button>
            )}
            <button type="button" data-tooltip="Replace" aria-label="Replace component" onClick={() => setReplacing(true)}>
              <RefreshCw size={15} aria-hidden="true" />
            </button>
            <span className="node-action-divider" aria-hidden="true" />
            <button type="button" data-tooltip="Bring to front" aria-label="Bring component to front" onClick={() => moveLayer('front')}><BringToFront size={15} aria-hidden="true" /></button>
            <button type="button" data-tooltip="Bring forward" aria-label="Bring component forward" onClick={() => moveLayer('forward')}><StepForward size={15} aria-hidden="true" /></button>
            <button type="button" data-tooltip="Send backward" aria-label="Send component backward" onClick={() => moveLayer('backward')}><StepBack size={15} aria-hidden="true" /></button>
            <button type="button" data-tooltip="Send to back" aria-label="Send component to back" onClick={() => moveLayer('back')}><SendToBack size={15} aria-hidden="true" /></button>
            <span className="node-action-divider" aria-hidden="true" />
            <button type="button" className="delete-action" data-tooltip="Delete" aria-label="Delete component" onClick={() => setNodes((nodes) => nodes.filter((node) => node.id !== id))}>
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </>
        )}
      </NodeToolbar>

      <div className={`infrastructure-node element-style-${colorStyle}${selected ? ' is-selected' : ''}`} style={colorVariables}>
        <div className="node-icon" aria-hidden="true">
          <RegistryIcon definition={definition} size={20} />
        </div>
        <div className="node-copy">
          <strong>{data.label || definition.name}</strong>
        </div>
      </div>
    </>
  );
}
