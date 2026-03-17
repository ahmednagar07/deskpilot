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

## Current State — v0.6.0 Smart Context-Aware Organization
All 6 pages fully implemented + premium UI + security hardening + light/dark theme + i18n everywhere + scheduled auto-scans + batch rename + cross-platform builds.

### v0.6.0 Smart Organization + Progress Bar (2026-03-17)
- **Context-aware organization**: Files in client/project paths (detected via `path_contains` rules) are organized into subfolders: `Organized/Clients/LOC/file.pdf` instead of flat `Organized/Documents/file.pdf`. Files without context fall back to type-based folders.
- **"0 files moved" fix**: Cross-drive `crossDriveMove()` now separates copy success from trash success. If copy succeeds but `shell.trashItem()` fails, move counts as succeeded with a warning — file IS at destination.
- **Move progress overlay**: Real-time progress bar with percentage, ETA, current file name, and bytes processed/total during file moves.
- **Browse button**: Native folder picker (`dialog.showOpenDialog`) for destination folder — no more manual path typing.
- **Better error reporting**: Failed moves show first error reason in the result banner. Warnings shown for files copied but source not trashed.
- **IPC channels**: Added `organizer:move-progress` (progress events), `dialog:open-folder` (native folder picker).

### v0.5.x Changes (2026-03-17)
- **v0.5.1**: Folder-scoped scanning — Scanner and Organizer only process files from selected folders (SQL LIKE scoping). Organizer folder picker with checkboxes.
- **v0.5.2**: Stats bar consistency — stats derived from `files` array (same source as category list). Toast uses actual classified count. Drive analysis shows "instant" badge for same-drive moves.
- **v0.5.3**: Test AI button — Scanner page has "Test AI" link that sends 5 sample paths to Gemini and shows model name, per-file category/confidence/reason. Added `gemini:test` IPC channel.
- **v0.5.4**: Destination folder picker — Organizer shows Source → Destination layout with editable path input that saves to settings on blur.

### Pages
1. **Dashboard** — gradient stat cards, storage donut, recent activity, quick actions
2. **Storage Analyzer** — drive cards, temp/cache/large file scanner, duplicate finder, cleanup to Recycle Bin
3. **File Scanner** — managed folder discovery, rule-based + Gemini AI classification
4. **Auto-Organizer** — move plan generation, approve/execute, full undo history, drag-and-drop reclassification
5. **Search** — FTS5 instant search, Ctrl+Space overlay window, category badges
6. **Settings** — managed folders, Gemini API key (encrypted), organized root, scan depth, auto-scan interval, theme toggle, language selector

### Backend Modules
- Storage analyzer: recursive scanner, pattern matching, 3-phase duplicate finder, cleanup
- File classifier: rule engine (50+ rules, priority-ordered), Gemini 3.1 Flash Lite fallback
- Auto-organizer: move plan generation, name suggester, batch rename, cross-drive safe move, undo
- Quick search: FTS5 with prefix matching + LIKE fallback, overlay window
- Background watcher: Chokidar watches managed folders, notifications for new files
- Weekly digest: scheduled stats summary notification (12h check interval)
- Auto-scan scheduler: configurable interval (1/6/12/24h), rules-only (no API cost)

### v0.3.0 Scheduled Scans + Batch Rename + Full i18n (2026-03-16)
- **Scheduled auto-scans**: Configurable interval (1/6/12/24h or disabled) in Settings. Rules-only scanning (no API cost). Runs in background with `auto-scan.ts` module
- **Batch rename**: "Clean Names" button in Organizer previews junk pattern removal (Copy of, Untitled, trailing numbers, etc.), then renames with collision resolution + undo logging
- **Full i18n coverage**: All pages (Dashboard, Storage, Scanner, Organizer, Search, Settings) now use `t()` for all user-facing strings
- **Loading skeletons**: StoragePage shows skeleton UI while drives load
- **IPC channels**: Added `auto-scan:get-interval`, `auto-scan:set-interval`, `auto-scan:run-now`, `auto-scan:last-run`, `batch-rename:preview`, `batch-rename:execute`
- **Version bump**: 0.2.0 → 0.3.0

