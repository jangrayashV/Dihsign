import Dexie, { type EntityTable } from 'dexie';
import {
  DOCUMENT_SCHEMA_VERSION,
  type DiagramContent,
  type DiagramDocument,
  type DocumentSummary,
} from './diagramDocument';

type Preference = { key: string; value: string };

const database = new Dexie('cs-diagram-workspace') as Dexie & {
  documents: EntityTable<DiagramDocument, 'id'>;
  preferences: EntityTable<Preference, 'key'>;
};

database.version(1).stores({
  documents: 'id, name, updatedAt',
  preferences: 'key',
});

export class DocumentConflictError extends Error {
  constructor() {
    super('This document changed in another tab. Your newer local work was not overwritten.');
    this.name = 'DocumentConflictError';
  }
}

export class DuplicateDocumentNameError extends Error {
  constructor(name: string) {
    super(`A document named “${name}” already exists. Choose a unique name.`);
    this.name = 'DuplicateDocumentNameError';
  }
}

async function assertUniqueDocumentName(name: string, excludingId?: string) {
  const normalized = name.trim().toLocaleLowerCase();
  const duplicate = (await database.documents.toArray()).some((document) => (
    document.id !== excludingId && document.name.trim().toLocaleLowerCase() === normalized
  ));
  if (duplicate) throw new DuplicateDocumentNameError(name.trim());
}

function summary(document: DiagramDocument): DocumentSummary {
  const { id, name, createdAt, updatedAt, revision } = document;
  return { id, name, createdAt, updatedAt, revision };
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const documents = await database.documents.orderBy('updatedAt').reverse().toArray();
  const storedOrder = (await database.preferences.get('documentOrder'))?.value;
  let orderedIds: string[] = [];
  try { orderedIds = storedOrder ? JSON.parse(storedOrder) as string[] : []; } catch { orderedIds = []; }
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  return documents
    .map(summary)
    .sort((left, right) => (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER));
}

export async function reorderDocuments(ids: string[]) {
  await database.preferences.put({ key: 'documentOrder', value: JSON.stringify(ids) });
}

export async function getDocument(id: string): Promise<DiagramDocument | undefined> {
  return database.documents.get(id);
}

export async function createDocument(name: string, content: DiagramContent): Promise<DiagramDocument> {
  return database.transaction('rw', database.documents, async () => {
    const documentName = name.trim() || 'Untitled Diagram';
    await assertUniqueDocumentName(documentName);
    const now = new Date().toISOString();
    const document: DiagramDocument = {
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      name: documentName,
      createdAt: now,
      updatedAt: now,
      revision: 0,
      content,
    };
    await database.documents.add(document);
    return document;
  });
}

export async function importDocument(source: DiagramDocument): Promise<DiagramDocument> {
  return createDocument(source.name, source.content);
}

export async function saveDocument(
  id: string,
  content: DiagramContent,
  expectedRevision: number,
): Promise<DiagramDocument> {
  return database.transaction('rw', database.documents, async () => {
    const current = await database.documents.get(id);
    if (!current) throw new Error('The active document no longer exists.');
    if (current.revision !== expectedRevision) throw new DocumentConflictError();
    const next: DiagramDocument = {
      ...current,
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      content,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    await database.documents.put(next);
    return next;
  });
}

export async function renameDocument(id: string, name: string): Promise<DiagramDocument> {
  return database.transaction('rw', database.documents, async () => {
    const current = await database.documents.get(id);
    if (!current) throw new Error('The active document no longer exists.');
    const nextName = name.trim() || current.name;
    await assertUniqueDocumentName(nextName, id);
    const next = { ...current, name: nextName, updatedAt: new Date().toISOString() };
    await database.documents.put(next);
    return next;
  });
}

export async function deleteDocument(id: string) {
  await database.documents.delete(id);
}

export async function deleteDocuments(ids: string[]) {
  await database.documents.bulkDelete(ids);
}

export async function getActiveDocumentId() {
  return (await database.preferences.get('activeDocumentId'))?.value;
}

export async function setActiveDocumentId(id: string) {
  await database.preferences.put({ key: 'activeDocumentId', value: id });
}

export async function ensureDocument(content: DiagramContent): Promise<DiagramDocument> {
  return database.transaction('rw', database.documents, database.preferences, async () => {
    const preferredId = (await database.preferences.get('activeDocumentId'))?.value;
    const preferred = preferredId ? await database.documents.get(preferredId) : undefined;
    if (preferred) return preferred;
    const existing = await database.documents.orderBy('updatedAt').last();
    if (existing) {
      await database.preferences.put({ key: 'activeDocumentId', value: existing.id });
      return existing;
    }
    const now = new Date().toISOString();
    const document: DiagramDocument = {
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      name: 'Untitled Diagram',
      createdAt: now,
      updatedAt: now,
      revision: 0,
      content,
    };
    await database.documents.add(document);
    await database.preferences.put({ key: 'activeDocumentId', value: document.id });
    return document;
  });
}
