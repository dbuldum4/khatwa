"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, CheckCircle2, X, Plus, Link2, ExternalLink, Pencil, Loader2, FileText, List, Columns3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTaskStore } from "@/hooks/use-task-store";
import { useDocumentStore } from "@/hooks/use-document-store";
import { DocumentsView } from "@/components/documents-view";
import { DocumentEditorModal } from "@/components/document-editor-modal";
import type { DocumentRecord } from "@/lib/db";

const COLUMNS = [
  { id: "column-1", label: "Not started" },
  { id: "column-2", label: "In progress" },
  { id: "column-3", label: "Completed" },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];

type SubTask = {
  id: string;
  label: string;
  completed: boolean;
};

type Item = {
  id: string;
  label: string;
  link?: string;
  subTasks: SubTask[];
};

const DEFAULT_COLUMN: ColumnId = "column-1";

const createItemId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sortSubTasks = (subTasks: SubTask[]) =>
  [...subTasks].sort((a, b) => Number(a.completed) - Number(b.completed));

const EMPTY_SUBTASKS: SubTask[] = [];
const EMPTY_DOCUMENTS: DocumentRecord[] = [];

interface ListItemRowProps {
  item: Item;
  onOpen: (item: Item) => void;
  onRemove: (id: string) => void;
}