### v0.2.0 Cross-Platform + i18n + Audit (2026-03-16)
- **Custom app icon**: Generated DeskPilot "DP" monogram icon (resources/icon.ico, icon.png, tray-icon.png) via `scripts/generate-icons.mjs`
- **Test coverage**: 72 tests across 6 suites (added rule-engine, move-executor, duplicate-finder)
- **Cross-platform builds**: `electron-builder.yml` targets for Windows (NSIS + portable), macOS (DMG + ZIP), Linux (AppImage + deb)
- **Build scripts**: `npm run dist:win`, `dist:mac`, `dist:linux`, `dist:all`, `generate-icons`
- **Performance**: `React.memo` on PlanGroup/CategoryGroup, `useMemo` for grouped computations and approvedCount
- **Accessibility**: ARIA roles/labels on nav, title bar, toast container; `aria-current="page"` on active nav; `aria-live="polite"` on toasts; `:focus-visible` ring; `.sr-only` class; skip-to-content link; semantic `<header>`/`<main>`/`<nav>`
- **Auto-update CI**: `.github/workflows/release.yml` — builds Win/Mac/Linux on tag push, publishes to GitHub Releases with `--publish always`
- **Auto-update startup**: `checkForUpdates()` runs 5s after launch (skipped in dev mode via `app.isPackaged`)
- **i18n system**: Lightweight Zustand-based i18n (`src/renderer/i18n/index.ts`) with `useI18n()` hook, `t()` function with variable interpolation, RTL support
- **Translations**: English + Arabic (en.json, ar.json) with language selector in Settings → Appearance
- **Gemini model fix**: Changed to `gemini-3.1-flash-lite-preview` (correct model ID)
- **API key security**: Moved Gemini API key from URL query string to `x-goog-api-key` header
- **Sandbox enabled**: Both dashboard and search windows now use `sandbox: true`
- **Duplicate delete fix**: Wrapped `handleDeleteDuplicates` in try/finally to prevent permanent UI lock; added `clearDuplicateSelection()` store action
- **Path separator fix**: `buildDestPath` in OrganizerPage uses `/` instead of hard-coded `\\`
- **Settings error handling**: `loadData()` wrapped in try/catch with toast on failure
- **parseInt guard**: `scan_depth` input validates with `parseInt(value, 10)` and `!isNaN` check
- **Timer cleanup**: Settings debounce timer cleared on component unmount
- **Dock fix**: Floating category dock now renders `dockCategories` (excluding in-plan categories) instead of all categories

### v0.1.2 Light/Dark Theme + Audit Fixes (2026-03-16)
- **Light/dark theme system**: CSS custom properties (`--t-*` variables) on `:root` (dark) and `[data-theme="light"]` (light)
- **Theme store**: `src/renderer/stores/theme-store.ts` — Zustand + localStorage persistence, applies before React render
- **Theme toggle**: Sidebar bottom + Settings page "Appearance" section with animated pill toggle
- **Watcher reload fix**: `startWatching()` called after folder add/update/remove in `ipc-handlers.ts`
- **Digest date filter fix**: `bytesReclaimed` query now scoped to 7-day window via `scanned_at >= ?`
- **Dashboard O(n²) fix**: Hoisted `maxCount` outside `.map()` loop
- **Classifier optimization**: `Map` lookup for categories instead of O(n) `.find()` per file
- **All components themed**: TitleBar, Sidebar, DashboardPage, Toast, FirstRunWizard, SettingsPage use `var(--t-*)` variables
- **React 19 useRef fix**: Pass `undefined` as initial value (`useRef<T>(undefined)`)

### v1.1 Additions (2026-03-16)
- **UI Redesign**: "Void Terminal" dark theme — Sora/DM Sans/JetBrains Mono fonts, holographic card edges, mesh gradient backgrounds, noise texture overlay, glass effects
- **First-run wizard**: 3-step onboarding (welcome → select folders → API key)
- **Toast notifications**: Global toast system for success/error/warning feedback
- **Search overlay**: Frameless transparent window via Ctrl+Space global shortcut
- **Duplicate finder UI**: Integrated into Storage page with group-by-hash display
- **Weekly digest**: Scheduled notification summarizing files discovered/organized/reclaimed
- **Windows installer**: NSIS installer via electron-builder (99MB .exe)

