import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Viewport } from '@xyflow/react';
import type { InfrastructureEdgeType } from './InfrastructureEdge';
import {
  createDiagramContent,
  EMPTY_DIAGRAM_CONTENT,
  parseDiagramDocument,
  serializeDiagramContent,
  type CanvasNode,
  type DiagramDocument,
  type DocumentSummary,
  type FreeArrow,
} from './diagramDocument';
import * as storage from './documentStorage';

const AUTOSAVE_DELAY_MS = 650;

type SaveStatus = 'loading' | 'saved' | 'saving' | 'unsaved' | 'error';

type Options = {
  nodes: CanvasNode[];
  edges: InfrastructureEdgeType[];
  freeArrows: FreeArrow[];
  viewport: Viewport;
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>;
  setEdges: Dispatch<SetStateAction<InfrastructureEdgeType[]>>;
  setFreeArrows: Dispatch<SetStateAction<FreeArrow[]>>;
  setViewport: (viewport: Viewport) => Promise<boolean>;
};

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'IndexedDB could not save this document.';
}

export function useDiagramDocuments(options: Options) {
  const { nodes, edges, freeArrows, viewport, setNodes, setEdges, setFreeArrows, setViewport } = options;
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [activeDocument, setActiveDocument] = useState<DiagramDocument | null>(null);
  const [status, setStatus] = useState<SaveStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const blockedRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const revisionRef = useRef(0);
  const activeIdRef = useRef<string | null>(null);
  const lastSavedHashRef = useRef('');
  const latestContentRef = useRef(EMPTY_DIAGRAM_CONTENT);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const content = createDiagramContent(nodes, edges, freeArrows, viewport);
  const contentHash = serializeDiagramContent(content);
  latestContentRef.current = content;

  const refreshList = useCallback(async () => {
    setDocuments(await storage.listDocuments());
  }, []);

  const applyDocument = useCallback(async (document: DiagramDocument) => {
    hydratedRef.current = false;
    blockedRef.current = false;
    window.clearTimeout(timerRef.current);
    setNodes(document.content.nodes);
    setEdges(document.content.edges);
    setFreeArrows(document.content.freeArrows);
    await setViewport(document.content.viewport);
    revisionRef.current = document.revision;
    activeIdRef.current = document.id;
    lastSavedHashRef.current = serializeDiagramContent(document.content);
    latestContentRef.current = document.content;
    setActiveDocument(document);
    await storage.setActiveDocumentId(document.id);
    setError(null);
    setStatus('saved');
    queueMicrotask(() => { hydratedRef.current = true; });
  }, [setEdges, setFreeArrows, setNodes, setViewport]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const document = await storage.ensureDocument(EMPTY_DIAGRAM_CONTENT);
        if (cancelled) return;
        await applyDocument(document);
        if (!cancelled) await refreshList();
      } catch (caught) {
        if (!cancelled) {
          setError(errorMessage(caught));
          setStatus('error');
        }
      }
    })();
    return () => { cancelled = true; window.clearTimeout(timerRef.current); };
  }, [applyDocument, refreshList]);

  const queueSave = useCallback((snapshot = latestContentRef.current) => {
    const documentId = activeIdRef.current;
    if (!documentId || blockedRef.current) return saveQueueRef.current;
    const hash = serializeDiagramContent(snapshot);
    if (hash === lastSavedHashRef.current) return saveQueueRef.current;

    setStatus('saving');
    const operation = saveQueueRef.current.then(async () => {
      if (documentId !== activeIdRef.current) return;
      const saved = await storage.saveDocument(documentId, snapshot, revisionRef.current);
      revisionRef.current = saved.revision;
      lastSavedHashRef.current = hash;
      setActiveDocument(saved);
      setStatus('saved');
      setError(null);
      await refreshList();
    }).catch((caught) => {
      blockedRef.current = true;
      setError(errorMessage(caught));
      setStatus('error');
    });
    saveQueueRef.current = operation;
    return operation;
  }, [refreshList]);

  useEffect(() => {
    if (!hydratedRef.current || blockedRef.current || !activeIdRef.current || contentHash === lastSavedHashRef.current) return;
    setStatus('unsaved');
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { void queueSave(content); }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timerRef.current);
  }, [contentHash, queueSave]);

  const flush = useCallback(async () => {
    window.clearTimeout(timerRef.current);
    if (!blockedRef.current) await queueSave(latestContentRef.current);
    await saveQueueRef.current;
  }, [queueSave]);

  useEffect(() => {
    const saveBeforeLeaving = () => { void flush(); };
    window.addEventListener('pagehide', saveBeforeLeaving);
    return () => window.removeEventListener('pagehide', saveBeforeLeaving);
  }, [flush]);

  const selectDocument = useCallback(async (id: string) => {
    if (id === activeIdRef.current) return;
    await flush();
    if (blockedRef.current) return;
    const document = await storage.getDocument(id);
    if (!document) throw new Error('That document no longer exists.');
    await applyDocument(document);
    await refreshList();
  }, [applyDocument, flush, refreshList]);

  const newDocument = useCallback(async () => {
    await flush();
    if (blockedRef.current) return;
    const baseName = 'Untitled Diagram';
    const existingNames = new Set(documents.map((document) => document.name));
    let name = baseName;
    let suffix = 2;
    while (existingNames.has(name)) name = `${baseName} ${suffix++}`;
    const document = await storage.createDocument(name, EMPTY_DIAGRAM_CONTENT);
    await applyDocument(document);
    await refreshList();
  }, [applyDocument, documents, flush, refreshList]);

  const renameDocument = useCallback(async (id: string, name: string) => {
    if (!name.trim()) return;
    const renamed = await storage.renameDocument(id, name);
    if (id === activeIdRef.current) setActiveDocument(renamed);
    await refreshList();
  }, [refreshList]);

  const removeActive = useCallback(async () => {
    const id = activeIdRef.current;
    if (!id) return;
    window.clearTimeout(timerRef.current);
    await saveQueueRef.current;
    await storage.deleteDocument(id);
    const remaining = await storage.listDocuments();
    const replacement = remaining[0] ? await storage.getDocument(remaining[0].id) : await storage.createDocument('Untitled Diagram', EMPTY_DIAGRAM_CONTENT);
    if (!replacement) throw new Error('Could not create a replacement document.');
    await applyDocument(replacement);
    await refreshList();
  }, [applyDocument, refreshList]);

  const removeDocuments = useCallback(async (ids: string[]) => {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return;
    window.clearTimeout(timerRef.current);
    if (activeIdRef.current && !uniqueIds.includes(activeIdRef.current)) await flush();
    else await saveQueueRef.current;
    await storage.deleteDocuments(uniqueIds);
    const remaining = await storage.listDocuments();
    if (activeIdRef.current && uniqueIds.includes(activeIdRef.current)) {
      const replacement = remaining[0]
        ? await storage.getDocument(remaining[0].id)
        : await storage.createDocument('Untitled Diagram', EMPTY_DIAGRAM_CONTENT);
      if (!replacement) throw new Error('Could not create a replacement document.');
      await applyDocument(replacement);
    }
    await refreshList();
  }, [applyDocument, flush, refreshList]);

  const reorderDocumentList = useCallback(async (ids: string[]) => {
    await storage.reorderDocuments(ids);
    await refreshList();
  }, [refreshList]);

  const exportJson = useCallback(() => {
    if (!activeDocument) return '';
    const exported = {
      ...activeDocument,
      revision: revisionRef.current,
      content: latestContentRef.current,
    };
    return JSON.stringify(exported, null, 2);
  }, [activeDocument]);

  const importJson = useCallback(async (json: string) => {
    const parsed = parseDiagramDocument(JSON.parse(json) as unknown);
    await flush();
    if (blockedRef.current) return;
    const imported = await storage.importDocument(parsed);
    await applyDocument(imported);
    await refreshList();
  }, [applyDocument, flush, refreshList]);

  const retrySave = useCallback(() => {
    blockedRef.current = false;
    setError(null);
    return queueSave(latestContentRef.current);
  }, [queueSave]);

  const reloadActive = useCallback(async () => {
    const id = activeIdRef.current;
    if (!id) return;
    blockedRef.current = false;
    const stored = await storage.getDocument(id);
    if (!stored) throw new Error('The active document no longer exists.');
    await applyDocument(stored);
    await refreshList();
  }, [applyDocument, refreshList]);

  return {
    documents,
    activeDocument,
    status,
    error,
    selectDocument,
    newDocument,
    renameDocument,
    removeActive,
    removeDocuments,
    reorderDocumentList,
    exportJson,
    importJson,
    retrySave,
    reloadActive,
  };
}
