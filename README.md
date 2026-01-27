# Khatwa

A modern, dark-mode personal tracker built with Next.js 16, React 19, and Tailwind CSS 4.

It supports list/kanban/documents/calendar views, drag-and-drop, sub-tasks, due dates, configurable custom fields, rich-text documents (slash commands), and offline-first local persistence (IndexedDB). It can also be run as an Electron desktop app using a static export.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.3 | App Router, server components |
| React | 19.2.3 | UI framework |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Utility-first styling |
| shadcn/ui | - | UI component primitives |
| Radix UI | Slot 1.2.4, Select 2.2.6 | Accessible component primitives |
| Lucide React | 0.562.0 | Icon library |
| Dexie.js | 4.2.1 | IndexedDB wrapper for local persistence |
| Tiptap | 3.15.3 | Rich text editor (ProseMirror-based) |
| Electron | 40.0.0 | Desktop wrapper (optional) |
| electron-builder | 26.4.0 | Desktop packaging (optional) |

## Getting Started

```bash
# Install dependencies
pnpm install

# Start web development server
pnpm dev

# Build web for production
pnpm build

# Start web production server
pnpm start

# Start Electron in dev mode (runs Next dev server + Electron)
pnpm dev:electron

# Build Electron (static export + Electron main/preload build)
pnpm build:electron

# Run Electron (after build:electron)
pnpm start:electron

# Package a macOS app directory (requires macOS)
pnpm package:mac

# Run linter
pnpm lint
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

Electron builds use a static export (`out/`). In production, Electron serves the export from a local HTTP server (fixed port `45789` when available) to keep a stable origin for IndexedDB persistence. If the port is already in use, it falls back to a random port (which may affect IndexedDB persistence).

If you add server-only features, they won't work in Electron unless you switch to a different Electron hosting strategy.

## Deployment

### Netlify

The app is configured for Netlify deployment via `netlify.toml`. It uses static export mode for Netlify.

```bash
# Build and deploy to production
NETLIFY=true pnpm build && netlify deploy --prod --dir=out
```

Live at: [https://khatwa-app.netlify.app](https://khatwa-app.netlify.app)

## Project Structure

```
src/
├── app/
│   ├── globals.css          # Global styles, Tailwind imports, Tiptap styles
│   ├── layout.tsx           # Root layout, dark mode enabled by default
│   ├── page.tsx             # Main page, renders ItemList + SettingsMenu
│   └── favicon.ico
├── components/
│   ├── item-list.tsx        # Core task management component (list/kanban/calendar + task modal)
│   ├── settings-menu.tsx    # Custom fields + import/export dialogs
│   ├── documents-view.tsx   # Documents view with collapsible task groups
│   ├── document-editor.tsx  # Tiptap rich text editor with toolbar & slash commands
│   ├── document-editor-modal.tsx # Modal wrapper for document editing
│   └── ui/
│       ├── button.tsx       # shadcn/ui Button component
│       ├── card.tsx         # shadcn/ui Card components
│       ├── input.tsx        # shadcn/ui Input component
│       └── select.tsx       # shadcn/ui Select component
├── hooks/
│   ├── use-task-store.ts    # Task persistence hook for IndexedDB sync
│   └── use-document-store.ts # Document persistence hook for IndexedDB sync
└── lib/
    ├── db.ts                # Dexie database schema and helpers
    ├── import-export.ts      # Local backup export/import helpers
    └── utils.ts             # Utility functions (cn for class merging)