### v1.2 Security Audit Fixes (2026-03-16)
- **IPC channel allowlist**: Preload validates all IPC channels against `IpcChannels` constants
- **Path validation**: `isPathInManagedScope()` for shell/file operations
- **Scanner stability**: `try/finally` to always reset `scanning` flag
- **Cross-drive safety**: Cleanup partial destination file on `copyFile` failure
- **Error UX**: `friendlyMoveError()` maps system error codes to human messages

### Design System
- Colors: `@theme` block in globals.css references `var(--t-*)` CSS variables (~40 properties per theme)
- Dark: surface=#0a0a14, accent=#7C5CFC, foreground=#E8E6F0
- Light: surface=#F4F2F7, accent=#6C4FE0, foreground=#1A1A2E, card=#FFFFFF
- Cards: `.v-card` (holographic top edge), `.stat-card` (gradient glow)
- Buttons: `.btn-primary` (purple gradient), `.btn-danger` (red gradient)
- Utilities: `.bg-mesh`, `.noise`, `.page-enter`, `.skeleton`, `.section-label`
- Fonts: Sora (headings), DM Sans (body), JetBrains Mono (code)

## Key Decisions
- better-sqlite3 rebuilt for Electron via electron-rebuild
- Tailwind v4 `@theme` with single-word tokens (surface, card, accent, foreground, etc.)
- **CRITICAL**: Never add unlayered `*` resets in globals.css — breaks all Tailwind utilities due to CSS cascade layers
- Frameless window with custom title bar
- Gemini API key encrypted via safeStorage (Windows DPAPI) + sent via `x-goog-api-key` header (not URL query)
- Gemini model: `gemini-3.1-flash-lite-preview` (docs: https://ai.google.dev/gemini-api/docs/models)
- Cross-drive moves: copy → verify size → delete source (with partial cleanup on failure)
- All file deletions go to Recycle Bin via shell.trashItem()
- Every move logged in move_log table for full undo support
- electron in devDependencies (not dependencies) for electron-builder
- `signAndEditExecutable: false` in electron-builder.yml (no code-signing cert)
- `sandbox: true` on all BrowserWindow webPreferences

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
- Watcher: src/main/modules/background-watcher/{watcher,notification,digest,auto-scan}.ts
- FS helpers: src/main/utils/fs-helpers.ts
- Preload: src/preload/index.ts
- App: src/renderer/App.tsx
- Pages: src/renderer/components/{dashboard,storage,scanner,organizer,search,settings}/*Page.tsx
- Wizard: src/renderer/components/wizard/FirstRunWizard.tsx
- Search overlay: src/renderer/components/search/SearchOverlay.tsx
- Toast: src/renderer/components/shared/Toast.tsx
- Stores: src/renderer/stores/{storage,scan,organizer,toast,search,theme}-store.ts
- Layout: src/renderer/components/layout/{Sidebar,TitleBar}.tsx
- Hooks: src/renderer/hooks/useIpc.ts
- i18n: src/renderer/i18n/{index.ts,en.json,ar.json}
- Shared: src/shared/{ipc-channels,types,constants}.ts
- Tests: tests/{name-suggester,fs-helpers,digest,rule-engine,move-executor,duplicate-finder}.test.ts
- Styles: src/renderer/styles/globals.css
- Icons: scripts/generate-icons.mjs → resources/{icon.ico,icon.png,tray-icon.png}
- CI: .github/workflows/release.yml

## Build Commands
- `npm run dev` — concurrent main watch + vite dev server (port 5173)
- `npm run build` — compile main TS + build renderer
- `npm run start` — launch electron (build first)
- `npm run rebuild` — rebuild native modules for Electron
- `npm test` — run Vitest (72 tests, 6 suites)
- `npm run dist:win` — build Windows NSIS + portable installer
- `npm run dist:mac` — build macOS DMG + ZIP
- `npm run dist:linux` — build Linux AppImage + deb
- `npm run dist:all` — build all platforms
- `npm run generate-icons` — regenerate app icons from SVG template
- CI release: push a `v*` tag → GitHub Actions builds all platforms + publishes to GitHub Releases
