"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAllDocuments,
  saveDocument,
  deleteDocument as deleteDocumentFromDb,
  deleteDocumentsByTaskId as deleteDocumentsByTaskIdFromDb,
  isImportInProgress,
  type DocumentRecord,
} from "@/lib/db";

interface UseDocumentStoreReturn {
  // State
  documents: DocumentRecord[];
  isHydrated: boolean;

  // Actions
  addDocument: (taskId: string, title: string) => DocumentRecord;
  updateDocument: (id: string, updates: Partial<Pick<DocumentRecord, 'title' | 'content'>>) => void;
  deleteDocument: (id: string) => void;
  deleteDocumentsByTaskId: (taskId: string) => void;
  getDocumentsByTaskId: (taskId: string) => DocumentRecord[];
  flushPendingSaves: () => Promise<void>;
  reloadFromDb: () => Promise<void>;
}

const DEBOUNCE_MS = 300;

const createDocumentId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function useDocumentStore(): UseDocumentStoreReturn {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Refs for debouncing
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSavesRef = useRef<Map<string, DocumentRecord>>(new Map());

  // Track if initial load has completed
  const hasHydratedRef = useRef(false);

  // Load documents from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const docs = await getAllDocuments();
        if (cancelled) return;

        setDocuments(docs);
        hasHydratedRef.current = true;
        setIsHydrated(true);
      } catch (error) {
        console.error("Failed to load documents from IndexedDB:", error);
        hasHydratedRef.current = true;
        setIsHydrated(true);
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced save function
  const scheduleSave = useCallback((document: DocumentRecord) => {
    pendingSavesRef.current.set(document.id, document);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      // Don't save if an import is in progress
      if (isImportInProgress()) {
        pendingSavesRef.current.clear();
        return;
      }
      
      const saves = Array.from(pendingSavesRef.current.values());
      pendingSavesRef.current.clear();

      for (const doc of saves) {
        try {
          await saveDocument(doc);
        } catch (error) {
          console.error("Failed to save document:", error);
        }
      }
    }, DEBOUNCE_MS);
  }, []);

  const addDocument = useCallback((taskId: string, title: string): DocumentRecord => {
    const now = Date.now();
    const newDoc: DocumentRecord = {
      id: createDocumentId(),
      taskId,
      title: title || "Untitled",
      content: { type: "doc", content: [{ type: "paragraph" }] },
      createdAt: now,
      updatedAt: now,
    };

    setDocuments((prev) => [...prev, newDoc]);
    scheduleSave(newDoc);

    return newDoc;
  }, [scheduleSave]);

  const updateDocument = useCallback((id: string, updates: Partial<Pick<DocumentRecord, 'title' | 'content'>>) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id !== id) return doc;
        const updated = {
          ...doc,
          ...updates,
          updatedAt: Date.now(),
        };
        scheduleSave(updated);
        return updated;
      })
    );
  }, [scheduleSave]);

  const deleteDocument = useCallback((id: string) => {
    // Cancel any pending save for this document to prevent race condition
    pendingSavesRef.current.delete(id);
    
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    deleteDocumentFromDb(id).catch((error) => {
      console.error("Failed to delete document:", error);
    });
  }, []);

  const deleteDocumentsByTaskId = useCallback((taskId: string) => {
    // Get all document IDs for this task and cancel their pending saves
    setDocuments((prev) => {
      const docsToDelete = prev.filter((doc) => doc.taskId === taskId);
      for (const doc of docsToDelete) {
        pendingSavesRef.current.delete(doc.id);
      }
      return prev.filter((doc) => doc.taskId !== taskId);
    });
    
    deleteDocumentsByTaskIdFromDb(taskId).catch((error) => {
      console.error("Failed to delete documents for task:", error);
    });
  }, []);

  const getDocumentsByTaskId = useCallback((taskId: string): DocumentRecord[] => {
    return documents.filter((doc) => doc.taskId === taskId);
  }, [documents]);

  // Flush all pending saves immediately - useful before import/export
  const flushPendingSaves = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const saves = Array.from(pendingSavesRef.current.values());
    pendingSavesRef.current.clear();

    for (const doc of saves) {
      try {
        await saveDocument(doc);
      } catch (error) {
        console.error("Failed to save document:", error);
      }
    }
  }, []);

  // Reload documents from the database - useful after import
  const reloadFromDb = useCallback(async () => {
    // Clear any pending saves since we're reloading
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    pendingSavesRef.current.clear();

    try {
      const docs = await getAllDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error("Failed to reload documents from IndexedDB:", error);
    }
  }, []);

  return {
    documents,
    isHydrated,
    addDocument,
    updateDocument,
    deleteDocument,
    deleteDocumentsByTaskId,
    getDocumentsByTaskId,
    flushPendingSaves,
    reloadFromDb,
  };
}
