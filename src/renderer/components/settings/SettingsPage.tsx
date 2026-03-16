import React, { useEffect, useState } from 'react';
import { useToastStore } from '../../stores/toast-store';
import { useThemeStore } from '../../stores/theme-store';

interface ManagedFolder {
  id: number;
  path: string;
  label: string;
  is_active: number;
  watch_mode: string;
}

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

export default function SettingsPage() {
  const [folders, setFolders] = useState<ManagedFolder[]>([]);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiForm, setShowApiForm] = useState(false);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const addToast = useToastStore(s => s.addToast);
  const [newFolderPath, setNewFolderPath] = useState('');
  const [newFolderLabel, setNewFolderLabel] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [appVersion, setAppVersion] = useState('0.1.0');

  useEffect(() => {
    loadData();

    // Fetch app version
    window.api?.invoke('app:get-version').then((v: unknown) => {
      if (typeof v === 'string') setAppVersion(v);
    }).catch(() => {});

    // Listen for updater events
    const unsubs = [
      window.api?.on('updater:checking', () => setUpdateStatus('checking')),
      window.api?.on('updater:available', () => setUpdateStatus('available')),
      window.api?.on('updater:not-available', () => {
        setUpdateStatus('not-available');
        addToast('info', 'You are on the latest version');
      }),
      window.api?.on('updater:download-progress', (...args: unknown[]) => {
        setUpdateStatus('downloading');
        const progress = args[0] as { percent?: number };
        if (progress?.percent) setDownloadProgress(Math.round(progress.percent));
      }),
      window.api?.on('updater:downloaded', () => {
        setUpdateStatus('downloaded');
        addToast('success', 'Update downloaded — ready to install');
      }),
      window.api?.on('updater:error', () => {
        setUpdateStatus('error');
        addToast('error', 'Update check failed');
      }),
    ];

    return () => { unsubs.forEach(fn => fn?.()); };
  }, []);

  const loadData = async () => {
    const [f, hasKey, organizedRoot, scanDepth] = await Promise.all([
      window.api.invoke('settings:get-folders') as Promise<ManagedFolder[]>,
      window.api.invoke('gemini:has-key') as Promise<boolean>,
      window.api.invoke('settings:get', 'organized_root') as Promise<string>,
      window.api.invoke('settings:get', 'scan_depth') as Promise<number>,
    ]);
    setFolders(f);
    setHasGeminiKey(hasKey);
    setSettings({ organized_root: organizedRoot, scan_depth: scanDepth });
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    try {
      await window.api.invoke('gemini:set-key', apiKeyInput.trim());
      setHasGeminiKey(true);
      setApiKeyInput('');
      setShowApiForm(false);
      addToast('success', 'API key saved successfully');
    } catch {
      addToast('error', 'Failed to save API key');
    }
  };

  const handleAddFolder = async () => {
    if (!newFolderPath.trim()) return;
    try {
      await window.api.invoke('settings:set-folders', 'add', {
        path: newFolderPath.trim(),
        label: newFolderLabel.trim() || newFolderPath.trim().split('/').pop(),
        watchMode: 'notify',
      });
      setNewFolderPath('');
      setNewFolderLabel('');
      await loadData();
      addToast('success', 'Folder added');
    } catch {
      addToast('error', 'Failed to add folder');
    }
  };

  const handleRemoveFolder = async (id: number) => {
    try {
      await window.api.invoke('settings:set-folders', 'remove', { id });
      await loadData();
      addToast('info', 'Folder removed');
    } catch {
      addToast('error', 'Failed to remove folder');
    }
  };

  const handleToggleFolder = async (id: number, isActive: boolean) => {
    try {
      await window.api.invoke('settings:set-folders', 'update', {
        id,
        updates: { is_active: isActive ? 1 : 0 },
      });
      await loadData();
    } catch {
      addToast('error', 'Failed to update folder');
    }
  };

  const settingsSaveTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSaveSetting = (key: string, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // Debounce IPC writes for text/number inputs
    if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
    settingsSaveTimer.current = setTimeout(async () => {
      try {
        await window.api.invoke('settings:set', key, value);
      } catch {
        addToast('error', `Failed to save ${key}`);
      }
    }, 500);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-[Sora]">Settings</h1>
        <p className="text-muted text-sm mt-1">Configure DeskPilot preferences.</p>
      </div>

      {/* Managed Folders */}
      <div className="v-card p-5">
        <h2 className="section-label mb-4">Managed Folders</h2>
        <div className="space-y-2 mb-4">
          {folders.map(folder => (
            <div key={folder.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-hover/50">
              <input
                type="checkbox"
                checked={!!folder.is_active}
                onChange={(e) => handleToggleFolder(folder.id, e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-foreground">{folder.label}</span>
                <span className="text-xs text-faint block truncate font-mono">{folder.path}</span>
              </div>
              <span className="text-xs font-mono text-accent px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/20">{folder.watch_mode}</span>
              <button
                onClick={() => handleRemoveFolder(folder.id)}
                className="text-xs text-danger px-2 py-1 rounded-lg hover:bg-danger/10 hover:text-red-400 transition-colors cursor-pointer"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* Add folder */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newFolderPath}
            onChange={(e) => setNewFolderPath(e.target.value)}
            placeholder="Folder path (e.g., C:/Users/..."
            className="flex-1 px-3 py-2 bg-card border border-edge rounded-xl text-sm text-foreground placeholder:text-faint focus:outline-none focus:border-accent"
          />
          <input
            type="text"
            value={newFolderLabel}
            onChange={(e) => setNewFolderLabel(e.target.value)}
            placeholder="Label"
            className="w-28 px-3 py-2 bg-card border border-edge rounded-xl text-sm text-foreground placeholder:text-faint focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleAddFolder}
            className="btn-primary rounded-xl px-4 py-2 text-sm font-medium cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>

      {/* Gemini API Key */}
      <div className="v-card p-5">
        <h2 className="section-label mb-2">Gemini AI</h2>
        <p className="text-xs text-faint mb-3">
          Used for classifying ambiguous files that don't match any rule.
          Key is encrypted and stored locally.
        </p>

        {hasGeminiKey ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-success">API key configured</span>
            <button
              onClick={() => { setShowApiForm(true); setHasGeminiKey(false); }}
              className="text-xs text-faint hover:text-muted cursor-pointer"
            >
              Change
            </button>
          </div>
        ) : showApiForm ? (
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Paste Gemini API key..."
              className="flex-1 px-3 py-2 bg-card border border-edge rounded-xl text-sm text-foreground placeholder:text-faint focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleSaveApiKey}
              className="btn-primary rounded-xl px-4 py-2 text-sm font-medium cursor-pointer"
            >
              Save
            </button>
            <button
              onClick={() => setShowApiForm(false)}
              className="px-3 py-2 text-faint text-sm cursor-pointer hover:text-muted"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowApiForm(true)}
            className="text-sm text-accent hover:text-accent-hover cursor-pointer"
          >
            + Add API Key
          </button>
        )}
      </div>

      {/* Organization Settings */}
      <div className="v-card p-5">
        <h2 className="section-label mb-4">Organization</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-faint block mb-1">Organized Root Folder</label>
            <input
              type="text"
              value={(settings.organized_root as string) || ''}
              onChange={(e) => handleSaveSetting('organized_root', e.target.value)}
              className="w-full px-3 py-2 bg-card border border-edge rounded-xl text-sm text-foreground font-mono focus:outline-none focus:border-accent"
            />
            <p className="text-xs text-faint mt-1">Files will be organized into subfolders under this path.</p>
          </div>

          <div>
            <label className="text-xs text-faint block mb-1">Scan Depth</label>
            <input
              type="number"
              value={(settings.scan_depth as number) || 5}
              onChange={(e) => handleSaveSetting('scan_depth', parseInt(e.target.value))}
              min={1}
              max={20}
              className="w-20 px-3 py-2 bg-card border border-edge rounded-xl text-sm text-foreground focus:outline-none focus:border-accent"
            />
            <p className="text-xs text-faint mt-1">How deep to scan into folder hierarchies.</p>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="v-card p-5">
        <h2 className="section-label mb-4">Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground font-medium">Theme</p>
            <p className="text-xs text-faint mt-0.5">Switch between dark and light mode.</p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Updates */}
      <div className="v-card p-5">
        <h2 className="section-label mb-3">Updates</h2>
        <div className="flex items-center gap-4">
          {updateStatus === 'idle' && (
            <button
              onClick={() => window.api?.invoke('updater:check')}
              className="btn-primary rounded-xl px-5 py-2.5 text-sm font-medium cursor-pointer"
            >
              Check for Updates
            </button>
          )}
          {updateStatus === 'checking' && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted">Checking for updates...</span>
            </div>
          )}
          {updateStatus === 'available' && (
            <button
              onClick={() => window.api?.invoke('updater:download')}
              className="btn-primary rounded-xl px-5 py-2.5 text-sm font-medium cursor-pointer"
            >
              Download Update
            </button>
          )}
          {updateStatus === 'downloading' && (
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-muted">Downloading update...</span>
                <span className="text-xs font-mono text-accent">{downloadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-edge/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${downloadProgress}%`,
                    background: 'linear-gradient(90deg, #7C5CFC, #A78BFA)',
                  }}
                />
              </div>
            </div>
          )}
          {updateStatus === 'downloaded' && (
            <button
              onClick={() => window.api?.invoke('updater:install')}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold cursor-pointer text-white"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
            >
              Install & Restart
            </button>
          )}
          {updateStatus === 'not-available' && (
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span className="text-sm text-muted">Up to date</span>
              <button
                onClick={() => setUpdateStatus('idle')}
                className="text-xs text-faint hover:text-muted cursor-pointer ml-2"
              >
                Check again
              </button>
            </div>
          )}
          {updateStatus === 'error' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-danger">Update check failed</span>
              <button
                onClick={() => { setUpdateStatus('idle'); }}
                className="text-xs text-faint hover:text-muted cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* About */}
      <div className="v-card p-5 bg-gradient-to-br from-card to-surface/50">
        <h2 className="section-label mb-2">About</h2>
        <p className="text-sm">
          <span className="bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent font-bold">DeskPilot</span>
          {' '}
          <span className="font-mono text-xs text-muted">v{appVersion}</span>
        </p>
        <p className="text-xs text-faint mt-1">Smart desktop file management. Never deletes without asking.</p>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="relative w-16 h-8 rounded-full transition-colors duration-300 cursor-pointer"
      style={{ background: isDark ? 'rgba(124, 92, 252, 0.2)' : 'rgba(124, 92, 252, 0.12)' }}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <div
        className="absolute top-1 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
        style={{
          left: isDark ? '2.25rem' : '0.25rem',
          background: isDark ? '#7C5CFC' : '#F0C246',
          boxShadow: isDark ? '0 0 8px rgba(124,92,252,0.4)' : '0 0 8px rgba(240,194,70,0.4)',
        }}
      >
        {isDark ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="white" strokeWidth="2" fill="none" />
          </svg>
        )}
      </div>
    </button>
  );
}
