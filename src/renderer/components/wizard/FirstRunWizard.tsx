import React, { useState } from 'react';

interface FolderEntry {
  path: string;
  label: string;
  checked: boolean;
}

const USERNAME = typeof process !== 'undefined' ? process.env?.USERNAME || 'User' : 'User';
const DEFAULT_FOLDERS: FolderEntry[] = [
  { path: `C:\\Users\\${USERNAME}\\Desktop`, label: 'Desktop', checked: true },
  { path: `C:\\Users\\${USERNAME}\\Downloads`, label: 'Downloads', checked: true },
];

export default function FirstRunWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [folders, setFolders] = useState<FolderEntry[]>(DEFAULT_FOLDERS);
  const [customPath, setCustomPath] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleFolder = (index: number) => {
    setFolders(prev => prev.map((f, i) => i === index ? { ...f, checked: !f.checked } : f));
  };

  const addCustomFolder = () => {
    const trimmed = customPath.trim();
    if (!trimmed) return;
    const label = trimmed.split(/[\\/]/).filter(Boolean).pop() || trimmed;
    setFolders(prev => [...prev, { path: trimmed, label, checked: true }]);
    setCustomPath('');
  };

  const handleFinish = async (skipApiKey = false) => {
    setSaving(true);
    try {
      // Save selected folders
      const selected = folders.filter(f => f.checked);
      for (const folder of selected) {
        await window.api.invoke('settings:set-folders', 'add', {
          path: folder.path,
          label: folder.label,
          watchMode: 'notify',
        });
      }

      // Save API key if provided
      if (!skipApiKey && apiKey.trim()) {
        await window.api.invoke('gemini:set-key', apiKey.trim());
      }

      // Mark setup as complete
      await window.api.invoke('settings:set', 'setup_complete', true);
      onComplete();
    } catch (err) {
      console.error('Wizard setup error:', err);
      // Still mark complete so user isn't stuck
      try {
        await window.api.invoke('settings:set', 'setup_complete', true);
      } catch {}
      onComplete();
    }
  };

  return (
    <div className="noise fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface bg-mesh">
      <div className="w-full max-w-lg px-4">
        <div className="page-enter" key={step}>
          {step === 0 && <StepWelcome onNext={() => setStep(1)} />}
          {step === 1 && (
            <StepFolders
              folders={folders}
              customPath={customPath}
              onCustomPathChange={setCustomPath}
              onAddCustom={addCustomFolder}
              onToggle={toggleFolder}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepApiKey
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
              onSkip={() => handleFinish(true)}
              onFinish={() => handleFinish(false)}
              saving={saving}
            />
          )}
        </div>

        {/* Step indicator dots */}
        <div className="flex items-center justify-center gap-2.5 mt-10">
          {[0, 1, 2].map(i => (
            <button
              key={i}
              onClick={() => { if (i < step) setStep(i); }}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                background: i === step ? '#7C5CFC' : i < step ? 'rgba(124, 92, 252, 0.4)' : 'rgba(78, 75, 107, 0.4)',
                boxShadow: i === step ? '0 0 12px rgba(124, 92, 252, 0.5)' : 'none',
                cursor: i < step ? 'pointer' : 'default',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Step 1: Welcome ── */
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="v-card p-10 flex flex-col items-center text-center">
      {/* Logo */}
      <div className="relative mb-8">
        <div className="absolute inset-0 blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, #7C5CFC, transparent 70%)' }} />
        <div
          className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #7C5CFC, #A78BFA)', boxShadow: '0 0 40px rgba(124,92,252,0.25)' }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="white" stroke="none">
            <rect x="3" y="3" width="7" height="7" rx="2" opacity="0.95" />
            <rect x="14" y="3" width="7" height="7" rx="2" opacity="0.6" />
            <rect x="3" y="14" width="7" height="7" rx="2" opacity="0.6" />
            <rect x="14" y="14" width="7" height="7" rx="2" opacity="0.35" />
          </svg>
        </div>
      </div>

      <h1
        className="text-3xl font-bold mb-3"
        style={{
          fontFamily: 'Sora, sans-serif',
          background: 'linear-gradient(90deg, #E8E6F0, #9B7FFF)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Welcome to DeskPilot
      </h1>
      <p className="text-muted text-sm max-w-sm mb-10 leading-relaxed">
        Smart desktop file management. Scan, classify, and organize your files
        with AI-powered intelligence. Let's get you set up in a few quick steps.
      </p>

      <button onClick={onNext} className="btn-primary rounded-xl px-8 py-3 text-sm font-semibold cursor-pointer">
        Get Started
      </button>
    </div>
  );
}

/* ── Step 2: Folder selection ── */
function StepFolders({
  folders,
  customPath,
  onCustomPathChange,
  onAddCustom,
  onToggle,
  onNext,
}: {
  folders: FolderEntry[];
  customPath: string;
  onCustomPathChange: (v: string) => void;
  onAddCustom: () => void;
  onToggle: (i: number) => void;
  onNext: () => void;
}) {
  return (
    <div className="v-card p-8">
      <h2 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: 'Sora, sans-serif' }}>
        Select Folders
      </h2>
      <p className="text-muted text-sm mb-6">
        Choose which folders DeskPilot should watch and organize.
      </p>

      <div className="section-label mb-3">Folders</div>
      <div className="space-y-1.5 mb-5 max-h-52 overflow-y-auto">
        {folders.map((folder, i) => (
          <label
            key={folder.path}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-hover/50 transition-colors cursor-pointer"
          >
            <input
              type="checkbox"
              checked={folder.checked}
              onChange={() => onToggle(i)}
              className="w-4 h-4 accent-accent shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="text-sm text-foreground block">{folder.label}</span>
              <span className="text-xs text-faint block truncate font-mono">{folder.path}</span>
            </div>
          </label>
        ))}
      </div>

      <div className="section-label mb-2">Add Custom Folder</div>
      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={customPath}
          onChange={e => onCustomPathChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAddCustom()}
          placeholder="C:\Users\..."
          className="flex-1 px-3 py-2 bg-card border border-edge rounded-xl text-sm text-foreground placeholder:text-faint font-mono"
        />
        <button
          onClick={onAddCustom}
          disabled={!customPath.trim()}
          className="btn-primary rounded-xl px-4 py-2 text-sm font-medium cursor-pointer"
        >
          Add
        </button>
      </div>

      <div className="flex justify-end">
        <button onClick={onNext} className="btn-primary rounded-xl px-8 py-3 text-sm font-semibold cursor-pointer">
          Continue
        </button>
      </div>
    </div>
  );
}

/* ── Step 3: API Key ── */
function StepApiKey({
  apiKey,
  onApiKeyChange,
  onSkip,
  onFinish,
  saving,
}: {
  apiKey: string;
  onApiKeyChange: (v: string) => void;
  onSkip: () => void;
  onFinish: () => void;
  saving: boolean;
}) {
  return (
    <div className="v-card p-8">
      <h2 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: 'Sora, sans-serif' }}>
        Gemini AI Classification
      </h2>
      <p className="text-muted text-sm mb-2">
        DeskPilot can use Google's Gemini AI to intelligently classify ambiguous files.
      </p>
      <p className="text-faint text-xs mb-6 leading-relaxed">
        This is completely optional. Without an API key, DeskPilot will still organize
        files using built-in rules. You can always add or change this later in Settings.
      </p>

      <div className="section-label mb-2">API Key</div>
      <input
        type="password"
        value={apiKey}
        onChange={e => onApiKeyChange(e.target.value)}
        placeholder="Paste your Gemini API key..."
        className="w-full px-3 py-2.5 bg-card border border-edge rounded-xl text-sm text-foreground placeholder:text-faint font-mono mb-8"
      />

      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          disabled={saving}
          className="px-6 py-3 text-sm text-faint hover:text-muted transition-colors cursor-pointer rounded-xl border border-edge/50 hover:border-edge"
          style={{ fontFamily: 'Sora, sans-serif', fontWeight: 500 }}
        >
          Skip
        </button>
        <button
          onClick={onFinish}
          disabled={saving}
          className="btn-primary rounded-xl px-8 py-3 text-sm font-semibold cursor-pointer"
        >
          {saving ? 'Saving...' : 'Save & Finish'}
        </button>
      </div>
    </div>
  );
}
