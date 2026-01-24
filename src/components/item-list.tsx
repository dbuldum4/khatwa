"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, CheckCircle2, X, Plus, Link2, ExternalLink, Pencil, Loader2, FileText, List, Columns3, Calendar, ChevronLeft, ChevronRight } from "lucide-react";

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
  dueDate?: string;
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

const parseLocalDate = (value: string): Date | null => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatDueDate = (value: string): string => {
  const date = parseLocalDate(value);
  if (!date) return value;
  const now = new Date();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

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
        {item.dueDate && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Due {formatDueDate(item.dueDate)}</span>
          </div>
        )}
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
        {item.dueDate && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Due {formatDueDate(item.dueDate)}</span>
          </div>
        )}
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

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const getCalendarDays = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  // Add days from previous month to fill the first week
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthLastDay - i),
      isCurrentMonth: false,
    });
  }

  // Add days of current month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push({
      date: new Date(year, month, day),
      isCurrentMonth: true,
    });
  }

  // Add days from next month to complete the grid (6 rows)
  const remainingDays = 42 - days.length; // 6 rows * 7 days
  for (let day = 1; day <= remainingDays; day++) {
    days.push({
      date: new Date(year, month + 1, day),
      isCurrentMonth: false,
    });
  }

  return days;
};

const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

interface CalendarViewProps {
  items: Item[];
  onOpenItem: (item: Item) => void;
  onAssignDueDate: (itemId: string, dueDate: string) => void;
}

