import React, { useEffect, useState } from 'react';
import { useStorageStore, DriveInfo, ScanItem, DuplicateGroup } from '../../stores/storage-store';
import { useToastStore } from '../../stores/toast-store';
import { useIpcEvent } from '../../hooks/useIpc';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatPercent(used: number, total: number): number {
  return total === 0 ? 0 : Math.round((used / total) * 100);
}

/* SVG icon components */
const TrashIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PackageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const FolderIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const DiscIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
    <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const FileIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const HardDriveIcon = () => (
  <svg className="w-12 h-12 text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 1.1.9 2 2 2h12a2 2 0 002-2V7M4 7l2-4h12l2 4M4 7h16M8 15h.01M12 15h.01" />
  </svg>
);

const SCAN_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  temp: { label: 'Temporary Files', icon: <TrashIcon />, color: '#EF4444' },
  cache: { label: 'Cache Directories', icon: <PackageIcon />, color: '#F59E0B' },
  node_modules: { label: 'Node Modules', icon: <FolderIcon />, color: '#8B5CF6' },
  large_files: { label: 'Large Files (>500MB)', icon: <DiscIcon />, color: '#3B82F6' },
  duplicates: { label: 'Duplicate Files', icon: <CopyIcon />, color: '#EC4899' },
};

export default function StoragePage() {
  const {
    drives, scanResults, scanProgress, isScanning, selectedItems,
    setDrives, setScanResults, setScanProgress, setIsScanning,
    toggleItem, selectAllOfType, deselectAll, removeCleanedItems,
    duplicateGroups, isDuplicateScanning, duplicateProgress, selectedDuplicates,
    setDuplicateGroups, setIsDuplicateScanning, setDuplicateProgress,
    toggleDuplicate, clearDuplicates,
  } = useStorageStore();

  const addToast = useToastStore(s => s.addToast);
  const [cleanupInProgress, setCleanupInProgress] = useState(false);
  const [deletingDuplicates, setDeletingDuplicates] = useState(false);

  // Load drive info on mount
  useEffect(() => {
    window.api.invoke('storage:drives').then((d) => setDrives(d as DriveInfo[]));
  }, [setDrives]);

  // Listen for scan progress events
  useIpcEvent('storage:scan:progress', (progress) => {
    setScanProgress(progress as { phase: string; current: number; total: number; currentPath?: string });
  });

  // Listen for duplicate scan progress events
  useIpcEvent('storage:duplicates:progress', (progress) => {
    setDuplicateProgress(progress as { phase: string; current: number; total: number });
  });

  const handleFindDuplicates = async () => {
    setIsDuplicateScanning(true);
    clearDuplicates();
    try {
      const groups = await window.api.invoke('storage:find-duplicates') as DuplicateGroup[];
      setDuplicateGroups(groups);
      if (groups.length === 0) {
        addToast('success', 'No duplicate files found.');
      }
    } catch (err) {
      console.error('Duplicate scan failed:', err);
      addToast('error', 'Duplicate scan failed. Check logs for details.');
    } finally {
      setIsDuplicateScanning(false);
      setDuplicateProgress(null);
    }
  };

  const handleDeleteDuplicates = async () => {
    if (selectedDuplicates.size === 0) return;
    setDeletingDuplicates(true);
    let succeeded = 0;
    let failed = 0;
    for (const filePath of selectedDuplicates) {
      try {
        await window.api.invoke('storage:delete-duplicate', filePath);
        succeeded++;
      } catch (err) {
        console.error('Failed to delete duplicate:', filePath, err);
        failed++;
      }
    }
    // Remove deleted files from duplicate groups
    const deletedPaths = new Set(selectedDuplicates);
    const updatedGroups = duplicateGroups
      .map(group => ({
        ...group,
        files: group.files.filter(f => !deletedPaths.has(f)),
      }))
      .filter(group => group.files.length >= 2);
    setDuplicateGroups(updatedGroups);
    // Clear selections
    const newSelected = new Set<string>();
    useStorageStore.setState({ selectedDuplicates: newSelected });
    setDeletingDuplicates(false);
    // Refresh drive info
    const updatedDrives = await window.api.invoke('storage:drives') as DriveInfo[];
    setDrives(updatedDrives);
    if (failed > 0) {
      addToast('warning', `Deleted ${succeeded} files, ${failed} failed`);
    } else {
      addToast('success', `Moved ${succeeded} duplicate files to Recycle Bin`);
    }
  };

  // Compute duplicate summary
  const duplicateSummary = React.useMemo(() => {
    const totalGroups = duplicateGroups.length;
    const removableFiles = duplicateGroups.reduce((sum, g) => sum + g.files.length - 1, 0);
    const reclaimableBytes = duplicateGroups.reduce((sum, g) => sum + g.size * (g.files.length - 1), 0);
    return { totalGroups, removableFiles, reclaimableBytes };
  }, [duplicateGroups]);

  const selectedDuplicateSize = React.useMemo(() => {
    let total = 0;
    for (const group of duplicateGroups) {
      for (const file of group.files) {
        if (selectedDuplicates.has(file)) {
          total += group.size;
        }
      }
    }
    return total;
  }, [duplicateGroups, selectedDuplicates]);

  const handleScan = async () => {
    setIsScanning(true);
    deselectAll();
    try {
      await window.api.invoke('storage:scan:start', {
        drives: drives.map(d => d.path),
      });
      // Fetch results
      const results = await window.api.invoke('storage:scan:result') as ScanItem[];
      setScanResults(results);
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  const handleCleanup = async () => {
    const ids = [...selectedItems];
    if (ids.length === 0) return;

    setCleanupInProgress(true);
    try {
      const result = await window.api.invoke('storage:cleanup', ids) as {
        succeeded: number; failed: number; freedBytes: number;
        errors: Array<{ path: string; error: string }>;
      };
      removeCleanedItems(ids.filter((_, i) => i < result.succeeded));
      // Refresh drive info
      const updatedDrives = await window.api.invoke('storage:drives') as DriveInfo[];
      setDrives(updatedDrives);

      if (result.errors.length > 0) {
        console.warn('Cleanup errors:', result.errors);
        addToast('warning', `Cleaned ${result.succeeded} items, ${result.failed} failed`);
      } else {
        addToast('success', `Cleaned up ${result.succeeded} items, freed ${formatBytes(result.freedBytes)}`);
      }
    } catch (err) {
      console.error('Cleanup failed:', err);
      addToast('error', 'Cleanup failed. Check logs for details.');
    } finally {
      setCleanupInProgress(false);
    }
  };

  // Group results by type
  const groupedResults = scanResults.reduce<Record<string, ScanItem[]>>((acc, item) => {
    if (!acc[item.scan_type]) acc[item.scan_type] = [];
    acc[item.scan_type].push(item);
    return acc;
  }, {});

  const selectedSize = scanResults
    .filter(item => selectedItems.has(item.id))
    .reduce((sum, item) => sum + item.size_bytes, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[Sora]">Storage Analyzer</h1>
          <p className="text-muted text-sm mt-1">
            Scan your drives for temp files, caches, and large files to reclaim space.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleFindDuplicates}
            disabled={isDuplicateScanning || isScanning}
            className="px-5 py-2.5 rounded-xl disabled:opacity-50 text-white font-medium text-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
            style={{ backgroundColor: '#EC4899' }}
          >
            {isDuplicateScanning ? 'Finding Duplicates...' : 'Find Duplicates'}
          </button>
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="px-5 py-2.5 btn-primary rounded-xl disabled:opacity-50 text-white font-medium text-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {isScanning ? 'Scanning...' : 'Scan All Drives'}
          </button>
        </div>
      </div>

      {/* Drive Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drives.map((drive) => (
          <DriveCard key={drive.path} drive={drive} />
        ))}
      </div>

      {/* Scan Progress */}
      {isScanning && scanProgress && (
        <div className="v-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="section-label">{scanProgress.phase}</span>
            {scanProgress.total > 0 && (
              <span className="text-xs text-faint">
                {scanProgress.current} / {scanProgress.total}
              </span>
            )}
          </div>
          <div className="w-full progress-bar">
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
            <p className="text-xs text-faint mt-2 truncate font-mono">{scanProgress.currentPath}</p>
          )}
        </div>
      )}

      {/* Scan Results */}
      {scanResults.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="flex items-center justify-between v-card p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted">
                Found <span className="text-foreground font-semibold">{scanResults.length}</span> items
              </span>
              <span className="text-sm text-muted">
                Total: <span className="text-warning font-semibold">{formatBytes(scanResults.reduce((s, i) => s + i.size_bytes, 0))}</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              {selectedItems.size > 0 && (
                <>
                  <span className="text-sm text-muted">
                    Selected: <span className="text-accent font-semibold">{formatBytes(selectedSize)}</span>
                  </span>
                  <button
                    onClick={deselectAll}
                    className="text-xs text-faint hover:text-muted cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleCleanup}
                    disabled={cleanupInProgress}
                    className="px-4 py-2 btn-danger rounded-xl disabled:opacity-50 text-white text-sm font-medium transition-colors cursor-pointer"
                  >
                    {cleanupInProgress ? 'Cleaning...' : `Clean Up (${formatBytes(selectedSize)})`}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Grouped results */}
          {Object.entries(groupedResults).map(([type, items]) => (
            <ResultGroup
              key={type}
              type={type}
              items={items}
              selectedItems={selectedItems}
              onToggle={toggleItem}
              onSelectAll={() => selectAllOfType(type)}
            />
          ))}
        </>
      )}

      {/* Duplicate Scan Progress */}
      {isDuplicateScanning && duplicateProgress && (
        <div className="v-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="section-label">{duplicateProgress.phase}</span>
            {duplicateProgress.total > 0 && (
              <span className="text-xs text-faint">
                {duplicateProgress.current} / {duplicateProgress.total}
              </span>
            )}
          </div>
          <div className="w-full progress-bar">
            <div
              className="progress-bar-fill transition-all duration-300"
              style={{
                width: duplicateProgress.total > 0
                  ? `${(duplicateProgress.current / duplicateProgress.total) * 100}%`
                  : '100%',
                animation: duplicateProgress.total === 0 ? 'pulse 1.5s ease-in-out infinite' : undefined,
              }}
            />
          </div>
        </div>
      )}

      {/* Duplicate Results */}
      {duplicateGroups.length > 0 && (
        <>
          {/* Duplicate summary card */}
          <div className="v-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs text-faint uppercase tracking-wide">Duplicate Groups</span>
                  <p className="text-lg font-semibold text-foreground">{duplicateSummary.totalGroups}</p>
                </div>
                <div>
                  <span className="text-xs text-faint uppercase tracking-wide">Removable Files</span>
                  <p className="text-lg font-semibold text-warning">{duplicateSummary.removableFiles}</p>
                </div>
                <div>
                  <span className="text-xs text-faint uppercase tracking-wide">Reclaimable Space</span>
                  <p className="text-lg font-semibold text-danger">{formatBytes(duplicateSummary.reclaimableBytes)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedDuplicates.size > 0 && (
                  <span className="text-sm text-muted">
                    {selectedDuplicates.size} selected ({formatBytes(selectedDuplicateSize)})
                  </span>
                )}
                <button
                  onClick={clearDuplicates}
                  className="text-xs text-faint hover:text-muted cursor-pointer"
                >
                  Clear Results
                </button>
                {selectedDuplicates.size > 0 && (
                  <button
                    onClick={handleDeleteDuplicates}
                    disabled={deletingDuplicates}
                    className="px-4 py-2 btn-danger rounded-xl disabled:opacity-50 text-white text-sm font-medium transition-colors cursor-pointer"
                  >
                    {deletingDuplicates ? 'Deleting...' : `Delete Selected (${formatBytes(selectedDuplicateSize)})`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Duplicate groups */}
          {duplicateGroups.map((group) => (
            <DuplicateGroupCard
              key={group.hash}
              group={group}
              selectedDuplicates={selectedDuplicates}
              onToggle={toggleDuplicate}
            />
          ))}
        </>
      )}

      {/* Empty state */}
      {!isScanning && !isDuplicateScanning && scanResults.length === 0 && duplicateGroups.length === 0 && drives.length > 0 && (
        <div className="text-center py-16">
          <div className="flex justify-center mb-4">
            <HardDriveIcon />
          </div>
          <p className="text-muted text-lg">Click "Scan All Drives" to find reclaimable space</p>
        </div>
      )}
    </div>
  );
}

function DriveCard({ drive }: { drive: DriveInfo }) {
  const percent = formatPercent(drive.usedBytes, drive.totalBytes);
  const isLow = (drive.freeBytes / drive.totalBytes) < 0.1;
  const barColor = isLow ? 'bg-danger' : percent > 75 ? 'bg-warning' : 'bg-success';

  return (
    <div className="v-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg font-semibold text-foreground font-[Sora]">{drive.path.replace('/', '')}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${isLow ? 'bg-danger/20 text-danger' : 'bg-success/20 text-success'}`}>
          {isLow ? 'Low Space' : 'OK'}
        </span>
      </div>
      <div className="w-full progress-bar h-3 mb-2">
        <div className={`${barColor} h-3 rounded-full transition-all`} style={{ width: `${percent}%` }} />
      </div>
      <div className="flex justify-between text-xs text-faint">
        <span>{formatBytes(drive.usedBytes)} used</span>
        <span>{formatBytes(drive.freeBytes)} free</span>
      </div>
      <div className="text-xs text-faint mt-1">
        {formatBytes(drive.totalBytes)} total — {percent}% used
      </div>
    </div>
  );
}

function ResultGroup({
  type, items, selectedItems, onToggle, onSelectAll,
}: {
  type: string;
  items: ScanItem[];
  selectedItems: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const meta = SCAN_TYPE_LABELS[type] || { label: type, icon: <FileIcon />, color: '#6B7280' };
  const totalSize = items.reduce((sum, item) => sum + item.size_bytes, 0);
  const allSelected = items.every(item => selectedItems.has(item.id));

  return (
    <div className="v-card overflow-hidden">
      {/* Group header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-hover/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span style={{ color: meta.color }}>{meta.icon}</span>
          <span className="section-label">{meta.label}</span>
          <span className="section-label text-xs text-faint px-2 py-0.5">
            {items.length} items
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold" style={{ color: meta.color }}>
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
        <div className="border-t border-edge">
          {/* Select all button */}
          <div className="px-4 py-2 bg-surface/50 flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onSelectAll(); }}
              className="text-xs text-accent hover:text-accent-hover cursor-pointer"
            >
              {allSelected ? '✓ All Selected' : 'Select All'}
            </button>
          </div>

          {/* Items */}
          <div className="max-h-64 overflow-y-auto">
            {items.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 px-4 py-2 hover:bg-hover/50 transition-colors cursor-pointer border-b border-edge/50 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  onChange={() => onToggle(item.id)}
                  className="w-4 h-4 rounded accent-accent"
                />
                <span className="flex-1 text-sm text-muted truncate font-mono" title={item.item_path}>
                  {item.item_path}
                </span>
                <span className="text-xs text-faint whitespace-nowrap">
                  {formatBytes(item.size_bytes)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DuplicateGroupCard({
  group, selectedDuplicates, onToggle,
}: {
  group: DuplicateGroup;
  selectedDuplicates: Set<string>;
  onToggle: (filePath: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const truncatedHash = group.hash.substring(0, 12) + '...';

  return (
    <div className="v-card overflow-hidden">
      {/* Group header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-hover/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span style={{ color: '#EC4899' }}><CopyIcon /></span>
          <span className="section-label font-mono text-xs">{truncatedHash}</span>
          <span className="text-xs text-faint px-2 py-0.5 rounded bg-surface">
            {group.files.length} copies
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold" style={{ color: '#EC4899' }}>
            {formatBytes(group.size)} each
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
        <div className="border-t border-edge">
          <div className="max-h-64 overflow-y-auto">
            {group.files.map((filePath, index) => {
              const isFirst = index === 0;
              return (
                <label
                  key={filePath}
                  className={`flex items-center gap-3 px-4 py-2 hover:bg-hover/50 transition-colors border-b border-edge/50 last:border-b-0 ${isFirst ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    checked={isFirst ? true : selectedDuplicates.has(filePath)}
                    disabled={isFirst}
                    onChange={() => { if (!isFirst) onToggle(filePath); }}
                    className="w-4 h-4 rounded accent-accent disabled:opacity-50"
                  />
                  <span className="flex-1 text-sm text-muted truncate font-mono" title={filePath}>
                    {filePath}
                  </span>
                  {isFirst ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-success/20 text-success whitespace-nowrap">
                      Keep
                    </span>
                  ) : (
                    <span className="text-xs text-faint whitespace-nowrap">
                      {formatBytes(group.size)}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