const ListItemRow = memo(function ListItemRow({
  item,
  onOpen,
  onRemove,
}: ListItemRowProps) {
  const sortedSubTasks = useMemo(() => sortSubTasks(item.subTasks), [item.subTasks]);
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen(item);
      }
    },
    [item, onOpen],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={handleKeyDown}
      className="group flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 text-base shadow-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-foreground">{item.label}</span>
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
              aria-label="Open link"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        {item.subTasks.length > 0 && (
          <div className="flex flex-col gap-1">
            {sortedSubTasks.map((subTask) => (
              <div key={subTask.id} className="flex items-center gap-1.5">
                {subTask.completed ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-primary/70" />
                ) : (
                  <Circle className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                )}
                <span
                  className={`text-sm ${
                    subTask.completed
                      ? "text-muted-foreground/50 line-through"
                      : "text-muted-foreground/70"
                  }`}
                >
                  {subTask.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(item.id);
        }}
        className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
        aria-label={`Remove ${item.label}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
});

interface ListViewProps {
  items: Item[];
  onOpenItem: (item: Item) => void;
  onRemoveItem: (id: string) => void;
}

const ListView = memo(function ListView({
  items,
  onOpenItem,
  onRemoveItem,
}: ListViewProps) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <ListItemRow
          key={item.id}
          item={item}
          onOpen={onOpenItem}
          onRemove={onRemoveItem}
        />
      ))}
    </div>
  );
});

interface ColumnItemCardProps {
  item: Item;
  onOpen: (item: Item) => void;
  onRemove: (id: string) => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, itemId: string) => void;
  onDragEnd: () => void;
}

const ColumnItemCard = memo(function ColumnItemCard({
  item,
  onOpen,
  onRemove,
  onDragStart,
  onDragEnd,
}: ColumnItemCardProps) {
  const sortedSubTasks = useMemo(() => sortSubTasks(item.subTasks), [item.subTasks]);
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen(item);
      }
    },
    [item, onOpen],
  );
  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      onDragStart(event, item.id);
    },
    [item.id, onDragStart],
  );

  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(item)}
      onKeyDown={handleKeyDown}
      className="group flex cursor-grab items-start justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-base shadow-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground">{item.label}</span>
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
              aria-label="Open link"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {item.subTasks.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {sortedSubTasks.map((subTask) => (
              <div key={subTask.id} className="flex items-center gap-1">
                {subTask.completed ? (
                  <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-primary/70" />
                ) : (
                  <Circle className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50" />
                )}
                <span
                  className={`text-xs leading-tight ${
                    subTask.completed
                      ? "text-muted-foreground/50 line-through"
                      : "text-muted-foreground/70"
                  }`}
                >
                  {subTask.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(item.id);
        }}
        className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
        aria-label={`Remove ${item.label}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
});

interface ColumnsViewProps {
  itemsByColumn: Record<ColumnId, Item[]>;
  onOpenItem: (item: Item) => void;
  onRemoveItem: (id: string) => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, itemId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>, columnId: ColumnId) => void;
}

const ColumnsView = memo(function ColumnsView({
  itemsByColumn,
  onOpenItem,
  onRemoveItem,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: ColumnsViewProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Drag tasks between columns. The list view order stays the same.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((column) => {
          const columnItems = itemsByColumn[column.id];

          return (
            <div
              key={column.id}
              onDragOver={onDragOver}
              onDrop={(event) => onDrop(event, column.id)}
              className="flex min-h-[200px] flex-col gap-3 rounded-lg border border-dashed border-border/70 bg-muted/20 p-3"
            >
              <div className="text-base font-medium text-foreground">
                {column.label}
              </div>
              {columnItems.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/60 bg-background/50 px-3 py-6 text-sm text-muted-foreground">
                  Drop items here
                </div>
              ) : (
                <div className="space-y-2">
                  {columnItems.map((item) => (
                    <ColumnItemCard
                      key={item.id}
                      item={item}
                      onOpen={onOpenItem}
                      onRemove={onRemoveItem}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export function ItemList() {
  const {
    items,
    setItems,
    columnById,
    setColumnById,
    viewMode,
    setViewMode,
    isHydrated,
  } = useTaskStore();

  const {
    documents,
    isHydrated: isDocumentsHydrated,
    addDocument,
    updateDocument,
    deleteDocument,
    deleteDocumentsByTaskId,
  } = useDocumentStore();
  
  const [inputValue, setInputValue] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [subTaskInput, setSubTaskInput] = useState("");
  const [editingLink, setEditingLink] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingDocumentFromTask, setEditingDocumentFromTask] = useState<DocumentRecord | null>(null);
  const draggingItemRef = useRef<string | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setEditingItemId(null);
      setEditingLabel("");
      setEditingLink("");
      setSubTaskInput("");
      setIsEditMode(false);
      closeTimeoutRef.current = null;
    }, 180);
  }, []);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!editingItemId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (isEditMode) {
          setIsEditMode(false);
          // Reset to original values
          const item = items.find((i) => i.id === editingItemId);
          if (item) {
            setEditingLabel(item.label);
            setEditingLink(item.link ?? "");
          }
        } else {
          closeEditor();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingItemId, isEditMode, items, closeEditor]);

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingItemId),
    [items, editingItemId],
  );
  const currentSubTasks = editingItem?.subTasks ?? EMPTY_SUBTASKS;
  const sortedCurrentSubTasks = useMemo(
    () => sortSubTasks(currentSubTasks),
    [currentSubTasks],
  );
  const editingItemDocuments = useMemo(() => {
    if (!editingItemId) return EMPTY_DOCUMENTS;
    return documents.filter((doc) => doc.taskId === editingItemId);
  }, [documents, editingItemId]);

  const addItem = useCallback(() => {
    const nextValue = inputValue.trim();
    if (!nextValue) return;

    const id = createItemId();
    setItems((prevItems) => [...prevItems, { id, label: nextValue, subTasks: [] }]);
    setColumnById((prevColumns) => ({ ...prevColumns, [id]: DEFAULT_COLUMN }));
    setInputValue("");
  }, [inputValue, setColumnById, setItems]);

  const removeItem = useCallback((idToRemove: string) => {
    // Delete all documents associated with this task
    deleteDocumentsByTaskId(idToRemove);
    
    setItems((prevItems) =>
      prevItems.filter((item) => item.id !== idToRemove)
    );
    setColumnById((prevColumns) => {
      const next = { ...prevColumns };
      delete next[idToRemove];
      return next;
    });
  }, [deleteDocumentsByTaskId, setColumnById, setItems]);

  const handleDragStart = useCallback((
    event: React.DragEvent<HTMLDivElement>,
    itemId: string
  ) => {
    draggingItemRef.current = itemId;
    event.dataTransfer.setData("text/plain", itemId);
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragEnd = useCallback(() => {
    draggingItemRef.current = null;
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((
    event: React.DragEvent<HTMLDivElement>,
    columnId: ColumnId
  ) => {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/plain");
    if (!itemId) return;

    draggingItemRef.current = null;
    setColumnById((prevColumns) => {
      if (prevColumns[itemId] === columnId) {
        return prevColumns;
      }
      return { ...prevColumns, [itemId]: columnId };
    });
  }, [setColumnById]);

  const openEditor = useCallback((item: Item) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setEditingItemId(item.id);
    setEditingLabel(item.label);
    setEditingLink(item.link ?? "");
    setIsEditorOpen(false);
    requestAnimationFrame(() => setIsEditorOpen(true));
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingItemId) return;
    const nextLabel = editingLabel.trim();
    if (!nextLabel) return;

    const nextLink = editingLink.trim() || undefined;
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === editingItemId ? { ...item, label: nextLabel, link: nextLink } : item
      )
    );
    setIsEditMode(false);
  }, [editingItemId, editingLabel, editingLink, setItems]);

  const cancelEditMode = useCallback(() => {
    // Reset to original values and exit edit mode
    if (editingItem) {
      setEditingLabel(editingItem.label);
      setEditingLink(editingItem.link ?? "");
    }
    setIsEditMode(false);
  }, [editingItem]);

  const addSubTask = useCallback(() => {
    const nextValue = subTaskInput.trim();
    if (!nextValue || !editingItemId) return;

    const subTaskId = createItemId();
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === editingItemId
          ? {
              ...item,
              subTasks: [
                ...item.subTasks,
                { id: subTaskId, label: nextValue, completed: false },
              ],
            }
          : item
      )
    );
    setSubTaskInput("");
  }, [editingItemId, setItems, subTaskInput]);

  const toggleSubTask = useCallback((subTaskId: string) => {
    if (!editingItemId) return;

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== editingItemId) return item;

        const updatedSubTasks = item.subTasks.map((st) =>
          st.id === subTaskId ? { ...st, completed: !st.completed } : st
        );

        // Check if any subtask is now completed
        const hasCompletedSubTask = updatedSubTasks.some((st) => st.completed);

        // If any subtask is completed and task is in "Not started", move to "In progress"
        if (hasCompletedSubTask) {
          const currentColumn = columnById[item.id] ?? DEFAULT_COLUMN;
          if (currentColumn === "column-1") {
            setColumnById((prev) => ({ ...prev, [item.id]: "column-2" }));
          }
        }

        return { ...item, subTasks: updatedSubTasks };
      })
    );
  }, [columnById, editingItemId, setColumnById, setItems]);

  const removeSubTask = useCallback((subTaskId: string) => {
    if (!editingItemId) return;

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === editingItemId
          ? {
              ...item,
              subTasks: item.subTasks.filter((st) => st.id !== subTaskId),
            }
          : item
      )
    );
  }, [editingItemId, setItems]);

  const handleOpenItem = useCallback((item: Item) => {
    if (draggingItemRef.current) return;
    openEditor(item);
  }, [openEditor]);

  const trimmedEditingLabel = editingLabel.trim();
  const isSaveDisabled = trimmedEditingLabel.length === 0;
  const itemsByColumn = useMemo(() => {
    const map: Record<ColumnId, Item[]> = {
      "column-1": [],
      "column-2": [],
      "column-3": [],
    };

    for (const item of items) {
      const column = columnById[item.id] ?? DEFAULT_COLUMN;
      map[column].push(item);
    }

    return map;
  }, [columnById, items]);

  // Show loading state while hydrating from IndexedDB
  if (!isHydrated || !isDocumentsHydrated) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-base">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex w-full flex-col gap-6 md:flex-row">
        <aside className="flex w-full shrink-0 flex-col gap-3 rounded-lg border border-border/70 bg-muted/30 p-4 md:w-44">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            View
          </div>
          <div className="flex flex-row gap-2 md:flex-col">
            <Button
              type="button"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              onClick={() => setViewMode("list")}
              className="justify-start"
            >
              <List className="mr-1.5 h-4 w-4" />
              List
            </Button>
            <Button
              type="button"
              variant={viewMode === "columns" ? "secondary" : "ghost"}
              onClick={() => setViewMode("columns")}
              className="justify-start"
            >
              <Columns3 className="mr-1.5 h-4 w-4" />
              Columns
            </Button>
            <Button
              type="button"
              variant={viewMode === "documents" ? "secondary" : "ghost"}
              onClick={() => setViewMode("documents")}
              className="justify-start"
            >
              <FileText className="mr-1.5 h-4 w-4" />
              Documents
            </Button>
          </div>
        </aside>

        <div className="flex-1 space-y-4">
          {viewMode !== "documents" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addItem();
                  }
                }}
                placeholder="Add an item..."
                className="flex-1"
              />
              <Button onClick={addItem}>Add</Button>
            </div>
          )}

          {viewMode === "documents" ? (
            <DocumentsView
              documents={documents}
              tasks={items}
              onAddDocument={addDocument}
              onUpdateDocument={updateDocument}
              onDeleteDocument={deleteDocument}
            />
          ) : viewMode === "list" ? (
            <ListView
              items={items}
              onOpenItem={handleOpenItem}
              onRemoveItem={removeItem}
            />
          ) : (
            <ColumnsView
              itemsByColumn={itemsByColumn}
              onOpenItem={handleOpenItem}
              onRemoveItem={removeItem}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          )}
        </div>
      </div>

      {editingItemId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            onClick={closeEditor}
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              backdropFilter: isEditorOpen ? "blur(4px)" : "blur(0px)",
              opacity: isEditorOpen ? 1 : 0,
              transition: "opacity 180ms ease-out, backdrop-filter 180ms ease-out",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              position: "relative",
              display: "flex",
              width: "min(100%, 48rem)",
              maxWidth: "90vw",
              maxHeight: "85vh",
              flexDirection: "column",
              borderRadius: "1.5rem",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              backgroundColor: "var(--card)",
              padding: "2.5rem",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              opacity: isEditorOpen ? 1 : 0,
              transform: isEditorOpen ? "scale(1) translateY(0)" : "scale(0.98) translateY(4px)",
              transition: "opacity 180ms ease-out, transform 180ms ease-out",
              overflowY: "auto",
            }}
          >
            {isEditMode ? (
              /* Edit Mode */
              <>
                <div className="space-y-1">
                  <h2
                    id="task-title"
                    className="text-lg font-semibold text-foreground"
                  >
                    Edit task
                  </h2>
                  <p className="text-base text-muted-foreground">
                    Update the task details below.
                  </p>
                </div>
                <div className="mt-6 flex flex-1 flex-col gap-6">
                  <div className="space-y-2">
                    <label
                      htmlFor="edit-task-name"
                      className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Task name
                    </label>
                    <Input
                      id="edit-task-name"
                      value={editingLabel}
                      onChange={(event) => setEditingLabel(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          if (!isSaveDisabled) {
                            saveEdit();
                          }
                        }
                      }}
                      onFocus={(event) => event.currentTarget.select()}
                      autoFocus
                    />
                  </div>

                  {/* Link section */}
                  <div className="space-y-2">
                    <label
                      htmlFor="edit-task-link"
                      className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Link
                    </label>
                    <div className="relative flex items-center">
                      <Link2 className="absolute left-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="edit-task-link"
                        value={editingLink}
                        onChange={(event) => setEditingLink(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            if (!isSaveDisabled) {
                              saveEdit();
                            }
                          }
                        }}
                        placeholder="https://example.com"
                        className="pl-9 pr-9"
                      />
                      {editingLink && (
                        <button
                          type="button"
                          onClick={() => setEditingLink("")}
                          className="absolute right-3 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label="Clear link"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sub-tasks section */}
                  <div className="flex-1 space-y-3">
                    <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Sub-tasks
                    </label>

                    {/* Sub-task list */}
                    {currentSubTasks.length > 0 && (
                      <div className="space-y-2">
                        {sortedCurrentSubTasks.map((subTask) => (
                          <div
                            key={subTask.id}
                            className="group flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5"
                          >
                            <button
                              type="button"
                              onClick={() => toggleSubTask(subTask.id)}
                              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                              aria-label={subTask.completed ? "Mark as incomplete" : "Mark as complete"}
                            >
                              {subTask.completed ? (
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              ) : (
                                <Circle className="h-5 w-5" />
                              )}
                            </button>
                            <span
                              className={`flex-1 text-base transition-all duration-150 ${
                                subTask.completed
                                  ? "text-muted-foreground line-through"
                                  : "text-foreground"
                              }`}
                            >
                              {subTask.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeSubTask(subTask.id)}
                              className="shrink-0 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
                              aria-label={`Remove ${subTask.label}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add sub-task input */}
                    <div className="flex gap-2">
                      <Input
                        value={subTaskInput}
                        onChange={(event) => setSubTaskInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            if (subTaskInput.trim()) {
                              addSubTask();
                            } else if (!isSaveDisabled) {
                              saveEdit();
                            }
                          }
                        }}
                        placeholder="Add a sub-task..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={addSubTask}
                        disabled={!subTaskInput.trim()}
                        aria-label="Add sub-task"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" onClick={cancelEditMode}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={saveEdit}
                      disabled={isSaveDisabled}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              /* View Mode */
              <>
                <div className="flex items-start justify-between gap-4">
                  <h2
                    id="task-title"
                    className="text-2xl font-semibold text-foreground"
                  >
                    {editingItem?.label}
                  </h2>
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-6 flex flex-1 flex-col gap-6">
                  {/* Link section */}
                  <div className="space-y-2">
                    <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Link
                    </span>
                    {editingItem?.link ? (
                      <a
                        href={editingItem.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-base text-primary hover:underline"
                      >
                        <Link2 className="h-4 w-4 shrink-0" />
                        <span className="truncate">{editingItem.link}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    ) : (
                      <p className="text-base text-muted-foreground">
                        No link yet.
                      </p>
                    )}
                  </div>

                  {/* Sub-tasks section */}
                  <div className="space-y-3">
                    <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Sub-tasks
                    </span>

                    {currentSubTasks.length > 0 ? (
                      <div className="space-y-2">
                        {sortedCurrentSubTasks.map((subTask) => (
                          <div
                            key={subTask.id}
                            className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5"
                          >
                            <button
                              type="button"
                              onClick={() => toggleSubTask(subTask.id)}
                              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                              aria-label={subTask.completed ? "Mark as incomplete" : "Mark as complete"}
                            >
                              {subTask.completed ? (
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              ) : (
                                <Circle className="h-5 w-5" />
                              )}
                            </button>
                            <span
                              className={`flex-1 text-base transition-all duration-150 ${
                                subTask.completed
                                  ? "text-muted-foreground line-through"
                                  : "text-foreground"
                              }`}
                            >
                              {subTask.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-base text-muted-foreground">
                        No sub-tasks yet.
                      </p>
                    )}
                  </div>

                  {/* Documents section */}
                  <div className="flex-1 space-y-3">
                    <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Documents
                    </span>

                    {editingItemDocuments.length > 0 ? (
                      <div className="space-y-2">
                        {editingItemDocuments.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => setEditingDocumentFromTask(doc)}
                            className="flex w-full items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                          >
                            <FileText className="h-5 w-5 shrink-0 text-primary/70" />
                            <span className="flex-1 text-base text-foreground truncate">
                              {doc.title}
                            </span>
                          </button>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-muted-foreground"
                          onClick={() => {
                            if (editingItemId) {
                              const newDoc = addDocument(editingItemId, "Untitled");
                              setEditingDocumentFromTask(newDoc);
                            }
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add document
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/50 bg-muted/10 px-4 py-6">
                        <FileText className="h-6 w-6 text-muted-foreground/50" />
                        <p className="text-base text-muted-foreground">
                          No documents yet.
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (editingItemId) {
                              const newDoc = addDocument(editingItemId, "Untitled");
                              setEditingDocumentFromTask(newDoc);
                            }
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create Document
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" onClick={closeEditor}>
                      Close
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setIsEditMode(true)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Document editor modal when editing from task modal */}
      {editingDocumentFromTask && editingItem && (
        <DocumentEditorModal
          doc={editingDocumentFromTask}
          taskName={editingItem.label}
          onSave={(updates) => {
            updateDocument(editingDocumentFromTask.id, updates);
            setEditingDocumentFromTask((prev) =>
              prev ? { ...prev, ...updates, updatedAt: Date.now() } : null
            );
          }}
          onDelete={() => {
            deleteDocument(editingDocumentFromTask.id);
            setEditingDocumentFromTask(null);
          }}
          onClose={() => setEditingDocumentFromTask(null)}
        />
      )}
    </>
  );
}