const CalendarView = memo(function CalendarView({
  items,
  onOpenItem,
  onAssignDueDate,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const today = useMemo(() => new Date(), []);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const item of items) {
      if (item.dueDate) {
        if (!map[item.dueDate]) {
          map[item.dueDate] = [];
        }
        map[item.dueDate].push(item);
      }
    }
    return map;
  }, [items]);

  const tasksWithoutDueDate = useMemo(
    () => items.filter((item) => !item.dueDate),
    [items]
  );

  const goToPreviousMonth = useCallback(() => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const monthYearLabel = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const handleTaskDragStart = useCallback(
    (event: React.DragEvent<HTMLButtonElement>, itemId: string) => {
      setDraggingTaskId(itemId);
      event.dataTransfer.setData("text/plain", itemId);
      event.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleTaskDragEnd = useCallback(() => {
    setDraggingTaskId(null);
    setDragOverDate(null);
  }, []);

  const handleDayDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>, dateKey: string) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (!draggingTaskId) return;
      if (dragOverDate !== dateKey) {
        setDragOverDate(dateKey);
      }
    },
    [dragOverDate, draggingTaskId],
  );

  const handleDayDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>, dateKey: string) => {
      const nextTarget = event.relatedTarget as Node | null;
      if (nextTarget && event.currentTarget.contains(nextTarget)) {
        return;
      }
      if (dragOverDate === dateKey) {
        setDragOverDate(null);
      }
    },
    [dragOverDate],
  );

  const handleDayDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>, dateKey: string) => {
      event.preventDefault();
      const itemId = event.dataTransfer.getData("text/plain");
      if (!itemId) return;
      const item = items.find((candidate) => candidate.id === itemId);
      if (!item || item.dueDate) {
        setDragOverDate(null);
        setDraggingTaskId(null);
        return;
      }
      onAssignDueDate(itemId, dateKey);
      setDragOverDate(null);
      setDraggingTaskId(null);
    },
    [items, onAssignDueDate],
  );

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{monthYearLabel}</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goToToday}
            className="text-sm"
          >
            Today
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={goToPreviousMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={goToNextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border border-border/70 bg-card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border/50">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-sm font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((dayInfo, index) => {
            const dateKey = formatDateKey(dayInfo.date);
            const dayItems = itemsByDate[dateKey] || [];
            const isToday = isSameDay(dayInfo.date, today);
            const dayNumber = dayInfo.date.getDate();
            const isDropTarget = dragOverDate === dateKey;
            const dayBackground = isDropTarget
              ? "bg-primary/5 ring-2 ring-primary/40"
              : !dayInfo.isCurrentMonth
              ? "bg-muted/10"
              : "bg-card";

            return (
              <div
                key={index}
                onDragOver={(event) => handleDayDragOver(event, dateKey)}
                onDragLeave={(event) => handleDayDragLeave(event, dateKey)}
                onDrop={(event) => handleDayDrop(event, dateKey)}
                className={`min-h-[100px] border-b border-r border-border/30 p-1.5 transition-colors ${dayBackground} ${
                  index % 7 === 6 ? "border-r-0" : ""
                } ${index >= 35 ? "border-b-0" : ""}`}
              >
                <div
                  className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                    isToday
                      ? "bg-primary text-primary-foreground font-semibold"
                      : dayInfo.isCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground/50"
                  }`}
                >
                  {dayNumber}
                </div>
                <div className="space-y-1 max-h-[72px] overflow-y-auto">
                  {dayItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenItem(item)}
                      className="w-full truncate rounded px-1.5 py-0.5 text-left text-xs bg-primary/10 text-foreground hover:bg-primary/20 transition-colors"
                      title={item.label}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tasks without due date */}
      {tasksWithoutDueDate.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {tasksWithoutDueDate.length} task{tasksWithoutDueDate.length !== 1 ? "s" : ""} without a due date
          </p>
          <div className="flex flex-wrap gap-2">
            {tasksWithoutDueDate.map((item) => (
              <button
                key={item.id}
                type="button"
                draggable
                onClick={() => onOpenItem(item)}
                onDragStart={(event) => handleTaskDragStart(event, item.id)}
                onDragEnd={handleTaskDragEnd}
                className="truncate rounded-lg border border-border/50 bg-muted/20 px-3 py-1.5 text-sm text-foreground hover:bg-muted/40 transition-colors max-w-[200px] cursor-grab active:cursor-grabbing"
                title={item.label}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
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
  const [editingDueDate, setEditingDueDate] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingDocumentFromTask, setEditingDocumentFromTask] = useState<DocumentRecord | null>(null);
  const draggingItemRef = useRef<string | null>(null);
  const draggingSubTaskRef = useRef<string | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draggingSubTaskId, setDraggingSubTaskId] = useState<string | null>(null);
  const [subTaskDropTargetId, setSubTaskDropTargetId] = useState<string | null>(null);
  const [subTaskDropPosition, setSubTaskDropPosition] = useState<"above" | "below" | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    draggingSubTaskRef.current = null;
    setDraggingSubTaskId(null);
    setSubTaskDropTargetId(null);
    setSubTaskDropPosition(null);
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setEditingItemId(null);
      setEditingLabel("");
      setEditingLink("");
      setEditingDueDate("");
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
            setEditingDueDate(item.dueDate ?? "");
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

  const handleAssignDueDate = useCallback(
    (itemId: string, dueDate: string) => {
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, dueDate } : item
        )
      );
    },
    [setItems],
  );

  const openEditor = useCallback((item: Item) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setEditingItemId(item.id);
    setEditingLabel(item.label);
    setEditingLink(item.link ?? "");
    setEditingDueDate(item.dueDate ?? "");
    setIsEditorOpen(false);
    requestAnimationFrame(() => setIsEditorOpen(true));
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingItemId) return;
    const nextLabel = editingLabel.trim();
    if (!nextLabel) return;

    const nextLink = editingLink.trim() || undefined;
    const nextDueDate = editingDueDate.trim() || undefined;
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === editingItemId
          ? { ...item, label: nextLabel, link: nextLink, dueDate: nextDueDate }
          : item
      )
    );
    setIsEditMode(false);
  }, [editingItemId, editingLabel, editingLink, editingDueDate, setItems]);

  const cancelEditMode = useCallback(() => {
    // Reset to original values and exit edit mode
    if (editingItem) {
      setEditingLabel(editingItem.label);
      setEditingLink(editingItem.link ?? "");
      setEditingDueDate(editingItem.dueDate ?? "");
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

  const handleSubTaskDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, subTaskId: string) => {
      if (!editingItemId) return;
      draggingSubTaskRef.current = subTaskId;
      setDraggingSubTaskId(subTaskId);
      event.dataTransfer.setData("text/plain", subTaskId);
      event.dataTransfer.effectAllowed = "move";
    },
    [editingItemId],
  );

  const handleSubTaskDragEnd = useCallback(() => {
    draggingSubTaskRef.current = null;
    setDraggingSubTaskId(null);
    setSubTaskDropTargetId(null);
    setSubTaskDropPosition(null);
  }, []);

  const handleSubTaskDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>, subTaskId: string) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const rect = event.currentTarget.getBoundingClientRect();
      const nextPosition = event.clientY > rect.top + rect.height / 2 ? "below" : "above";
      if (subTaskDropTargetId !== subTaskId) {
        setSubTaskDropTargetId(subTaskId);
      }
      if (subTaskDropPosition !== nextPosition) {
        setSubTaskDropPosition(nextPosition);
      }
    },
    [subTaskDropPosition, subTaskDropTargetId],
  );

  const handleSubTaskDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>, targetSubTaskId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const draggedId = draggingSubTaskRef.current ?? event.dataTransfer.getData("text/plain");
      if (!draggedId || !editingItemId) {
        handleSubTaskDragEnd();
        return;
      }

      if (draggedId === targetSubTaskId) {
        handleSubTaskDragEnd();
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const shouldPlaceAfter = event.clientY > rect.top + rect.height / 2;

      setItems((prevItems) =>
        prevItems.map((item) => {
          if (item.id !== editingItemId) return item;

          const subTasks = item.subTasks;
          const fromIndex = subTasks.findIndex((st) => st.id === draggedId);
          const toIndex = subTasks.findIndex((st) => st.id === targetSubTaskId);
          if (fromIndex === -1 || toIndex === -1) return item;
          if (fromIndex === toIndex) return item;

          const nextSubTasks = [...subTasks];
          const [moved] = nextSubTasks.splice(fromIndex, 1);
          let insertIndex = toIndex;

          if (fromIndex < toIndex) {
            insertIndex = toIndex - 1;
          }

          if (shouldPlaceAfter) {
            insertIndex += 1;
          }

          if (insertIndex < 0) insertIndex = 0;
          if (insertIndex > nextSubTasks.length) insertIndex = nextSubTasks.length;

          nextSubTasks.splice(insertIndex, 0, moved);
          return { ...item, subTasks: nextSubTasks };
        })
      );
      handleSubTaskDragEnd();
    },
    [editingItemId, handleSubTaskDragEnd, setItems],
  );

  const handleSubTaskListDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (event.target !== event.currentTarget) {
      return;
    }
    if (subTaskDropTargetId !== null) {
      setSubTaskDropTargetId(null);
      setSubTaskDropPosition(null);
    }
  }, [subTaskDropTargetId]);

  const handleSubTaskListDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const draggedId = draggingSubTaskRef.current ?? event.dataTransfer.getData("text/plain");
      if (!draggedId || !editingItemId) {
        handleSubTaskDragEnd();
        return;
      }

      setItems((prevItems) =>
        prevItems.map((item) => {
          if (item.id !== editingItemId) return item;

          const subTasks = item.subTasks;
          const fromIndex = subTasks.findIndex((st) => st.id === draggedId);
          if (fromIndex === -1 || fromIndex === subTasks.length - 1) return item;

          const nextSubTasks = [...subTasks];
          const [moved] = nextSubTasks.splice(fromIndex, 1);
          nextSubTasks.push(moved);
          return { ...item, subTasks: nextSubTasks };
        })
      );
      handleSubTaskDragEnd();
    },
    [editingItemId, handleSubTaskDragEnd, setItems],
  );

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
            <Button
              type="button"
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              onClick={() => setViewMode("calendar")}
              className="justify-start"
            >
              <Calendar className="mr-1.5 h-4 w-4" />
              Calendar
            </Button>
          </div>
        </aside>

        <div className="flex-1 space-y-4">
          {viewMode !== "documents" && viewMode !== "calendar" && (
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
          ) : viewMode === "calendar" ? (
            <CalendarView
              items={items}
              onOpenItem={handleOpenItem}
              onAssignDueDate={handleAssignDueDate}
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

                  {/* Due date section */}
                  <div className="space-y-2">
                    <label
                      htmlFor="edit-task-due-date"
                      className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Due date
                    </label>
                    <div className="relative flex items-center">
                      <Calendar className="absolute left-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="edit-task-due-date"
                        type="date"
                        value={editingDueDate}
                        onChange={(event) => setEditingDueDate(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            if (!isSaveDisabled) {
                              saveEdit();
                            }
                          }
                        }}
                        className="pl-9 pr-9"
                      />
                      {editingDueDate && (
                        <button
                          type="button"
                          onClick={() => setEditingDueDate("")}
                          className="absolute right-3 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label="Clear due date"
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
                      <div
                        className="space-y-2"
                        onDragOver={handleSubTaskListDragOver}
                        onDrop={handleSubTaskListDrop}
                      >
                        {currentSubTasks.map((subTask) => {
                          const isDragging = draggingSubTaskId === subTask.id;
                          const isDropTarget = subTaskDropTargetId === subTask.id;
                          const dropPosition = isDropTarget ? subTaskDropPosition : null;

                          return (
                            <div
                              key={subTask.id}
                              draggable
                              aria-grabbed={isDragging}
                              onDragStart={(event) => handleSubTaskDragStart(event, subTask.id)}
                              onDragEnd={handleSubTaskDragEnd}
                              onDragOver={(event) => handleSubTaskDragOver(event, subTask.id)}
                              onDrop={(event) => handleSubTaskDrop(event, subTask.id)}
                              className={`group relative flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 transition ${
                                isDragging ? "opacity-60" : ""
                              } cursor-grab active:cursor-grabbing`}
                            >
                              {dropPosition && (
                                <span
                                  className={`pointer-events-none absolute left-2 right-2 ${
                                    dropPosition === "above" ? "-top-px" : "-bottom-px"
                                  } h-0.5 rounded-full bg-primary/70`}
                                />
                              )}
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
                          );
                        })}
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

                  {/* Due date section */}
                  <div className="space-y-2">
                    <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Due date
                    </span>
                    {editingItem?.dueDate ? (
                      <div className="flex items-center gap-2 text-base text-foreground">
                        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>{formatDueDate(editingItem.dueDate)}</span>
                      </div>
                    ) : (
                      <p className="text-base text-muted-foreground">
                        No due date yet.
                      </p>
                    )}
                  </div>

                  {/* Sub-tasks section */}
                  <div className="space-y-3">
                    <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Sub-tasks
                    </span>

                    {currentSubTasks.length > 0 ? (
                      <div
                        className="space-y-2"
                        onDragOver={handleSubTaskListDragOver}
                        onDrop={handleSubTaskListDrop}
                      >
                        {currentSubTasks.map((subTask) => {
                          const isDragging = draggingSubTaskId === subTask.id;
                          const isDropTarget = subTaskDropTargetId === subTask.id;
                          const dropPosition = isDropTarget ? subTaskDropPosition : null;

                          return (
                            <div
                              key={subTask.id}
                              draggable
                              aria-grabbed={isDragging}
                              onDragStart={(event) => handleSubTaskDragStart(event, subTask.id)}
                              onDragEnd={handleSubTaskDragEnd}
                              onDragOver={(event) => handleSubTaskDragOver(event, subTask.id)}
                              onDrop={(event) => handleSubTaskDrop(event, subTask.id)}
                              className={`relative flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 transition ${
                                isDragging ? "opacity-60" : ""
                              } cursor-grab active:cursor-grabbing`}
                            >
                              {dropPosition && (
                                <span
                                  className={`pointer-events-none absolute left-2 right-2 ${
                                    dropPosition === "above" ? "-top-px" : "-bottom-px"
                                  } h-0.5 rounded-full bg-primary/70`}
                                />
                              )}
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
                          );
                        })}
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
