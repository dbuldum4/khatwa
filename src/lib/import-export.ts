import {
  db,
  getAllTasks,
  getAllDocuments,
  getSetting,
  type TaskRecord,
  type DocumentRecord,
} from './db';

// Export format version - increment when format changes
const EXPORT_VERSION = 1;

// Type for the exported data structure
export interface KhatwaExportData {
  version: number;
  exportedAt: string;
  tasks: TaskRecord[];
  documents: DocumentRecord[];
  settings: {
    columnById: Record<string, string>;
    viewMode: 'list' | 'columns' | 'documents';
  };
}

// Validation result type
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Export all app data as a pretty-printed JSON string
 */
export async function exportAllData(): Promise<string> {
  const [tasks, documents, columnById, viewMode] = await Promise.all([
    getAllTasks(),
    getAllDocuments(),
    getSetting<Record<string, string>>('columnById'),
    getSetting<'list' | 'columns' | 'documents'>('viewMode'),
  ]);

  const exportData: KhatwaExportData = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tasks,
    documents,
    settings: {
      columnById: columnById ?? {},
      viewMode: viewMode ?? 'list',
    },
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Trigger a download of the exported data as a .txt file
 */
export function downloadExportFile(jsonString: string, filename?: string): void {
  const blob = new Blob([jsonString], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const defaultFilename = `khatwa-backup-${new Date().toISOString().split('T')[0]}.txt`;
  
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename ?? defaultFilename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  
  URL.revokeObjectURL(url);
}

/**
 * Read a file and return its contents as a string
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Validate imported data structure
 */
export function validateImportData(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data format: expected an object' };
  }

  const obj = data as Record<string, unknown>;

  // Check version
  if (typeof obj.version !== 'number') {
    return { valid: false, error: 'Missing or invalid version number' };
  }

  if (obj.version > EXPORT_VERSION) {
    return { 
      valid: false, 
      error: `Export version ${obj.version} is newer than supported version ${EXPORT_VERSION}. Please update the app.` 
    };
  }

  // Check tasks array
  if (!Array.isArray(obj.tasks)) {
    return { valid: false, error: 'Missing or invalid tasks array' };
  }

  for (const task of obj.tasks) {
    if (!task || typeof task !== 'object') {
      return { valid: false, error: 'Invalid task entry' };
    }
    const t = task as Record<string, unknown>;
    if (typeof t.id !== 'string' || typeof t.label !== 'string') {
      return { valid: false, error: 'Task missing required fields (id, label)' };
    }
    if (!Array.isArray(t.subTasks)) {
      return { valid: false, error: 'Task missing subTasks array' };
    }
  }

  // Check documents array
  if (!Array.isArray(obj.documents)) {
    return { valid: false, error: 'Missing or invalid documents array' };
  }

  for (const doc of obj.documents) {
    if (!doc || typeof doc !== 'object') {
      return { valid: false, error: 'Invalid document entry' };
    }
    const d = doc as Record<string, unknown>;
    if (typeof d.id !== 'string' || typeof d.taskId !== 'string' || typeof d.title !== 'string') {
      return { valid: false, error: 'Document missing required fields (id, taskId, title)' };
    }
  }

  // Check settings
  if (!obj.settings || typeof obj.settings !== 'object') {
    return { valid: false, error: 'Missing or invalid settings object' };
  }

  const settings = obj.settings as Record<string, unknown>;
  if (typeof settings.columnById !== 'object' || settings.columnById === null) {
    return { valid: false, error: 'Missing or invalid settings.columnById' };
  }

  const validViewModes = ['list', 'columns', 'documents'];
  if (!validViewModes.includes(settings.viewMode as string)) {
    return { valid: false, error: 'Invalid settings.viewMode' };
  }

  return { valid: true };
}

/**
 * Parse and validate a JSON string for import
 */
export function parseImportFile(content: string): { data: KhatwaExportData | null; error?: string } {
  let parsed: unknown;
  
  try {
    parsed = JSON.parse(content);
  } catch {
    return { data: null, error: 'Invalid JSON format. Please check the file contents.' };
  }

  const validation = validateImportData(parsed);
  if (!validation.valid) {
    return { data: null, error: validation.error };
  }

  return { data: parsed as KhatwaExportData };
}

/**
 * Import data into the database, replacing all existing data
 * Also cleans up any orphaned documents (documents referencing non-existent tasks)
 */
export async function importAllData(data: KhatwaExportData): Promise<void> {
  // Create a set of valid task IDs for quick lookup
  const validTaskIds = new Set(data.tasks.map(t => t.id));
  
  // Filter out orphaned documents (documents whose taskId doesn't match any task)
  const validDocuments = data.documents.filter(doc => validTaskIds.has(doc.taskId));
  
  await db.transaction('rw', [db.tasks, db.documents, db.settings], async () => {
    // Clear all existing data
    await db.tasks.clear();
    await db.documents.clear();
    await db.settings.clear();

    // Import tasks
    if (data.tasks.length > 0) {
      await db.tasks.bulkAdd(data.tasks);
    }

    // Import only valid documents (no orphans)
    if (validDocuments.length > 0) {
      await db.documents.bulkAdd(validDocuments);
    }

    // Import settings
    await db.settings.put({ key: 'columnById', value: data.settings.columnById });
    await db.settings.put({ key: 'viewMode', value: data.settings.viewMode });
  });
}

/**
 * Clean up orphaned documents in the database
 * (documents whose taskId doesn't match any existing task)
 */
export async function cleanupOrphanedDocuments(): Promise<number> {
  const [tasks, documents] = await Promise.all([
    db.tasks.toArray(),
    db.documents.toArray(),
  ]);

  const validTaskIds = new Set(tasks.map(t => t.id));
  const orphanedDocIds = documents
    .filter(doc => !validTaskIds.has(doc.taskId))
    .map(doc => doc.id);

  if (orphanedDocIds.length > 0) {
    await db.documents.bulkDelete(orphanedDocIds);
  }

  return orphanedDocIds.length;
}
