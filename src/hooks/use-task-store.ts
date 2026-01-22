"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadPersistedData,
  saveTasks,
  setSetting,
  isImportInProgress,
  type TaskRecord,
} from "@/lib/db";

type ColumnId = "column-1" | "column-2" | "column-3";
type ViewMode = "list" | "columns" | "documents";

interface UseTaskStoreReturn {
  // State
  items: TaskRecord[];
  columnById: Record<string, ColumnId>;
  viewMode: ViewMode;
  isHydrated: boolean;

  // Setters
  setItems: React.Dispatch<React.SetStateAction<TaskRecord[]>>;
  setColumnById: React.Dispatch<React.SetStateAction<Record<string, ColumnId>>>;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;

  // Methods for sync
  flushPendingSaves: () => Promise<void>;
  reloadFromDb: () => Promise<void>;
}

const DEBOUNCE_MS = 300;

export function useTaskStore(): UseTaskStoreReturn {
  const [items, setItems] = useState<TaskRecord[]>([]);
  const [columnById, setColumnById] = useState<Record<string, ColumnId>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [isHydrated, setIsHydrated] = useState(false);

  // Refs for debouncing
  const itemsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const columnByIdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewModeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if initial load has completed to avoid saving during hydration
  const hasHydratedRef = useRef(false);

  // Load data from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const data = await loadPersistedData();
        if (cancelled) return;

        setItems(data.tasks);
        setColumnById(data.columnById as Record<string, ColumnId>);
        setViewMode(data.viewMode);
        hasHydratedRef.current = true;
        setIsHydrated(true);
      } catch (error) {
        console.error("Failed to load data from IndexedDB:", error);
        // Still mark as hydrated so the app can work in memory-only mode
        hasHydratedRef.current = true;
        setIsHydrated(true);
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist items when they change (debounced)
  useEffect(() => {
    if (!hasHydratedRef.current) return;

    if (itemsTimeoutRef.current) {
      clearTimeout(itemsTimeoutRef.current);
    }

    itemsTimeoutRef.current = setTimeout(() => {
      // Don't save if an import is in progress
      if (isImportInProgress()) return;
      
      saveTasks(items).catch((error) => {
        console.error("Failed to save tasks:", error);
      });
    }, DEBOUNCE_MS);

    return () => {
      if (itemsTimeoutRef.current) {
        clearTimeout(itemsTimeoutRef.current);
      }
    };
  }, [items]);

  // Persist columnById when it changes (debounced)
  useEffect(() => {
    if (!hasHydratedRef.current) return;

    if (columnByIdTimeoutRef.current) {
      clearTimeout(columnByIdTimeoutRef.current);
    }

    columnByIdTimeoutRef.current = setTimeout(() => {
      // Don't save if an import is in progress
      if (isImportInProgress()) return;
      
      setSetting("columnById", columnById).catch((error) => {
        console.error("Failed to save columnById:", error);
      });
    }, DEBOUNCE_MS);

    return () => {
      if (columnByIdTimeoutRef.current) {
        clearTimeout(columnByIdTimeoutRef.current);
      }
    };
  }, [columnById]);

  // Persist viewMode when it changes (debounced)
  useEffect(() => {
    if (!hasHydratedRef.current) return;

    if (viewModeTimeoutRef.current) {
      clearTimeout(viewModeTimeoutRef.current);
    }

    viewModeTimeoutRef.current = setTimeout(() => {
      // Don't save if an import is in progress
      if (isImportInProgress()) return;
      
      setSetting("viewMode", viewMode).catch((error) => {
        console.error("Failed to save viewMode:", error);
      });
    }, DEBOUNCE_MS);

    return () => {
      if (viewModeTimeoutRef.current) {
        clearTimeout(viewModeTimeoutRef.current);
      }
    };
  }, [viewMode]);

  // Flush all pending saves immediately - useful before import/export
  const flushPendingSaves = useCallback(async () => {
    // Clear all timeouts
    if (itemsTimeoutRef.current) {
      clearTimeout(itemsTimeoutRef.current);
      itemsTimeoutRef.current = null;
    }
    if (columnByIdTimeoutRef.current) {
      clearTimeout(columnByIdTimeoutRef.current);
      columnByIdTimeoutRef.current = null;
    }
    if (viewModeTimeoutRef.current) {
      clearTimeout(viewModeTimeoutRef.current);
      viewModeTimeoutRef.current = null;
    }

    // Save current state immediately
    await Promise.all([
      saveTasks(items),
      setSetting("columnById", columnById),
      setSetting("viewMode", viewMode),
    ]);
  }, [items, columnById, viewMode]);

  // Reload state from the database - useful after import
  const reloadFromDb = useCallback(async () => {
    // Clear all pending timeouts since we're reloading
    if (itemsTimeoutRef.current) {
      clearTimeout(itemsTimeoutRef.current);
      itemsTimeoutRef.current = null;
    }
    if (columnByIdTimeoutRef.current) {
      clearTimeout(columnByIdTimeoutRef.current);
      columnByIdTimeoutRef.current = null;
    }
    if (viewModeTimeoutRef.current) {
      clearTimeout(viewModeTimeoutRef.current);
      viewModeTimeoutRef.current = null;
    }

    try {
      const data = await loadPersistedData();
      // Temporarily disable hydration flag to prevent saving during reload
      hasHydratedRef.current = false;
      setItems(data.tasks);
      setColumnById(data.columnById as Record<string, ColumnId>);
      setViewMode(data.viewMode);
      // Re-enable after state is set
      requestAnimationFrame(() => {
        hasHydratedRef.current = true;
      });
    } catch (error) {
      console.error("Failed to reload data from IndexedDB:", error);
    }
  }, []);

  return {
    items,
    columnById,
    viewMode,
    isHydrated,
    setItems,
    setColumnById,
    setViewMode,
    flushPendingSaves,
    reloadFromDb,
  };
}
