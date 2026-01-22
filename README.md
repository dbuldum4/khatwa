# Khatwa (Focus List)

A modern, dark-mode task management application built with Next.js 16, React 19, and Tailwind CSS 4. Features list, kanban, and documents views, drag-and-drop, sub-tasks, rich-text documents with slash commands, and persistent local storage.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.3 | App Router, server components |
| React | 19.2.3 | UI framework |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Utility-first styling |
| shadcn/ui | - | UI component primitives |
| Radix UI | 1.2.4 | Accessible component primitives |
| Lucide React | 0.562.0 | Icon library |
| Dexie.js | 4.2.1 | IndexedDB wrapper for local persistence |
| Tiptap | 3.15.3 | Rich text editor (ProseMirror-based) |

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

# Run linter
pnpm lint
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

Electron builds use a static export (`out/`). If you add server-only features, they won't work in Electron unless you switch to a different Electron hosting strategy.

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
│   ├── page.tsx             # Main page, renders ItemList component
│   └── favicon.ico
├── components/
│   ├── item-list.tsx        # Core task management component
│   ├── documents-view.tsx   # Documents view with collapsible task groups
│   ├── document-editor.tsx  # Tiptap rich text editor with toolbar & slash commands
│   ├── document-editor-modal.tsx # Modal wrapper for document editing
│   └── ui/
│       ├── button.tsx       # shadcn/ui Button component
│       ├── card.tsx         # shadcn/ui Card components
│       └── input.tsx        # shadcn/ui Input component
├── hooks/
│   ├── use-task-store.ts    # Task persistence hook for IndexedDB sync
│   └── use-document-store.ts # Document persistence hook for IndexedDB sync
└── lib/
    ├── db.ts                # Dexie database schema and helpers
    └── utils.ts             # Utility functions (cn for class merging)
electron/
├── main.ts                  # Electron main process (dev server + static export)
└── preload.ts               # Secure preload bridge
```

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                           ItemList                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ State (via useTaskStore + useDocumentStore hooks)            │   │
│  │  - items: Item[]                                             │   │
│  │  - documents: Document[]                                     │   │
│  │  - columnById: Record<string, ColumnId>                      │   │
│  │  - viewMode: "list" | "columns" | "documents"                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│        ┌─────────────────────┼─────────────────────┐                │
│        ▼                     ▼                     ▼                │
│  ┌──────────┐    ┌────────────────┐    ┌────────────────┐          │
│  │List View │    │ Columns View   │    │Documents View  │          │
│  └──────────┘    └────────────────┘    └────────────────┘          │
│        │                                       │                     │
│        ▼                                       ▼                     │
│  ┌──────────┐                         ┌────────────────┐            │
│  │Task Modal│ ────────────────────────│Document Editor │            │
│  │(+docs)   │                         │    Modal       │            │
│  └──────────┘                         └────────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (auto-sync)
┌─────────────────────────────────────────────────────────────────────┐
│                      IndexedDB (via Dexie)                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ tasks table     │  │ documents table │  │ settings table  │     │
│  │ (id, label,     │  │ (id, taskId,    │  │ (columnById,    │     │
│  │  link, subTasks)│  │  title, content,│  │  viewMode)      │     │
│  │                 │  │  createdAt,     │  │                 │     │
│  │                 │  │  updatedAt)     │  │                 │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### Type Definitions

```typescript
// Column configuration (static)
const COLUMNS = [
  { id: "column-1", label: "Not started" },
  { id: "column-2", label: "In progress" },
  { id: "column-3", label: "Completed" },
] as const;

type ColumnId = "column-1" | "column-2" | "column-3";
type ViewMode = "list" | "columns" | "documents";

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
  link?: string;      // Optional URL
  subTasks: SubTask[];
};

