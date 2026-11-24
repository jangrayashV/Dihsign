import { useEffect, useRef, useState } from 'react';
import { Check, Download, FileJson2, FilePlus2, Files, FolderOpen, RotateCcw, Trash2, X } from 'lucide-react';
import { ConfirmationDialog } from './ConfirmationDialog';

type SelectedJsonFile = {
  id: string;
  name: string;
  size: number;
  text: string;
};

type Props = {
  activeName?: string;
  browseOpen: boolean;
  status: 'loading' | 'saved' | 'saving' | 'unsaved' | 'error';
  error: string | null;
  onBrowse: () => void;
  onNew: () => Promise<void>;
  onDelete: () => Promise<void>;
  onExport: () => string;
  onImport: (json: string) => Promise<void>;
  onRetry: () => Promise<void>;
  onReload: () => Promise<void>;
};

export function DocumentControls(props: Props) {
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupJson, setBackupJson] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedJsonFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyResetTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => setControlError(null), [props.activeName]);
  useEffect(() => () => window.clearTimeout(copyResetTimerRef.current), []);

  async function run(action: () => Promise<void>) {
    try {
      await action();
      setControlError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The operation failed.';
      if (backupOpen) setDialogError(message);
      else setControlError(message);
    }
  }

  function openBackup() {
    setBackupJson(props.onExport());
    setDialogError(null);
    setCopyState('idle');
    setBackupOpen(true);
  }

  async function selectFiles(files: FileList | null) {
    if (!files?.length) return;
    setDialogError(null);
    try {
      const loaded = await Promise.all(Array.from(files).map(async (file) => {
        if (!file.name.toLowerCase().endsWith('.json')) throw new Error(`“${file.name}” is not a JSON file.`);
        return {
          id: `${file.name}-${file.lastModified}-${file.size}`,
          name: file.name,
          size: file.size,
          text: await file.text(),
        } satisfies SelectedJsonFile;
      }));
      setSelectedFiles(loaded);
      setActiveFileId(loaded[0].id);
      setBackupJson(loaded[0].text);
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : 'The selected file could not be read.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function copyJson() {
    window.clearTimeout(copyResetTimerRef.current);
    try {
      await navigator.clipboard.writeText(backupJson);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    copyResetTimerRef.current = window.setTimeout(() => setCopyState('idle'), 2200);
  }

  function fileSize(bytes: number) {
    return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
  }

  return (
    <>
      <div className="document-controls">
        <span className="current-document-name" title={props.activeName}>{props.activeName || 'Untitled Diagram'}</span>
        <span className={`save-status save-status-${props.status}`} role="status">
          {props.status === 'loading' ? 'Loading…' : props.status === 'saving' ? 'Saving…' : props.status === 'unsaved' ? 'Unsaved' : props.status === 'error' ? 'Save failed' : 'Saved'}
        </span>
        <button type="button" className={props.browseOpen ? 'is-active' : undefined} aria-label="Browse document files" aria-expanded={props.browseOpen} data-tooltip="Browse files" onClick={props.onBrowse}><Files size={15} /></button>
        <button type="button" aria-label="New document" data-tooltip="New document" onClick={() => void run(props.onNew)}><FilePlus2 size={15} /></button>
        <button type="button" aria-label="Import or export JSON backup" data-tooltip="JSON backup" onClick={openBackup}><Download size={15} /></button>
        <button
          type="button"
          aria-label="Delete document"
          data-tooltip="Delete document"
          disabled={props.status === 'loading'}
          onClick={() => setConfirmDelete(true)}
        ><Trash2 size={15} /></button>
      </div>
      {props.error && (
        <div className="storage-error" role="alert">
          <span>{props.error}</span>
          <button type="button" onClick={() => void run(props.onRetry)}>Retry</button>
          <button type="button" onClick={() => void run(props.onReload)}><RotateCcw size={13} /> Reload stored</button>
        </div>
      )}
      {controlError && (
        <div className="document-control-error" role="alert">
          <span>{controlError}</span>
          <button type="button" aria-label="Dismiss document error" onClick={() => setControlError(null)}><X size={14} /></button>
        </div>
      )}
      {backupOpen && (
        <div className="backup-dialog-layer" role="presentation">
          <section className="backup-dialog" role="dialog" aria-modal="true" aria-labelledby="backup-title">
            <header>
              <div><h2 id="backup-title">JSON documents</h2><p>Select a backup file or edit schema v1 JSON directly.</p></div>
              <button type="button" aria-label="Close backup dialog" onClick={() => setBackupOpen(false)}><X size={17} /></button>
            </header>
            <div className="backup-dialog-content">
              <aside className="backup-file-panel" aria-label="Selected JSON files">
                <div className="backup-file-heading">
                  <div><strong>JSON files</strong><span>{selectedFiles.length ? `${selectedFiles.length} selected` : 'Choose backups to open'}</span></div>
                  <button type="button" aria-label="Select JSON files" data-tooltip="Select JSON files" onClick={() => fileInputRef.current?.click()}><FolderOpen size={15} /></button>
                  <input
                    ref={fileInputRef}
                    className="sr-only"
                    type="file"
                    accept=".json,application/json"
                    multiple
                    aria-label="Select JSON files"
                    onChange={(event) => void selectFiles(event.target.files)}
                  />
                </div>
                <div className="backup-file-list">
                  {selectedFiles.map((file) => (
                    <button
                      type="button"
                      className={`backup-file-card${activeFileId === file.id ? ' is-active' : ''}`}
                      key={file.id}
                      onClick={() => { setActiveFileId(file.id); setBackupJson(file.text); setDialogError(null); }}
                    >
                      <FileJson2 size={18} aria-hidden="true" />
                      <span><strong>{file.name}</strong><small>{fileSize(file.size)}</small></span>
                    </button>
                  ))}
                  {!selectedFiles.length && (
                    <button type="button" className="backup-file-empty" onClick={() => fileInputRef.current?.click()}>
                      <FolderOpen size={20} aria-hidden="true" />
                      <strong>Select JSON files</strong>
                      <span>Files appear here as cards</span>
                    </button>
                  )}
                </div>
              </aside>
              <div className="backup-json-editor">
                <label htmlFor="document-json">Editable JSON preview</label>
                <textarea id="document-json" aria-label="Document JSON" spellCheck={false} value={backupJson} onChange={(event) => { setBackupJson(event.target.value); setDialogError(null); }} />
              </div>
            </div>
            {dialogError && <p className="backup-error" role="alert">{dialogError}</p>}
            <footer>
              <span className="backup-open-note">Opening JSON creates a separate document and preserves the current one.</span>
              <button type="button" onClick={() => void copyJson()}>
                {copyState === 'copied' ? <Check size={14} /> : <Download size={14} />}
                {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy JSON'}
              </button>
              <button type="button" className="primary" onClick={() => void run(async () => { await props.onImport(backupJson); setBackupOpen(false); })}>
                <FolderOpen size={14} /> Open JSON document
              </button>
            </footer>
          </section>
        </div>
      )}
      {confirmDelete && (
        <ConfirmationDialog
          title={`Delete “${props.activeName}”?`}
          message="This local document and its complete diagram will be permanently removed."
          confirmLabel="Delete document"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => { setConfirmDelete(false); void run(props.onDelete); }}
        />
      )}
    </>
  );
}
