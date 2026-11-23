import { useEffect, useRef, useState } from 'react';
import { NodeToolbar, Position, useReactFlow } from '@xyflow/react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Check, Minus, Palette, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ElementStylePanel, elementColorValue } from './ElementStylePanel';
import type { ElementColor, ElementStyleMode } from './ElementStylePanel';

export type TextNodeData = {
  instanceId: string;
  text: string;
  fontSize?: number;
  color?: ElementColor;
  colorStyle?: ElementStyleMode;
};
export type TextNodeType = Node<TextNodeData, 'text'>;

const MIN_TEXT_SIZE = 10;
const MAX_TEXT_SIZE = 72;

export function TextNode({ data, draggable, dragging, id, selected }: NodeProps<TextNodeType>) {
  const [editing, setEditing] = useState(false);
  const [styling, setStyling] = useState(false);
  const [draft, setDraft] = useState(data.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { setNodes } = useReactFlow<TextNodeType>();
  const fontSize = data.fontSize ?? 18;
  const color = data.color ?? 'gray';
  const colorStyle = data.colorStyle ?? 'subtle';
  const colorValue = elementColorValue(color);
  const editorColumns = Math.min(80, Math.max(1, ...draft.split('\n').map((line) => line.length)));
  const textVariables = {
    '--text-color': colorValue,
    '--text-background': colorStyle === 'tinted' ? `${colorValue}1c` : 'transparent',
    '--text-border': colorStyle === 'outline' ? `${colorValue}a8` : 'transparent',
    '--text-size': `${fontSize}px`,
  } as CSSProperties;

  useEffect(() => {
    if (!selected) {
      setStyling(false);
      setEditing(false);
    }
  }, [selected]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function updateData(update: Partial<TextNodeData>) {
    setNodes((nodes) => nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, ...update } } : node));
  }

  function saveText() {
    const text = draft.trim();
    if (text) updateData({ text });
    else setDraft(data.text);
    setEditing(false);
  }

  function startEditing() {
    setStyling(false);
    setDraft(data.text);
    setEditing(true);
  }

  function changeSize(amount: number) {
    updateData({ fontSize: Math.min(MAX_TEXT_SIZE, Math.max(MIN_TEXT_SIZE, fontSize + amount)) });
  }

  function onEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      setDraft(data.text);
      setEditing(false);
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      saveText();
    }
  }

  return (
    <>
      <NodeToolbar className="node-actions text-actions nodrag nopan" isVisible={selected && draggable && !dragging} position={Position.Top} offset={10}>
        {styling ? (
          <ElementStylePanel
            color={color}
            mode={colorStyle}
            onColorChange={(nextColor) => updateData({ color: nextColor })}
            onModeChange={(nextStyle) => updateData({ colorStyle: nextStyle })}
          />
        ) : editing ? (
          <div className="text-editor-actions">
            <span>Enter to save · Shift+Enter for a new line</span>
            <button type="button" data-tooltip="Save text" aria-label="Save text" onClick={saveText}><Check size={15} aria-hidden="true" /></button>
            <button type="button" data-tooltip="Cancel" aria-label="Cancel text editing" onClick={() => { setDraft(data.text); setEditing(false); }}><X size={15} aria-hidden="true" /></button>
          </div>
        ) : (
          <>
            <div className="text-size-control" role="group" aria-label="Text size">
              <button type="button" data-tooltip="Decrease text size" aria-label="Decrease text size" disabled={fontSize <= MIN_TEXT_SIZE} onClick={() => changeSize(-2)}><Minus size={14} aria-hidden="true" /></button>
              <span aria-label={`${fontSize} pixels`}>{fontSize}</span>
              <button type="button" data-tooltip="Increase text size" aria-label="Increase text size" disabled={fontSize >= MAX_TEXT_SIZE} onClick={() => changeSize(2)}><Plus size={14} aria-hidden="true" /></button>
            </div>
            <button type="button" data-tooltip="Color and style" aria-label="Edit text color and style" onClick={() => setStyling(true)}><Palette size={15} aria-hidden="true" /></button>
            <button type="button" data-tooltip="Edit text" aria-label="Edit text" onClick={startEditing}><Pencil size={15} aria-hidden="true" /></button>
            <button type="button" className="delete-action" data-tooltip="Delete" aria-label="Delete text" onClick={() => setNodes((nodes) => nodes.filter((node) => node.id !== id))}><Trash2 size={15} aria-hidden="true" /></button>
          </>
        )}
      </NodeToolbar>

      <div className={`text-node element-style-${colorStyle}${selected ? ' is-selected' : ''}`} style={textVariables} onDoubleClick={(event) => { event.stopPropagation(); startEditing(); }}>
        {editing ? (
          <textarea ref={inputRef} className="nodrag nopan" aria-label="Text content" cols={editorColumns} rows={Math.max(1, draft.split('\n').length)} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onEditorKeyDown} onBlur={saveText} />
        ) : <span>{data.text}</span>}
      </div>
    </>
  );
}