// Document structure
type Document = {
  id: string;
  taskId: string;     // Reference to parent task
  title: string;
  content: JSONContent; // Tiptap JSON format
  createdAt: number;
  updatedAt: number;
};
```

### State Management

Persistent state is managed via two hooks that sync with IndexedDB:

**useTaskStore:**

| State | Type | Purpose | Persisted |
|-------|------|---------|-----------|
| `items` | `Item[]` | All tasks | Yes |
| `columnById` | `Record<string, ColumnId>` | Maps item IDs to columns | Yes |
| `viewMode` | `ViewMode` | Current view (list, columns, or documents) | Yes |
| `isHydrated` | `boolean` | Whether data has loaded from IndexedDB | No |

**useDocumentStore:**

| State | Type | Purpose | Persisted |
|-------|------|---------|-----------|
| `documents` | `Document[]` | All documents | Yes |
| `isHydrated` | `boolean` | Whether data has loaded from IndexedDB | No |

Local UI state in `ItemList`:

| State | Type | Purpose |
|-------|------|---------|
| `inputValue` | `string` | New task input field |
| `editingItemId` | `string \| null` | Currently viewing/editing task ID |
| `editingLabel` | `string` | Task name in editor |
| `editingLink` | `string` | Task link in editor |
| `subTaskInput` | `string` | New sub-task input field |
| `isEditorOpen` | `boolean` | Controls modal animation state |
| `isEditMode` | `boolean` | Whether modal is in edit mode (vs view mode) |
| `editingDocumentFromTask` | `Document \| null` | Document being edited from task modal |

### Key Functions

| Function | Purpose |
|----------|---------|
| `createItemId()` | Generates unique IDs using `crypto.randomUUID()` |
| `addItem()` | Creates new task with default column |
| `removeItem(id)` | Deletes task and its column mapping |
| `openEditor(item)` | Opens modal in view mode with item data |
| `closeEditor()` | Closes modal with animation delay |
| `saveEdit()` | Persists label and link changes, returns to view mode |
| `cancelEditMode()` | Discards changes and returns to view mode |
| `addSubTask()` | Adds sub-task to current item |
| `toggleSubTask(id)` | Toggles completion, auto-moves to "In progress" |
| `removeSubTask(id)` | Deletes sub-task |
| `handleDragStart/End/Over/Drop` | Drag-and-drop between columns |
| `addDocument(taskId, title)` | Creates new document for a task |
| `updateDocument(id, updates)` | Updates document title/content |
| `deleteDocument(id)` | Deletes a document |

## Component Details

### ItemList (`src/components/item-list.tsx`)

The main component handling all task functionality. Structure:

1. **Sidebar** - View mode toggle (List/Columns/Documents)
2. **Input Area** - Add new tasks (hidden in Documents view)
3. **List View** - Simple vertical task list
4. **Column View** - Three-column kanban with drag-and-drop
5. **Documents View** - Documents grouped by task
6. **Task Modal** - Full-screen overlay for viewing/editing tasks and creating documents

### Task Modal Features

The modal opens in **view mode** by default and can switch to **edit mode**:

**View Mode:**
- Task name displayed as a prominent heading
- Link shown as clickable URL (or "No link yet" placeholder)
- Sub-tasks list with completion toggle
- Documents section with list of task documents
- "Create Document" button to add new documents
- Close button (X) in header
- Edit button to switch to edit mode
- Keyboard: Escape to close

**Edit Mode:**
- Task name input (required)
- Link input with icon and clear button
- Sub-tasks list with completion toggle and remove buttons
- Add sub-task input
- Save/Cancel actions
- Keyboard: Enter to save, Escape to cancel (returns to view mode)

**Shared:**
- Animated backdrop blur (180ms ease-out)

### DocumentsView (`src/components/documents-view.tsx`)

Displays all documents organized by task:

- Collapsible task sections (tasks with documents expanded by default)
- Document count badge per task
- Document list showing title, date, and content preview
- Click document to open editor
- "Add document" button per task section

### DocumentEditor (`src/components/document-editor.tsx`)

Rich text editor built with Tiptap:

**Toolbar Buttons:**
- Bold, Italic, Underline, Strikethrough
- Heading 1, 2, 3
- Bullet List, Numbered List
- Blockquote, Code Block
- Link (with URL input popup)
- Horizontal Rule
- Undo, Redo

**Keyboard Shortcuts:**
- `Cmd/Ctrl + B` - Bold
- `Cmd/Ctrl + I` - Italic
- `Cmd/Ctrl + U` - Underline
- `Cmd/Ctrl + Shift + S` - Strikethrough
- `Cmd/Ctrl + Z` - Undo
- `Cmd/Ctrl + Shift + Z` - Redo

**Slash Commands:**
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

1. Update the `Item` type in `item-list.tsx`
2. Add corresponding state variable (`editing{Field}`)
3. Initialize in `openEditor()`, reset in `closeEditor()`
4. Persist in `saveEdit()`, reset in `cancelEditMode()`
5. Add UI in both view mode (read-only display) and edit mode (input field)
6. Display in list/column views if needed

### Adding a New Column

1. Add to `COLUMNS` array
2. TypeScript will enforce `ColumnId` updates automatically

### Adding Document Fields

1. Update `DocumentRecord` interface in `src/lib/db.ts`
2. Update `useDocumentStore` hook to handle new fields
3. Update `DocumentEditorModal` to display/edit new fields

### Local Persistence

Data is automatically persisted to IndexedDB via Dexie.js. The hooks handle:

- **Hydration**: Loads saved data on mount (shows loading spinner)
- **Auto-save**: Debounced writes (300ms) when state changes
- **Fallback**: Works in memory-only mode if IndexedDB is unavailable

Database schema (`src/lib/db.ts`):
- `tasks` table: Stores task items indexed by `id`
- `documents` table: Stores documents indexed by `id` and `taskId`
- `settings` table: Stores `columnById` and `viewMode` preferences

To add cloud sync in the future, you could:
1. **Database API**: Add API routes and sync with the hook
2. **Real-time**: Consider Supabase or Firebase for live sync

### Adding New UI Components

```bash
# Using shadcn/ui CLI
npx shadcn@latest add [component-name]
```

Components are added to `src/components/ui/`.

## Icons

Using Lucide React. Currently imported:

```typescript
import {
  Circle,        // Incomplete sub-task
  CheckCircle2,  // Completed sub-task
  X,             // Remove/close buttons
  Plus,          // Add buttons
  Link2,         // Link input icon
  ExternalLink,  // Open link icon
  Pencil,        // Edit button icon
  Loader2,       // Loading spinner
  FileText,      // Document icon
  ChevronDown,   // Expanded section
  ChevronRight,  // Collapsed section
  Calendar,      // Date display
  Trash2,        // Delete button
  Bold,          // Editor toolbar
  Italic,        // Editor toolbar
  Underline,     // Editor toolbar
  Strikethrough, // Editor toolbar
  Heading1,      // Editor toolbar
  Heading2,      // Editor toolbar
  Heading3,      // Editor toolbar
  List,          // Editor toolbar (bullet)
  ListOrdered,   // Editor toolbar (numbered)
  Quote,         // Editor toolbar
  Code,          // Editor toolbar
  Minus,         // Editor toolbar (divider)
  Undo,          // Editor toolbar
  Redo,          // Editor toolbar
} from "lucide-react";
```

Browse available icons at [lucide.dev](https://lucide.dev/icons/).

## Notes

- Dark mode is enabled by default via `className="dark"` on `<html>` in `layout.tsx`
- **Data persists across browser sessions** via IndexedDB (tasks and documents survive tab closes and refreshes)
- The modals use inline styles for precise animation control
- The task modal opens in view mode by default; click Edit to modify task details
- Sub-task completion can be toggled in both view and edit modes
- Sub-task completion auto-moves tasks from "Not started" to "In progress"
- Links open in new tabs with `rel="noopener noreferrer"` for security
- IDs are generated using `crypto.randomUUID()` with a fallback for older browsers
- Data is stored in the browser's IndexedDB under the database name "khatwa"
- Documents are associated with tasks via `taskId` reference
- Document content is stored as Tiptap JSON format for rich text
- Documents auto-save while editing (500ms debounce)
- The document editor uses `immediatelyRender: false` for Next.js SSR compatibility
