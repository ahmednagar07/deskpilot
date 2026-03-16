import React, { useEffect, useState } from 'react';
import { useToastStore } from '../../stores/toast-store';

interface ManagedFolder {
  id: number;
  path: string;
  label: string;
  is_active: number;
  watch_mode: string;
}

export default function SettingsPage() {
  const [folders, setFolders] = useState<ManagedFolder[]>([]);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiForm, setShowApiForm] = useState(false);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const addToast = useToastStore(s => s.addToast);
  const [newFolderPath, setNewFolderPath] = useState('');
  const [newFolderLabel, setNewFolderLabel] = useState('');

  useEffect(() => {
    loadData();
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
    await window.api.invoke('gemini:set-key', apiKeyInput.trim());
    setHasGeminiKey(true);
    setApiKeyInput('');
    setShowApiForm(false);
    addToast('success', 'API key saved successfully');
  };

  const handleAddFolder = async () => {
    if (!newFolderPath.trim()) return;
    await window.api.invoke('settings:set-folders', 'add', {
      path: newFolderPath.trim(),
      label: newFolderLabel.trim() || newFolderPath.trim().split('/').pop(),
      watchMode: 'notify',
    });
    setNewFolderPath('');
    setNewFolderLabel('');
    await loadData();
    addToast('success', 'Folder added');
  };

  const handleRemoveFolder = async (id: number) => {
    await window.api.invoke('settings:set-folders', 'remove', { id });
    await loadData();
    addToast('info', 'Folder removed');
  };

  const handleToggleFolder = async (id: number, isActive: boolean) => {
    await window.api.invoke('settings:set-folders', 'update', {
      id,
      updates: { is_active: isActive ? 1 : 0 },
    });
    await loadData();
  };

  const handleSaveSetting = async (key: string, value: unknown) => {
    await window.api.invoke('settings:set', key, value);
    setSettings(prev => ({ ...prev, [key]: value }));
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

      {/* About */}
      <div className="v-card p-5 bg-gradient-to-br from-card to-surface/50">
        <h2 className="section-label mb-2">About</h2>
        <p className="text-sm">
          <span className="bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent font-bold">DeskPilot</span>
          {' '}
          <span className="font-mono text-xs text-muted">v0.1.0</span>
        </p>
        <p className="text-xs text-faint mt-1">Smart desktop file management. Never deletes without asking.</p>
      </div>
    </div>
  );
}
