"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentEditor } from "@/components/document-editor";
import { type DocumentRecord, type JSONContent } from "@/lib/db";

interface DocumentEditorModalProps {
  doc: DocumentRecord;
  taskName: string;
  onSave: (updates: { title: string; content: JSONContent }) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function DocumentEditorModal({
  doc,
  taskName,
  onSave,
  onDelete,
  onClose,
}: DocumentEditorModalProps) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState<JSONContent>(doc.content);
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFlushRef = useRef(false);
  const onSaveRef = useRef(onSave);
  
  // Keep onSave ref updated to avoid dependency issues
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const flushPendingSave = useCallback(() => {
    if (!hasChanges) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    onSaveRef.current({ title: title.trim() || "Untitled", content });
  }, [content, hasChanges, title]);

  const handleClose = useCallback((options?: { skipSave?: boolean }) => {
    if (!options?.skipSave) {
      flushPendingSave();
    }
    skipFlushRef.current = true;
    setIsOpen(false);
    closeTimeoutRef.current = setTimeout(() => {
      onClose();
    }, 180);
  }, [flushPendingSave, onClose]);

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setIsOpen(true));
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      if (!skipFlushRef.current) {
        flushPendingSave();
      }
    };
  }, [flushPendingSave]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showDeleteConfirm, handleClose]);

  // Auto-save on changes (only when user has made changes)
  useEffect(() => {
    if (!hasChanges) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      onSaveRef.current({ title: title.trim() || "Untitled", content });
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [title, content, hasChanges]);

  const handleDelete = () => {
    onDelete();
    skipFlushRef.current = true;
    handleClose({ skipSave: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          backdropFilter: isOpen ? "blur(4px)" : "blur(0px)",
          opacity: isOpen ? 1 : 0,
          transition: "opacity 180ms ease-out, backdrop-filter 180ms ease-out",
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          display: "flex",
          height: "85vh",
          width: "100%",
          maxWidth: "56rem",
          flexDirection: "column",
          borderRadius: "1.5rem",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          backgroundColor: "var(--card)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "scale(1) translateY(0)" : "scale(0.98) translateY(4px)",
          transition: "opacity 180ms ease-out, transform 180ms ease-out",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border/50 px-6 py-4">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground mb-2">
              Document in <span className="font-medium text-foreground">{taskName}</span>
            </div>
            <Input
              id="document-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Untitled"
              className="border-0 bg-transparent px-0 text-xl font-semibold focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <div className="flex items-center gap-2">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2">
                <span className="text-sm text-destructive">Delete document?</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete document"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden p-6">
          <DocumentEditor
            content={content}
            onChange={(newContent) => {
              setContent(newContent);
              setHasChanges(true);
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/50 px-6 py-3">
          <div className="text-xs text-muted-foreground">
            Auto-saved
          </div>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
