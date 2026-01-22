"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Settings, Download, Upload, X, Copy, Check, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  exportAllData,
  downloadExportFile,
  readFileAsText,
  parseImportFile,
  importAllData,
} from "@/lib/import-export";
import { setImportInProgress } from "@/lib/db";

type DialogMode = "none" | "export" | "import" | "confirm-import";

interface SettingsMenuProps {
  onDataImported?: () => void;
}

export function SettingsMenu({ onDataImported }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("none");
  const [exportData, setExportData] = useState("");
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<{ taskCount: number; documentCount: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const exportTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen || dialogMode !== "none") return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, dialogMode]);

  const handleCloseDialog = useCallback(() => {
    setDialogMode("none");
    setExportData("");
    setImportText("");
    setImportPreview(null);
    setError(null);
    setIsOpen(false);
  }, []);

  // Close menu on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (dialogMode !== "none") {
          handleCloseDialog();
        } else {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, dialogMode, handleCloseDialog]);

  // Reset copied state after delay
  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const handleExportClick = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const jsonString = await exportAllData();
      setExportData(jsonString);
      setDialogMode("export");
      setIsOpen(false);
    } catch (err) {
      setError("Failed to export data. Please try again.");
      console.error("Export error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCopyExport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportData);
      setCopied(true);
    } catch {
      // Fallback: select the text
      exportTextareaRef.current?.select();
    }
  }, [exportData]);

  const handleDownloadExport = useCallback(() => {
    downloadExportFile(exportData);
  }, [exportData]);

  const handleImportClick = useCallback(() => {
    setDialogMode("import");
    setImportText("");
    setError(null);
    setIsOpen(false);
  }, []);

  const handleImportTextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setImportText(event.target.value);
    setError(null);
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    event.target.value = "";

    setError(null);

    try {
      const content = await readFileAsText(file);
      setImportText(content);
    } catch (err) {
      setError("Failed to read file. Please try again.");
      console.error("File read error:", err);
    }
  }, []);

  const handlePreviewImport = useCallback(() => {
    const trimmed = importText.trim();
    if (!trimmed) {
      setError("Please paste your backup data.");
      return;
    }

    const { data, error: parseError } = parseImportFile(trimmed);

    if (parseError || !data) {
      setError(parseError ?? "Failed to parse data");
      return;
    }

    setImportPreview({
      taskCount: data.tasks.length,
      documentCount: data.documents.length,
    });
    setDialogMode("confirm-import");
    setError(null);
  }, [importText]);

  const handleConfirmImport = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: parseError } = parseImportFile(importText.trim());

      if (parseError || !data) {
        setError(parseError ?? "Failed to parse data");
        setIsLoading(false);
        return;
      }

      // Set flag to prevent any pending saves from corrupting the imported data
      setImportInProgress(true);
      
      await importAllData(data);
      
      handleCloseDialog();
      onDataImported?.();
      
      // Reload the page to ensure all state is refreshed
      window.location.reload();
    } catch (err) {
      // Reset flag on error so normal saves can resume
      setImportInProgress(false);
      setError("Failed to import data. Please try again.");
      console.error("Import error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [importText, onDataImported, handleCloseDialog]);

  const handleBackToImport = useCallback(() => {
    setDialogMode("import");
    setImportPreview(null);
  }, []);

  return (
    <>
      <div ref={menuRef} className="relative">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Settings"
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <Settings className="h-5 w-5" />
        </Button>

        {/* Dropdown Menu */}
        {isOpen && dialogMode === "none" && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-border/70 bg-card py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleExportClick}
              disabled={isLoading}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {isLoading ? "Loading..." : "Export Data"}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleImportClick}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted/50"
            >
              <Upload className="h-4 w-4" />
              Import Data
            </button>
          </div>
        )}
      </div>

      {/* Export Dialog */}
      {dialogMode === "export" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleCloseDialog}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-dialog-title"
            className="relative flex w-full max-w-2xl flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-xl"
            style={{ maxHeight: "85vh" }}
          >
            <button
              type="button"
              onClick={handleCloseDialog}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <h2
              id="export-dialog-title"
              className="text-lg font-semibold text-foreground"
            >
              Export Data
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Download as a file or copy the text below.
            </p>

            <div className="relative mt-4 flex-1 overflow-hidden rounded-lg border border-border/50">
              <textarea
                ref={exportTextareaRef}
                value={exportData}
                readOnly
                className="h-full min-h-[300px] w-full resize-none bg-muted/20 p-4 font-mono text-xs text-foreground focus:outline-none"
                style={{ maxHeight: "50vh" }}
              />
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCloseDialog}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCopyExport}
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={handleDownloadExport}
              >
                <Download className="mr-2 h-4 w-4" />
                Download .txt
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Import Dialog */}
      {dialogMode === "import" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleCloseDialog}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-dialog-title"
            className="relative flex w-full max-w-2xl flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-xl"
            style={{ maxHeight: "85vh" }}
          >
            <button
              type="button"
              onClick={handleCloseDialog}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <h2
              id="import-dialog-title"
              className="text-lg font-semibold text-foreground"
            >
              Import Data
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload a backup file or paste your backup data below.
            </p>

            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleUploadClick}
                className="w-full"
              >
                <FileUp className="mr-2 h-4 w-4" />
                Upload .txt File
              </Button>
            </div>

            <div className="relative mt-4 flex-1 overflow-hidden rounded-lg border border-border/50">
              <textarea
                value={importText}
                onChange={handleImportTextChange}
                placeholder="Paste your backup data here..."
                className="h-full min-h-[300px] w-full resize-none bg-muted/20 p-4 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                style={{ maxHeight: "50vh" }}
                autoFocus
              />
            </div>

            {error && (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            )}

            <div className="mt-4 flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCloseDialog}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handlePreviewImport}
                disabled={!importText.trim()}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Import Dialog */}
      {dialogMode === "confirm-import" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleCloseDialog}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-import-dialog-title"
            className="relative w-full max-w-md rounded-2xl border border-border/70 bg-card p-6 shadow-xl"
          >
            <button
              type="button"
              onClick={handleCloseDialog}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <h2
              id="confirm-import-dialog-title"
              className="text-lg font-semibold text-foreground"
            >
              Confirm Import
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will replace all your current data with the imported data.
              This action cannot be undone.
            </p>

            {importPreview && (
              <div className="mt-4 rounded-lg bg-muted/30 p-3">
                <p className="text-sm text-foreground">
                  The backup contains:
                </p>
                <ul className="mt-1 text-sm text-muted-foreground">
                  <li>• {importPreview.taskCount} task{importPreview.taskCount !== 1 ? 's' : ''}</li>
                  <li>• {importPreview.documentCount} document{importPreview.documentCount !== 1 ? 's' : ''}</li>
                </ul>
              </div>
            )}

            {error && (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleBackToImport}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleConfirmImport}
                disabled={isLoading}
              >
                {isLoading ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.json"
        onChange={handleFileSelected}
        className="hidden"
        aria-hidden="true"
      />
    </>
  );
}