electron/
├── main.ts                  # Electron main process (dev server + local static server for out/)
└── preload.ts               # Secure preload bridge
```

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Page (page.tsx)                                  │
│  ┌──────────────────────────────┐     ┌──────────────────────────────┐  │
│  │ SettingsMenu                  │     │ ItemList                      │  │
│  │  - custom fields              │     │  - list/kanban/docs/calendar  │  │
│  │  - export/import backups      │     │  - task modal + documents     │  │
│  └──────────────────────────────┘     └──────────────────────────────┘  │
│                 │                              │                          │
│                 └──────────────┬───────────────┘                          │
│                                ▼                                          │
│     ┌───────────────────────────────────────────────────────────────┐     │
│     │ State (via useTaskStore + useDocumentStore hooks)              │     │
│     │  - tasks: TaskRecord[] (dueDate, customFields, subTasks)       │     │
│     │  - documents: DocumentRecord[]                                 │     │
│     │  - columnById: Record<string, ColumnId>                        │     │
│     │  - viewMode: "list" | "columns" | "documents" | "calendar"     │     │
│     └───────────────────────────────────────────────────────────────┘     │
│                                │                                          │
│                                ▼ (auto-sync)                              │
│     ┌───────────────────────────────────────────────────────────────┐     │
│     │ IndexedDB (via Dexie)                                         │     │
│     │  - tasks: id, label, link, dueDate, customFields, subTasks     │     │
│     │  - documents: id, taskId, title, content, createdAt, updatedAt │     │
│     │  - settings: columnById, viewMode, customFields                │     │
│     └───────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Type Definitions

```typescript
// Column configuration (static)
const COLUMNS = [
  { id: "column-1", label: "To apply" },
  { id: "column-2", label: "Applied" },
  { id: "column-3", label: "Interviewing" },
  { id: "column-4", label: "Offer" },
] as const;

type ColumnId = "column-1" | "column-2" | "column-3" | "column-4";
type ViewMode = "list" | "columns" | "documents" | "calendar";

// Custom fields (configured via Settings)
type CustomFieldType = "text" | "select";

type CustomFieldDefinition = {
  id: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
};

// Sub-task structure
type SubTask = {
  id: string;
  label: string;
  completed: boolean;
};

// Main task structure
type Item = {
  id: string;
  label: string;
  link?: string;
  dueDate?: string; // YYYY-MM-DD (local date)
  customFields?: Record<string, string>; // fieldId -> value
  subTasks: SubTask[];
};

