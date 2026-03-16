import React, { useEffect, useState } from 'react';
import { useScanStore, ScannedFile, ScanResult } from '../../stores/scan-store';
import { useToastStore } from '../../stores/toast-store';
import { useIpcEvent } from '../../hooks/useIpc';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  clients: (
    <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  projects: (
    <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  medicine: (
    <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
    </svg>
  ),
  design: (
    <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  ),
  learning: (
    <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  documents: (
    <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  media: (
    <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
    </svg>
  ),
  tools: (
    <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17l-5.658 5.659a2.1 2.1 0 01-2.97-2.97l5.658-5.659m2.97 2.97L21 7.5m-10.58 7.67L15.17 10.5m-3.75 4.67a3.375 3.375 0 10-4.773-4.773L3 14.042V21h6.958l3.462-3.462z" />
    </svg>
  ),
  archive: (
    <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
};

const FALLBACK_ICON = (
  <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
  </svg>
);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function ScannerPage() {
  const {
    isScanning, scanProgress, scanResult, files,
    selectedFolders, useGemini, hasGeminiKey,
    setIsScanning, setScanProgress, setScanResult, setFiles,
    setSelectedFolders, toggleFolder, setUseGemini, setHasGeminiKey,
  } = useScanStore();

  const addToast = useToastStore(s => s.addToast);
  const [managedFolders, setManagedFolders] = useState<Array<{ id: number; path: string; label: string }>>([]);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyForm, setShowApiKeyForm] = useState(false);

  // Load managed folders and Gemini key status on mount
  useEffect(() => {
    window.api.invoke('settings:get-folders').then((folders) => {
      const f = folders as Array<{ id: number; path: string; label: string; is_active: number }>;
      const active = f.filter(x => x.is_active);
      setManagedFolders(active);
      // Select all by default
      if (selectedFolders.length === 0) {
        setSelectedFolders(active.map(x => x.path));
      }
    });
    window.api.invoke('gemini:has-key').then((has) => setHasGeminiKey(has as boolean));
  }, []);

  // Listen for scan progress
  useIpcEvent('scanner:progress', (progress) => {
    setScanProgress(progress as { phase: string; current: number; total: number; currentPath?: string });
  });

  const handleScan = async () => {
    if (selectedFolders.length === 0) return;
    setIsScanning(true);
    setScanResult(null);
    setFiles([]);
    try {
      const result = await window.api.invoke('scanner:start', {
        folderPaths: selectedFolders,
        useGemini,
      }) as ScanResult;
      setScanResult(result);

      // Fetch classified files
      const classified = await window.api.invoke('scanner:result') as ScannedFile[];
      setFiles(classified);
      addToast('success', `Scan complete: ${classified.length} files classified`);
    } catch (err) {
      console.error('Scan failed:', err);
      addToast('error', 'File scan failed. Check logs for details.');
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    await window.api.invoke('gemini:set-key', apiKeyInput.trim());
    setHasGeminiKey(true);
    setApiKeyInput('');
    setShowApiKeyForm(false);
  };

  // Group files by category
  const grouped = files.reduce<Record<string, ScannedFile[]>>((acc, file) => {
    const key = file.category_slug || 'uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(file);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[Sora]">File Scanner</h1>
          <p className="text-muted text-sm mt-1">
            Discover and classify files in your managed folders.
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={isScanning || selectedFolders.length === 0}
          className="px-5 py-2.5 btn-primary rounded-xl disabled:opacity-50 font-medium text-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {isScanning ? 'Scanning...' : 'Scan & Classify'}
        </button>
      </div>

      {/* Folder Selection + Options */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Folder Checkboxes */}
        <div className="lg:col-span-2 v-card p-4">
          <h2 className="section-label mb-3">Folders to Scan</h2>
          <div className="space-y-2">
            {managedFolders.map((folder) => (
              <label key={folder.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFolders.includes(folder.path)}
                  onChange={() => toggleFolder(folder.path)}
                  className="w-4 h-4 rounded accent-accent"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground">{folder.label}</span>
                  <span className="text-xs text-faint font-mono ml-2 truncate">{folder.path}</span>
                </div>
              </label>
            ))}
            {managedFolders.length === 0 && (
              <p className="text-sm text-faint">No managed folders configured. Add folders in Settings.</p>
            )}
          </div>
        </div>

        {/* AI Options */}
        <div className="v-card p-4">
          <h2 className="section-label mb-3">AI Classification</h2>
          <label className="flex items-center gap-3 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={useGemini}
              onChange={(e) => setUseGemini(e.target.checked)}
              disabled={!hasGeminiKey}
              className="w-4 h-4 rounded accent-accent"
            />
            <span className="text-sm text-foreground">Use Gemini AI for ambiguous files</span>
          </label>

          {!hasGeminiKey && (
            <div className="mt-2">
              {showApiKeyForm ? (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Paste Gemini API key..."
                    className="w-full px-3 py-2 bg-surface border border-edge rounded text-sm text-foreground placeholder:text-faint focus:outline-none focus:border-accent"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveApiKey}
                      className="px-3 py-1.5 btn-primary rounded-xl text-xs font-medium cursor-pointer"
                    >
                      Save Key
                    </button>
                    <button
                      onClick={() => setShowApiKeyForm(false)}
                      className="px-3 py-1.5 text-faint text-xs cursor-pointer hover:text-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowApiKeyForm(true)}
                  className="text-xs text-accent hover:text-accent-hover cursor-pointer"
                >
                  + Add Gemini API Key
                </button>
              )}
            </div>
          )}
          {hasGeminiKey && (
            <p className="text-xs text-success mt-1">API key configured</p>
          )}

          <p className="text-xs text-faint mt-3">
            Files matching rules are classified instantly. Gemini handles the rest.
          </p>
        </div>
      </div>

      {/* Scan Progress */}
      {isScanning && scanProgress && (
        <div className="v-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">{scanProgress.phase}</span>
            {scanProgress.total > 0 && (
              <span className="text-xs text-faint">
                {scanProgress.current} / {scanProgress.total}
              </span>
            )}
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill transition-all duration-300"
              style={{
                width: scanProgress.total > 0
                  ? `${(scanProgress.current / scanProgress.total) * 100}%`
                  : '100%',
                animation: scanProgress.total === 0 ? 'pulse 1.5s ease-in-out infinite' : undefined,
              }}
            />
          </div>
          {scanProgress.currentPath && (
            <p className="text-xs text-faint font-mono mt-2 truncate">{scanProgress.currentPath}</p>
          )}
        </div>
      )}

      {/* Scan Summary */}
      {scanResult && (
        <div className="v-card p-4 flex items-center gap-6 flex-wrap">
          <Stat label="Discovered" value={scanResult.totalDiscovered} />
          <Stat label="Rule-classified" value={scanResult.ruleClassified} color="text-success" />
          <Stat label="AI-classified" value={scanResult.geminiClassified} color="text-accent" />
          <Stat label="Unclassified" value={scanResult.unclassified} color="text-warning" />
          {scanResult.errors.length > 0 && (
            <Stat label="Errors" value={scanResult.errors.length} color="text-danger" />
          )}
        </div>
      )}

      {/* Results grouped by category */}
      {files.length > 0 && (
        <div className="space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => {
              if (a === 'uncategorized') return 1;
              if (b === 'uncategorized') return -1;
              return a.localeCompare(b);
            })
            .map(([slug, items]) => (
              <CategoryGroup key={slug} slug={slug} items={items} />
            ))}
        </div>
      )}

      {/* Empty state */}
      {!isScanning && files.length === 0 && !scanResult && (
        <div className="text-center py-16">
          <svg className="w-12 h-12 text-faint mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <p className="text-muted mt-4 text-lg">Select folders and click "Scan & Classify" to discover your files</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${color || 'text-foreground'}`}>{value}</div>
      <div className="text-xs text-faint">{label}</div>
    </div>
  );
}

function CategoryGroup({ slug, items }: { slug: string; items: ScannedFile[] }) {
  const [expanded, setExpanded] = useState(false);
  const name = items[0]?.category_name || 'Uncategorized';
  const color = items[0]?.category_color || '#6B7280';
  const icon = CATEGORY_ICONS[slug] || FALLBACK_ICON;
  const totalSize = items.reduce((sum, f) => sum + f.size_bytes, 0);

  // Split by method
  const ruleCount = items.filter(f => f.classification_method === 'rule').length;
  const geminiCount = items.filter(f => f.classification_method === 'gemini').length;

  return (
    <div className="v-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-hover/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="section-label">{name}</span>
          <span className="text-xs text-faint bg-surface/50 px-2 py-0.5 rounded-xl">
            {items.length} files
          </span>
          {ruleCount > 0 && (
            <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded-xl">
              {ruleCount} rules
            </span>
          )}
          {geminiCount > 0 && (
            <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded-xl">
              {geminiCount} AI
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold" style={{ color }}>
            {formatBytes(totalSize)}
          </span>
          <svg
            className={`w-4 h-4 text-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-edge max-h-72 overflow-y-auto">
          {items.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 px-4 py-2 hover:bg-hover/50 transition-colors border-b border-edge/50 last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm text-foreground truncate block">{file.filename}</span>
                <span className="text-xs text-faint font-mono truncate block">{file.current_path}</span>
              </div>
              <ConfidenceBadge method={file.classification_method} confidence={file.classification_confidence} />
              <span className="text-xs text-faint whitespace-nowrap">
                {formatBytes(file.size_bytes)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ method, confidence }: { method: string | null; confidence: number | null }) {
  if (!method) {
    return <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded">???</span>;
  }

  const pct = confidence !== null ? Math.round(confidence * 100) : 0;
  const isRule = method === 'rule';

  return (
    <span
      className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${
        isRule
          ? 'text-success bg-success/10'
          : pct >= 80
            ? 'text-accent bg-accent/10'
            : 'text-warning bg-warning/10'
      }`}
    >
      {isRule ? 'Rule' : `AI ${pct}%`}
    </span>
  );
}
