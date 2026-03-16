# DeskPilot — Development Status

## Project
Smart desktop management app: organizes files, cleans storage, finds anything instantly.
Electron + React + Tailwind + SQLite + Gemini API.

## Completed Iterations
- [x] Iteration 1: Project Scaffold + Electron Shell (2026-03-16)
- [x] Iteration 2: Database + IPC Wiring (2026-03-16)
- [x] Iteration 3+4: Storage Analyzer Backend + UI (2026-03-16)
- [x] Iteration 5: File Classifier Backend (2026-03-16)
- [x] Iteration 6: File Scanner UI (2026-03-16)
- [x] Iteration 7: Auto-Organizer Backend + UI (2026-03-16)
- [x] Iteration 8: Quick Search (2026-03-16)
- [x] Iteration 9: Background Watcher (2026-03-16)
- [x] Iteration 10: Dashboard + Settings (2026-03-16)

## Current State — v1.2 Security Audit Complete
All 6 pages fully implemented + premium UI redesign + security hardening + installer ready.

### Pages
1. **Dashboard** — gradient stat cards, storage donut, recent activity, quick actions
2. **Storage Analyzer** — drive cards, temp/cache/large file scanner, duplicate finder, cleanup to Recycle Bin
3. **File Scanner** — managed folder discovery, rule-based + Gemini AI classification
4. **Auto-Organizer** — move plan generation, approve/execute, full undo history
5. **Search** — FTS5 instant search, Ctrl+Space overlay window, category badges
6. **Settings** — managed folders, Gemini API key (encrypted), organized root, scan depth

### Backend Modules
- Storage analyzer: recursive scanner, pattern matching, 3-phase duplicate finder, cleanup
- File classifier: rule engine (50+ rules, priority-ordered), Gemini 2.0 Flash fallback
- Auto-organizer: move plan generation, name suggester, cross-drive safe move, undo
- Quick search: FTS5 with prefix matching + LIKE fallback, overlay window
- Background watcher: Chokidar watches managed folders, notifications for new files
- Weekly digest: scheduled stats summary notification (12h check interval)

### v1.2 Security Audit Fixes (2026-03-16)
- **IPC channel allowlist**: Preload now validates all IPC channels against `IpcChannels` constants — rejects unknown channels
- **Path validation**: `SHELL_OPEN_FILE`, `SHELL_OPEN_FOLDER`, `STORAGE_DELETE_DUPLICATE` now validate paths against managed folders + organized root via `isPathInManagedScope()`
- **IPC constants**: All inline IPC channel strings in `ipc-handlers.ts` replaced with `IpcChannels.*` constants
- **Scanner stability**: `runStorageScan` uses `try/finally` to always reset `scanning` flag, preventing permanent scan lock on errors
- **Cross-drive safety**: `crossDriveMove` cleans up partial destination file if `copyFile` fails mid-write
- **Expanded classification rules**: Migration 003 adds ~100 rules (medicine, clients, projects, learning, documents, design, archive, media, tools)
- **Organizer performance**: Groups collapsed by default + pagination (50 items/page) to handle 17K+ files without DOM freeze
- **Error UX**: `friendlyMoveError()` maps EBUSY/EPERM/EACCES/ENAMETOOLONG/ENOSPC/ENOENT to human-readable messages
- **Auto-updater**: `electron-updater` integration with check/download/install IPC channels

### v1.1 Additions (2026-03-16)
- **UI Redesign**: "Void Terminal" dark theme — Sora/DM Sans/JetBrains Mono fonts, holographic card edges, mesh gradient backgrounds, noise texture overlay, glass effects
- **First-run wizard**: 3-step onboarding (welcome → select folders → API key)
- **Toast notifications**: Global toast system for success/error/warning feedback
- **Search overlay**: Frameless transparent window via Ctrl+Space global shortcut
- **Duplicate finder UI**: Integrated into Storage page with group-by-hash display
- **Weekly digest**: Scheduled notification summarizing files discovered/organized/reclaimed
- **Vitest tests**: 30 tests across 3 suites (name-suggester, fs-helpers, digest)
- **Windows installer**: NSIS installer via electron-builder (99MB .exe)

### Design System
- Colors: `@theme` block in globals.css — surface=#0a0a14, accent=#7C5CFC, foreground=#E8E6F0
- Cards: `.v-card` (holographic top edge), `.stat-card` (gradient glow)
- Buttons: `.btn-primary` (purple gradient), `.btn-danger` (red gradient)
- Utilities: `.bg-mesh`, `.noise`, `.page-enter`, `.skeleton`, `.section-label`
- Fonts: Sora (headings), DM Sans (body), JetBrains Mono (code)

## Key Decisions
- better-sqlite3 rebuilt for Electron via electron-rebuild
- Tailwind v4 `@theme` with single-word tokens (surface, card, accent, foreground, etc.)
- **CRITICAL**: Never add unlayered `*` resets in globals.css — breaks all Tailwind utilities due to CSS cascade layers
- Frameless window with custom title bar
- Gemini API key encrypted via safeStorage (Windows DPAPI)
- Cross-drive moves: copy → verify size → delete source (with partial cleanup on failure)
- All file deletions go to Recycle Bin via shell.trashItem()
- Every move logged in move_log table for full undo support
- electron in devDependencies (not dependencies) for electron-builder
- `signAndEditExecutable: false` in electron-builder.yml (no code-signing cert)

## File Map
- Main entry: src/main/index.ts
- Tray: src/main/tray.ts
- Windows: src/main/windows.ts
- IPC handlers: src/main/ipc-handlers.ts
- Global shortcut: src/main/global-shortcut.ts
- DB connection: src/main/database/connection.ts
- Migrations: src/main/database/migrations/*.sql
- Repos: src/main/database/repositories/{file,move-log,category,settings,scan}-repo.ts
- Storage: src/main/modules/storage-analyzer/{scanner,patterns,cleaner,duplicate-finder}.ts
- Classifier: src/main/modules/file-classifier/{classifier,rule-engine,gemini-client,categories}.ts
- Organizer: src/main/modules/auto-organizer/{organizer,move-executor,name-suggester,undo-manager}.ts
- Search: src/main/modules/quick-search/searcher.ts
- Watcher: src/main/modules/background-watcher/{watcher,notification,digest}.ts
- FS helpers: src/main/utils/fs-helpers.ts
- Preload: src/preload/index.ts
- App: src/renderer/App.tsx
- Pages: src/renderer/components/{dashboard,storage,scanner,organizer,search,settings}/*Page.tsx
- Wizard: src/renderer/components/wizard/FirstRunWizard.tsx
- Search overlay: src/renderer/components/search/SearchOverlay.tsx
- Toast: src/renderer/components/shared/Toast.tsx
- Stores: src/renderer/stores/{storage,scan,organizer,toast,search}-store.ts
- Layout: src/renderer/components/layout/{Sidebar,TitleBar}.tsx
- Hooks: src/renderer/hooks/useIpc.ts
- Shared: src/shared/{ipc-channels,types,constants}.ts
- Tests: tests/{name-suggester,fs-helpers,digest}.test.ts
- Styles: src/renderer/styles/globals.css

## Build Commands
- `npm run dev` — concurrent main watch + vite dev server (port 5173)
- `npm run build` — compile main TS + build renderer
- `npm run start` — launch electron (build first)
- `npm run rebuild` — rebuild native modules for Electron
- `npm test` — run Vitest (30 tests)
- `CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win` — build .exe installer
- Installer output: `release/DeskPilot Setup 0.1.0.exe`
