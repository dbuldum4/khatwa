"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Minus,
  Undo,
  Redo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type JSONContent } from "@/lib/db";

interface DocumentEditorProps {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  placeholder?: string;
}

// Slash command definitions
const SLASH_COMMANDS = [
  { id: "h1", label: "Heading 1", icon: Heading1, description: "Large heading" },
  { id: "h2", label: "Heading 2", icon: Heading2, description: "Medium heading" },
  { id: "h3", label: "Heading 3", icon: Heading3, description: "Small heading" },
  { id: "bullet", label: "Bullet List", icon: List, description: "Create a bullet list" },
  { id: "numbered", label: "Numbered List", icon: ListOrdered, description: "Create a numbered list" },
  { id: "quote", label: "Quote", icon: Quote, description: "Create a blockquote" },
  { id: "code", label: "Code Block", icon: Code, description: "Create a code block" },
  { id: "divider", label: "Divider", icon: Minus, description: "Insert a horizontal rule" },
];

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded p-1.5 transition-colors ${
        isActive
          ? "bg-primary/20 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const handleSetLink = () => {
    if (linkUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl })
        .run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  };

  const handleLinkClick = () => {
    const previousUrl = editor.getAttributes("link").href;
    setLinkUrl(previousUrl || "");
    setShowLinkInput(true);
    setTimeout(() => linkInputRef.current?.focus(), 0);
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border/50 bg-muted/30 px-2 py-1.5">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold (Cmd+B)"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic (Cmd+I)"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Underline (Cmd+U)"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough (Cmd+Shift+S)"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border/50" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border/50" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border/50" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
        title="Code Block"
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border/50" />

      <div className="relative">
        <ToolbarButton
          onClick={handleLinkClick}
          isActive={editor.isActive("link")}
          title="Link"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        {showLinkInput && (
          <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-lg border border-border bg-card p-2 shadow-lg">
            <input
              ref={linkInputRef}
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSetLink();
                }
                if (e.key === "Escape") {
                  setShowLinkInput(false);
                  setLinkUrl("");
                }
              }}
              placeholder="https://..."
              className="w-48 rounded border border-border bg-background px-2 py-1 text-base outline-none focus:border-primary"
            />
            <Button size="sm" onClick={handleSetLink}>
              Set
            </Button>
          </div>
        )}
      </div>

      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Divider"
      >
        <Minus className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border/50" />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Cmd+Z)"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Cmd+Shift+Z)"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

function SlashCommandMenu({
  editor,
  query,
  onClose,
  position,
}: {
  editor: Editor;
  query: string;
  onClose: () => void;
  position: { top: number; left: number };
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevQuery, setPrevQuery] = useState(query);
  const menuRef = useRef<HTMLDivElement>(null);

  // Reset selectedIndex when query changes (React recommended pattern)
  if (prevQuery !== query) {
    setPrevQuery(query);
    setSelectedIndex(0);
  }

  const filteredCommands = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.id.toLowerCase().includes(query.toLowerCase())
  );

  const executeCommand = useCallback(
    (commandId: string) => {
      // Delete the slash and query
      const { from } = editor.state.selection;
      const slashPos = from - query.length - 1;
      editor.chain().focus().deleteRange({ from: slashPos, to: from }).run();

      switch (commandId) {
        case "h1":
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case "h2":
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          break;
        case "h3":
          editor.chain().focus().toggleHeading({ level: 3 }).run();
          break;
        case "bullet":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "numbered":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "quote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "code":
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case "divider":
          editor.chain().focus().setHorizontalRule().run();
          break;
      }

      onClose();
    },
    [editor, query, onClose]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex].id);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filteredCommands, selectedIndex, executeCommand, onClose]);

  if (filteredCommands.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
        Commands
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filteredCommands.map((cmd, index) => {
          const Icon = cmd.icon;
          return (
            <button
              key={cmd.id}
              type="button"
              onClick={() => executeCommand(cmd.id)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-base transition-colors ${
                index === selectedIndex
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{cmd.label}</div>
                <div className="text-sm text-muted-foreground/70 truncate">
                  {cmd.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DocumentEditor({
  content,
  onChange,
  placeholder = "Start writing... Type '/' for commands",
}: DocumentEditorProps) {
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Underline,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as JSONContent);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-base max-w-none min-h-[300px] px-4 py-3 focus:outline-none",
      },
      handleKeyDown: (view, event) => {
        // Handle slash command trigger
        if (event.key === "/" && !showSlashMenu) {
          // Get cursor position for menu
          const { from } = view.state.selection;
          const coords = view.coordsAtPos(from);
          const containerRect = editorContainerRef.current?.getBoundingClientRect();
          
          if (containerRect) {
            setMenuPosition({
              top: coords.bottom - containerRect.top + 4,
              left: coords.left - containerRect.left,
            });
          }
          
          // Show menu after the slash is typed
          setTimeout(() => {
            setShowSlashMenu(true);
            setSlashQuery("");
          }, 0);
        }

        // Close slash menu on space or escape
        if (showSlashMenu && (event.key === " " || event.key === "Escape")) {
          setShowSlashMenu(false);
          setSlashQuery("");
        }

        return false;
      },
    },
  });

  // Track typing after slash
  useEffect(() => {
    if (!editor || !showSlashMenu) return;

    const handleUpdate = () => {
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(
        Math.max(0, from - 20),
        from
      );
      
      const slashMatch = textBefore.match(/\/([a-zA-Z0-9]*)$/);
      if (slashMatch) {
        setSlashQuery(slashMatch[1]);
      } else {
        setShowSlashMenu(false);
        setSlashQuery("");
      }
    };

    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor, showSlashMenu]);

  return (
    <div
      ref={editorContainerRef}
      className="relative flex flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <Toolbar editor={editor} />
      <div className="relative flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
        {showSlashMenu && editor && (
          <SlashCommandMenu
            editor={editor}
            query={slashQuery}
            onClose={() => {
              setShowSlashMenu(false);
              setSlashQuery("");
            }}
            position={menuPosition}
          />
        )}
      </div>
    </div>
  );
}
