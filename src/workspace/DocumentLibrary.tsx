import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { Check, FilePlus2, Files, GripVertical, Pencil, Search, Trash2, X } from 'lucide-react';
import type { DocumentSummary } from './diagramDocument';
import { ConfirmationDialog } from './ConfirmationDialog';

type Props = {
  documents: DocumentSummary[];
  activeId?: string;
  onClose: () => void;
  onDelete: (ids: string[]) => Promise<void>;
  onNew: () => Promise<void>;
  onReorder: (ids: string[]) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onSelect: (id: string) => Promise<void>;
};

function updatedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved locally';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function DocumentLibrary({ documents, activeId, onClose, onDelete, onNew, onReorder, onRename, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [orderedDocuments, setOrderedDocuments] = useState(documents);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  useEffect(() => setOrderedDocuments(documents), [documents]);
  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? orderedDocuments.filter((document) => document.name.toLowerCase().includes(normalized)) : orderedDocuments;
  }, [orderedDocuments, query]);

  async function run(action: () => Promise<void>, closeAfter = false) {
    try {
      setError(null);
      await action();
      if (closeAfter) onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The document could not be opened.');
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
  }

  function moveDraggedDocument(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    if (!draggedId || draggedId === targetId || query.trim()) return;
    setOrderedDocuments((current) => {
      const next = [...current];
      const from = next.findIndex((document) => document.id === draggedId);
      const to = next.findIndex((document) => document.id === targetId);
      if (from < 0 || to < 0) return current;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function finishDrag() {
    setDraggedId(null);
    if (!query.trim()) await run(() => onReorder(orderedDocuments.map((document) => document.id)));
  }

  async function saveName(id: string) {
    try {
      setError(null);
      await onRename(id, nameDraft);
      setEditingId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The document could not be renamed.');
    }
  }

  return (
    <div className="document-library-shell">
      <aside className="document-library" aria-label="Document files">
        <header>
          <div><strong>Files</strong><span>{documents.length} {documents.length === 1 ? 'document' : 'documents'}</span></div>
          <button type="button" aria-label="Close file browser" data-tooltip="Close" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="document-library-actions">
          <label className="library-search">
            <Search size={14} aria-hidden="true" />
            <input type="search" value={query} placeholder="Search files" aria-label="Search document files" onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button type="button" aria-label="Create new document" data-tooltip="New document" onClick={() => void run(onNew, true)}><FilePlus2 size={16} /></button>
          <button
            type="button"
            className={selectedIds.length ? 'is-danger' : undefined}
            aria-label={`Delete ${selectedIds.length || ''} selected documents`.trim()}
            data-tooltip={selectedIds.length ? `Delete ${selectedIds.length} selected` : 'Select files to delete'}
            disabled={!selectedIds.length}
            onClick={() => setConfirmDelete(true)}
          ><Trash2 size={16} /></button>
        </div>
        <div className="document-file-list">
          {visibleDocuments.map((document) => {
            const active = document.id === activeId;
            const selected = selectedIds.includes(document.id);
            return (
              <article
                className={`document-file-card${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}${draggedId === document.id ? ' is-dragging' : ''}`}
                draggable={!query.trim() && editingId !== document.id}
                key={document.id}
                onClick={(event) => {
                  if (event.target instanceof Element && event.target.closest('button, input, label')) return;
                  void run(() => onSelect(document.id), true);
                }}
                onDragStart={() => setDraggedId(document.id)}
                onDragOver={(event) => moveDraggedDocument(event, document.id)}
                onDragEnd={() => void finishDrag()}
              >
                <button
                  type="button"
                  className="document-drag-handle"
                  aria-label={`Move ${document.name}`}
                  data-tooltip={query.trim() ? 'Clear search to reorder' : 'Drag to reorder'}
                ><GripVertical size={15} /></button>
                <label className="document-file-select" data-tooltip={selected ? 'Deselect file' : 'Select file'}>
                  <input type="checkbox" checked={selected} aria-label={`Select ${document.name}`} onChange={() => toggleSelection(document.id)} />
                  <span>{selected && <Check size={11} />}</span>
                </label>
                {editingId === document.id ? (
                  <div className="document-file-rename">
                    <input
                      autoFocus
                      value={nameDraft}
                      maxLength={80}
                      aria-label={`Rename ${document.name}`}
                      onChange={(event) => setNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void saveName(document.id);
                        if (event.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <button type="button" aria-label="Save file name" data-tooltip="Save" onClick={() => void saveName(document.id)}><Check size={14} /></button>
                    <button type="button" aria-label="Cancel rename" data-tooltip="Cancel" onClick={() => setEditingId(null)}><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <button type="button" className="document-file-open" aria-current={active ? 'page' : undefined} onClick={() => void run(() => onSelect(document.id), true)}>
                      <span className="document-file-icon"><Files size={18} aria-hidden="true" /></span>
                      <span className="document-file-copy"><strong>{document.name}</strong><small>Updated {updatedLabel(document.updatedAt)}</small></span>
                      {active && <Check className="document-file-check" size={15} aria-label="Open" />}
                    </button>
                    <button type="button" className="document-file-edit" aria-label={`Rename ${document.name}`} data-tooltip="Rename file" onClick={() => { setEditingId(document.id); setNameDraft(document.name); setError(null); }}><Pencil size={14} /></button>
                  </>
                )}
              </article>
            );
          })}
          {!visibleDocuments.length && <p className="document-file-empty">No files match “{query.trim()}”.</p>}
        </div>
        {error && <p className="document-library-error" role="alert">{error}</p>}
      </aside>
      {confirmDelete && (
        <ConfirmationDialog
          title={`Delete ${selectedIds.length} ${selectedIds.length === 1 ? 'document' : 'documents'}?`}
          message="The selected local documents and their diagrams will be permanently removed."
          confirmLabel={selectedIds.length === 1 ? 'Delete document' : `Delete ${selectedIds.length} documents`}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            void run(async () => { await onDelete(selectedIds); setSelectedIds([]); });
          }}
        />
      )}
    </div>
  );
}
