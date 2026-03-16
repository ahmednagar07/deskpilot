export const IpcChannels = {
  // Storage Analyzer
  STORAGE_SCAN_START: 'storage:scan:start',
  STORAGE_SCAN_PROGRESS: 'storage:scan:progress',
  STORAGE_SCAN_RESULT: 'storage:scan:result',
  STORAGE_CLEANUP: 'storage:cleanup',
  STORAGE_ABORT: 'storage:abort',
  STORAGE_SUMMARY: 'storage:summary',
  STORAGE_DRIVE_INFO: 'storage:drive-info',
  STORAGE_DRIVES: 'storage:drives',
  STORAGE_FIND_DUPLICATES: 'storage:find-duplicates',
  STORAGE_DELETE_DUPLICATE: 'storage:delete-duplicate',
  STORAGE_DUPLICATES_PROGRESS: 'storage:duplicates:progress',

  // File Scanner
  SCANNER_START: 'scanner:start',
  SCANNER_PROGRESS: 'scanner:progress',
  SCANNER_RESULT: 'scanner:result',
  SCANNER_CLASSIFY: 'scanner:classify',
  SCANNER_ABORT: 'scanner:abort',
  SCANNER_IS_RUNNING: 'scanner:is-running',

  // Categories
  CATEGORIES_GET_ALL: 'categories:get-all',
  CATEGORIES_GET: 'categories:get',

  // Files
  FILES_COUNT: 'files:count',
  FILES_BY_CATEGORY: 'files:by-category',
  FILES_UNORGANIZED: 'files:unorganized',

  // Activity / Move Log
  ACTIVITY_RECENT: 'activity:recent',
  ACTIVITY_SESSIONS: 'activity:sessions',

  // Auto-Organizer
  ORGANIZER_GENERATE_PLAN: 'organizer:generate-plan',
  ORGANIZER_EXECUTE: 'organizer:execute',
  ORGANIZER_UNDO: 'organizer:undo',
  ORGANIZER_UNDO_BATCH: 'organizer:undo-batch',
  ORGANIZER_HISTORY: 'organizer:history',
  ORGANIZER_SESSION_DETAILS: 'organizer:session-details',

  // Quick Search
  SEARCH_QUERY: 'search:query',
  SEARCH_REINDEX: 'search:reindex',
  SEARCH_RESIZE: 'search:resize',

  // Shell
  SHELL_OPEN_FILE: 'shell:open-file',
  SHELL_OPEN_FOLDER: 'shell:open-folder',

  // Gemini
  GEMINI_HAS_KEY: 'gemini:has-key',
  GEMINI_SET_KEY: 'gemini:set-key',

  // Background Watcher
  WATCHER_NEW_FILE: 'watcher:new-file',
  WATCHER_DIGEST: 'watcher:digest',
  WATCHER_COUNT: 'watcher:count',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_FOLDERS: 'settings:get-folders',
  SETTINGS_SET_FOLDERS: 'settings:set-folders',

  // App
  APP_GET_VERSION: 'app:get-version',
  APP_QUIT: 'app:quit',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  // Auto-Updater
  UPDATER_CHECK: 'updater:check',
  UPDATER_DOWNLOAD: 'updater:download',
  UPDATER_INSTALL: 'updater:install',
  UPDATER_CHECKING: 'updater:checking',
  UPDATER_AVAILABLE: 'updater:available',
  UPDATER_NOT_AVAILABLE: 'updater:not-available',
  UPDATER_DOWNLOAD_PROGRESS: 'updater:download-progress',
  UPDATER_DOWNLOADED: 'updater:downloaded',
  UPDATER_ERROR: 'updater:error',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
