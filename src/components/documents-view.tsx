"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, FileText, Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentEditorModal } from "@/components/document-editor-modal";
import { type DocumentRecord, type TaskRecord, type JSONContent } from "@/lib/db";

interface DocumentsViewProps {
  documents: DocumentRecord[];
  tasks: TaskRecord[];
  onAddDocument: (taskId: string, title: string) => DocumentRecord;
  onUpdateDocument: (id: string, updates: Partial<Pick<DocumentRecord, 'title' | 'content'>>) => void;
  onDeleteDocument: (id: string) => void;
}

// Get plain text preview from Tiptap JSON content
function getContentPreview(content: JSONContent, maxLength: number = 100): string {
  const extractText = (node: JSONContent): string => {
    if (node.text) return node.text;
    if (node.content) {
      return node.content.map(extractText).join(" ");
    }
    return "";
  };

  const text = extractText(content).trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

// Format date to relative or absolute format
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

interface TaskGroupProps {
  task: TaskRecord;
  documents: DocumentRecord[];
  isExpanded: boolean;
  onToggle: () => void;
  onDocumentClick: (doc: DocumentRecord) => void;
  onAddDocument: () => void;
}

function TaskGroup({
  task,
  documents,
  isExpanded,
  onToggle,
  onDocumentClick,
  onAddDocument,
}: TaskGroupProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-card overflow-hidden">
      {/* Task header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 font-medium text-foreground truncate">
          {task.label}
        </span>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-sm text-muted-foreground">
          {documents.length} {documents.length === 1 ? "doc" : "docs"}
        </span>
      </button>

      {/* Documents list */}
      {isExpanded && (
        <div className="border-t border-border/50">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-base text-muted-foreground">
                No documents yet
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddDocument();
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Document
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => onDocumentClick(doc)}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-primary/70" />
                    <span className="flex-1 font-medium text-foreground truncate">
                      {doc.title}
                    </span>
                  </div>
                  <div className="ml-6 flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(doc.updatedAt)}
                    </span>
                    {getContentPreview(doc.content) && (
                      <span className="truncate">
                        {getContentPreview(doc.content, 60)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              <div className="px-4 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddDocument();
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add document
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DocumentsView({
  documents,
  tasks,
  onAddDocument,
  onUpdateDocument,
  onDeleteDocument,
}: DocumentsViewProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => {
    // Expand tasks that have documents by default
    const tasksWithDocs = new Set(documents.map((d) => d.taskId));
    return tasksWithDocs;
  });
  const [editingDocument, setEditingDocument] = useState<DocumentRecord | null>(null);

  // Group documents by task
  const documentsByTask = useMemo(() => {
    const map = new Map<string, DocumentRecord[]>();
    for (const doc of documents) {
      const existing = map.get(doc.taskId) || [];
      existing.push(doc);
      map.set(doc.taskId, existing);
    }
    // Sort documents within each task by updatedAt (newest first)
    for (const [taskId, docs] of map) {
      map.set(
        taskId,
        docs.sort((a, b) => b.updatedAt - a.updatedAt)
      );
    }
    return map;
  }, [documents]);

  // Sort tasks: those with documents first, then by document count
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aCount = documentsByTask.get(a.id)?.length || 0;
      const bCount = documentsByTask.get(b.id)?.length || 0;
      if (aCount === 0 && bCount > 0) return 1;
      if (aCount > 0 && bCount === 0) return -1;
      return bCount - aCount;
    });
  }, [tasks, documentsByTask]);

  const toggleTask = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleAddDocument = (taskId: string) => {
    const newDoc = onAddDocument(taskId, "Untitled");
    setEditingDocument(newDoc);
    // Expand the task if not already
    setExpandedTasks((prev) => new Set(prev).add(taskId));
  };

  const handleDocumentClick = (doc: DocumentRecord) => {
    setEditingDocument(doc);
  };

  const handleSave = (updates: { title: string; content: JSONContent }) => {
    if (editingDocument) {
      onUpdateDocument(editingDocument.id, updates);
      // Update local state for immediate feedback
      setEditingDocument((prev) =>
        prev ? { ...prev, ...updates, updatedAt: Date.now() } : null
      );
    }
  };

  const handleDelete = () => {
    if (editingDocument) {
      onDeleteDocument(editingDocument.id);
      setEditingDocument(null);
    }
  };

  const editingTask = editingDocument
    ? tasks.find((t) => t.id === editingDocument.taskId)
    : null;

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/70 bg-muted/20 px-6 py-16 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50" />
        <div>
          <h3 className="text-lg font-medium text-foreground">No tasks yet</h3>
          <p className="mt-1 text-base text-muted-foreground">
            Create a task first, then you can add documents to it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-foreground">Documents</h2>
            <p className="text-base text-muted-foreground">
              {documents.length} {documents.length === 1 ? "document" : "documents"} across {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {sortedTasks.map((task) => (
            <TaskGroup
              key={task.id}
              task={task}
              documents={documentsByTask.get(task.id) || []}
              isExpanded={expandedTasks.has(task.id)}
              onToggle={() => toggleTask(task.id)}
              onDocumentClick={handleDocumentClick}
              onAddDocument={() => handleAddDocument(task.id)}
            />
          ))}
        </div>
      </div>

      {editingDocument && editingTask && (
        <DocumentEditorModal
          doc={editingDocument}
          taskName={editingTask.label}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditingDocument(null)}
        />
      )}
    </>
  );
}
