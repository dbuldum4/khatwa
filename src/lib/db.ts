import Dexie, { type EntityTable } from 'dexie';

// Types matching the app's data structures
export interface SubTask {
  id: string;
  label: string;
  completed: boolean;
}

export interface TaskRecord {
  id: string;
  label: string;
  link?: string;
  subTasks: SubTask[];
}

export interface SettingsRecord {
  key: string;
  value: unknown;
}

// Tiptap JSON content type
export interface JSONContent {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  marks?: {
    type: string;
    attrs?: Record<string, unknown>;
  }[];
  text?: string;
}

export interface DocumentRecord {
  id: string;
  taskId: string;
  title: string;
  content: JSONContent;
  createdAt: number;
  updatedAt: number;
}

// Database class with typed tables
class KhatwaDatabase extends Dexie {
  tasks!: EntityTable<TaskRecord, 'id'>;
  settings!: EntityTable<SettingsRecord, 'key'>;
  documents!: EntityTable<DocumentRecord, 'id'>;

  constructor() {
    super('khatwa');
    
    this.version(1).stores({
      tasks: 'id',
      settings: 'key',
    });

    this.version(2).stores({
      tasks: 'id',
      settings: 'key',
      documents: 'id, taskId',
    });
  }
}

// Single database instance
export const db = new KhatwaDatabase();

// Flag to prevent saves during import
let importInProgress = false;

export function setImportInProgress(value: boolean): void {
  importInProgress = value;
}

export function isImportInProgress(): boolean {
  return importInProgress;
}

// Helper functions for tasks
export async function getAllTasks(): Promise<TaskRecord[]> {
  return db.tasks.toArray();
}

export async function saveTasks(tasks: TaskRecord[]): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    await db.tasks.clear();
    if (tasks.length > 0) {
      await db.tasks.bulkAdd(tasks);
    }
  });
}

// Helper functions for settings
export async function getSetting<T>(key: string): Promise<T | undefined> {
  const record = await db.settings.get(key);
  return record?.value as T | undefined;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}

// Load all persisted data at once
export async function loadPersistedData(): Promise<{
  tasks: TaskRecord[];
  columnById: Record<string, string>;
  viewMode: 'list' | 'columns' | 'documents';
}> {
  const [tasks, columnById, viewMode] = await Promise.all([
    getAllTasks(),
    getSetting<Record<string, string>>('columnById'),
    getSetting<'list' | 'columns' | 'documents'>('viewMode'),
  ]);

  return {
    tasks,
    columnById: columnById ?? {},
    viewMode: viewMode ?? 'list',
  };
}

// Save all data at once
export async function saveAllData(data: {
  tasks: TaskRecord[];
  columnById: Record<string, string>;
  viewMode: 'list' | 'columns' | 'documents';
}): Promise<void> {
  await Promise.all([
    saveTasks(data.tasks),
    setSetting('columnById', data.columnById),
    setSetting('viewMode', data.viewMode),
  ]);
}

// Helper functions for documents
export async function getAllDocuments(): Promise<DocumentRecord[]> {
  return db.documents.toArray();
}

export async function getDocumentsByTaskId(taskId: string): Promise<DocumentRecord[]> {
  return db.documents.where('taskId').equals(taskId).toArray();
}

export async function getDocument(id: string): Promise<DocumentRecord | undefined> {
  return db.documents.get(id);
}

export async function saveDocument(document: DocumentRecord): Promise<void> {
  await db.documents.put(document);
}

export async function deleteDocument(id: string): Promise<void> {
  await db.documents.delete(id);
}

export async function deleteDocumentsByTaskId(taskId: string): Promise<void> {
  await db.documents.where('taskId').equals(taskId).delete();
}