// Document structure
type DocumentRecord = {
  id: string;
  taskId: string;
  title: string;
  content: JSONContent; // Tiptap JSON format
  createdAt: number;
  updatedAt: number;
};
```

### State Management

Persistent state is managed via two hooks that sync with IndexedDB:

useTaskStore:

| State | Type | Purpose | Persisted |
|-------|------|---------|-----------|
| `items` | `TaskRecord[]` | All tasks (includes `dueDate` + `customFields`) | Yes |
| `columnById` | `Record<string, ColumnId>` | Maps item IDs to columns | Yes |
| `viewMode` | `ViewMode` | Current view (list, columns, documents, calendar) | Yes |
| `isHydrated` | `boolean` | Whether data has loaded from IndexedDB | No |

useDocumentStore:

| State | Type | Purpose | Persisted |
|-------|------|---------|-----------|
| `documents` | `DocumentRecord[]` | All documents | Yes |
| `isHydrated` | `boolean` | Whether data has loaded from IndexedDB | No |

Additional persisted settings:

| Setting key | Type | Purpose |
|-------------|------|---------|
| `customFields` | `CustomFieldDefinition[]` | Configurable per-task fields (managed in Settings) |

Local UI state in `ItemList`:

| State | Type | Purpose |
|-------|------|---------|
| `inputValue` | `string` | New task input field |
| `editingItemId` | `string \| null` | Currently viewing/editing task ID |
| `editingLabel` | `string` | Task name in editor |
| `editingLink` | `string` | Task link in editor |
| `editingDueDate` | `string` | Task due date in editor (YYYY-MM-DD) |
| `editingCustomFields` | `Record<string, string>` | Custom field values in editor |
| `subTaskInput` | `string` | New sub-task input field |
| `isEditorOpen` | `boolean` | Controls modal animation state |
| `isEditMode` | `boolean` | Whether modal is in edit mode (vs view mode) |
| `editingDocumentFromTask` | `DocumentRecord \| null` | Document being edited from task modal |

### Key Functions

| Function | Purpose |
|----------|---------|
| `createItemId()` | Generates unique IDs using `crypto.randomUUID()` |
| `addItem()` | Creates new task with default column |
| `removeItem(id)` | Deletes task and its column mapping |
| `handleAssignDueDate(itemId, dateKey)` | Assigns a due date from Calendar drag-and-drop |
| `openEditor(item)` | Opens modal in view mode with item data |
| `closeEditor()` | Closes modal with animation delay |
| `saveEdit()` | Persists label/link/dueDate/customFields changes, returns to view mode |
| `cancelEditMode()` | Discards changes and returns to view mode |
| `addSubTask()` | Adds sub-task to current item |
| `toggleSubTask(id)` | Toggles completion; if task is in first column, completing a sub-task moves it to the second column |
| `removeSubTask(id)` | Deletes sub-task |
| `handleSubTaskDragStart/Over/Drop` | Drag-and-drop reordering within the sub-task list |
| `handleDragStart/End/Over/Drop` | Drag-and-drop between kanban columns |
| `addDocument(taskId, title)` | Creates new document for a task |
| `updateDocument(id, updates)` | Updates document title/content |
| `deleteDocument(id)` | Deletes a document |
| `exportAllData()` | Exports tasks/documents/settings to a JSON string |
| `importAllData()` | Replaces local data from an exported backup |

## Component Details

### SettingsMenu (`src/components/settings-menu.tsx`)

Centralized settings and data management:

- Custom fields: create/remove fields (text or dropdown). Removing a field also removes its stored values from all tasks.
- Export: export all tasks, documents, and settings as JSON (copy or download as `.txt`).
- Import: paste/upload a backup, preview counts, confirm, and replace all local data.

Custom field changes are broadcast via a `custom-fields-updated` window event so the task UI can refresh without reload.

### ItemList (`src/components/item-list.tsx`)

The main component handling all task functionality. Structure:

1. Sidebar - View mode toggle (List/Kanban/Documents/Calendar)
2. Input Area - Add new tasks (hidden in Documents and Calendar views)
3. List View - Vertical task list
4. Kanban View - Four-column board with drag-and-drop
5. Calendar View - Month grid showing tasks with due dates and allowing due-date assignment
6. Task Modal - Full-screen overlay for viewing/editing tasks and creating documents

### Task Modal Features

The modal opens in view mode by default and can switch to edit mode.

View mode:

- Task name displayed as a prominent heading
- Link shown as clickable URL (or "No link yet" placeholder)
- Due date shown (if set)
- Custom field values shown (if configured)
- Sub-tasks list with completion toggle
- Documents section with list of task documents
- Create/Add Document actions
- Keyboard: Escape to close

Edit mode:

- Task name input (required)
- Link input with icon and clear button
- Due date input (`type="date"`) with clear button
- Custom fields editor:
  - Text fields render as inputs
  - Dropdown fields render as a Select (Radix)
- Sub-tasks list with completion toggle and remove buttons
- Drag-and-drop reordering for sub-tasks
- Add sub-task input
- Save/Cancel actions
- Keyboard: Enter to save, Escape to cancel (returns to view mode)

Shared:

- Animated backdrop blur (180ms ease-out)

### Calendar View (`src/components/item-list.tsx`)

- Month grid with Previous/Next/Today navigation
- Tasks with a due date appear on the corresponding day
- Tasks without a due date appear in a list below the grid
- Drag a task without a due date onto a day to assign `dueDate` (YYYY-MM-DD)

### DocumentsView (`src/components/documents-view.tsx`)

Displays all documents organized by task:

- Collapsible task sections (tasks with documents expanded by default)
- Document count badge per task
- Document list showing title, date, and content preview
- Click document to open editor
- Add document button per task section

### DocumentEditor (`src/components/document-editor.tsx`)

Rich text editor built with Tiptap:

Toolbar buttons:

- Bold, Italic, Underline, Strikethrough
- Heading 1, 2, 3
- Bullet List, Numbered List
- Blockquote, Code Block
- Link (with URL input popup)
- Horizontal Rule
- Undo, Redo

Keyboard shortcuts:

- `Cmd/Ctrl + B` - Bold
- `Cmd/Ctrl + I` - Italic
- `Cmd/Ctrl + U` - Underline
- `Cmd/Ctrl + Shift + S` - Strikethrough
- `Cmd/Ctrl + Z` - Undo
- `Cmd/Ctrl + Shift + Z` - Redo

Slash commands:

Type `/` to open the command menu:

- `/h1` - Heading 1
- `/h2` - Heading 2
- `/h3` - Heading 3
- `/bullet` - Bullet List
- `/numbered` - Numbered List
- `/quote` - Blockquote
- `/code` - Code Block
- `/divider` - Horizontal Rule

Navigate with arrow keys, Enter to select, Escape to close.

### UI Components

All UI components are from shadcn/ui with Tailwind CSS styling:

- `Button` - Variants: default, secondary, ghost, destructive
- `Card` - Container with header, content, footer
- `Input` - Text input with consistent styling
- `Select` - Dropdown/select (Radix-based)

## Styling

### CSS Variables

Theme colors are defined in `globals.css` using CSS custom properties:

```css
--background, --foreground
--card, --card-foreground
--primary, --primary-foreground
--muted, --muted-foreground
--border, --ring
--destructive
```

### Animation Timing

The modals use synchronized animations:

- Duration: 180ms
- Easing: ease-out
- Properties: opacity, transform (scale, translateY), backdrop-filter

### Tiptap Editor Styles

Custom styles for the rich text editor content in `globals.css`:

- Headings (h1, h2, h3) with appropriate sizing
- Lists (ul, ol) with proper indentation
- Blockquotes with left border accent
- Code blocks with monospace font and background
- Links with primary color
- Placeholder text styling

## Extending the Application

### Adding a New Task Field

1. Update the `TaskRecord` type in `src/lib/db.ts`
2. Update the export/import format (types + validation) in `src/lib/import-export.ts`
3. Update the `Item` type in `src/components/item-list.tsx`
4. Add corresponding state variable (`editing{Field}`)
5. Initialize in `openEditor()`, reset in `closeEditor()`
6. Persist in `saveEdit()`, reset in `cancelEditMode()`
7. Add UI in both view mode (read-only display) and edit mode (input field)
8. Display in list/kanban views if needed

### Adding a New Column

1. Add to `COLUMNS` array in `src/components/item-list.tsx`
2. Update the `ColumnId` type (TypeScript will point you to all required updates)

### Adding Document Fields

1. Update `DocumentRecord` interface in `src/lib/db.ts`
2. Update `useDocumentStore` hook to handle new fields
3. Update `DocumentEditorModal` to display/edit new fields

### Local Persistence

Data is automatically persisted to IndexedDB via Dexie.js. The hooks handle:

- Hydration: loads saved data on mount (shows loading spinner)
- Auto-save: debounced writes (300ms) when state changes; pending writes are paused during import to avoid races
- Fallback: works in memory-only mode if IndexedDB is unavailable

Database schema (`src/lib/db.ts`):

- `tasks` table: stores tasks (including `dueDate` and `customFields`) indexed by `id`
- `documents` table: stores documents indexed by `id` and `taskId`
- `settings` table: stores `columnById`, `viewMode`, and `customFields` definitions

To add cloud sync in the future, you could:

1. Database API: add API routes and sync with the hook
2. Real-time: consider Supabase or Firebase for live sync

### Adding New UI Components

```bash
# Using shadcn/ui CLI
npx shadcn@latest add [component-name]
```

Components are added to `src/components/ui/`.

## Icons

Using Lucide React. Commonly used icons include:

```typescript
import {
  // Core UI
  X,
  Plus,
  Pencil,
  Loader2,
  ExternalLink,
  Link2,

  // Navigation / views
  List,
  Columns3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,

  // Settings + backup
  Settings,
  Download,
  Upload,
  Copy,
  Check,
  FileUp,
  Trash2,

  // Sub-tasks + documents
  Circle,
  CheckCircle2,
  FileText,

  // Editor toolbar
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  ListOrdered,
  Quote,
  Code,
  Minus,
  Undo,
  Redo,
} from "lucide-react";
```

Browse available icons at [lucide.dev](https://lucide.dev/icons/).

## Notes

- Dark mode is enabled by default via `className="dark"` on `<html>` in `layout.tsx`
- Data persists across browser sessions via IndexedDB (tasks/documents/settings survive refreshes)
- The task modal opens in view mode by default; click Edit to modify task details
- Sub-tasks can be reordered via drag-and-drop inside the task modal
- Completing a sub-task can auto-move a task from "To apply" to "Applied"
- Calendar view shows tasks by due date; drag a task without a due date onto a day to set one
- Settings include custom fields and local import/export backups
- Links open in new tabs with `rel="noopener noreferrer"` for security
- IDs are generated using `crypto.randomUUID()` with a fallback for older browsers
- Data is stored in the browser's IndexedDB under the database name "khatwa"
- Documents are associated with tasks via `taskId` reference
- Document content is stored as Tiptap JSON format for rich text
- Documents auto-save while editing (500ms debounce + flush on close)
- The document editor uses `immediatelyRender: false` for Next.js SSR compatibility
