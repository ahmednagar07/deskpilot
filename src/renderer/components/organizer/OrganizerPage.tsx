import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useOrganizerStore, UndoSession } from '../../stores/organizer-store';
import { useToastStore } from '../../stores/toast-store';
import { useI18n } from '../../i18n';
import { formatBytes } from '../../utils/format';
import { MovePlanItem, Category } from '../../../shared/types';

interface PlanAnalysis {
  totalFiles: number;
  totalBytes: number;
  categoryBreakdown: Array<{ category: string; count: number; bytes: number }>;
  sourceDrives: Array<{ drive: string; fileCount: number; totalBytes: number; freeBytes: number; isCrossDrive: boolean }>;
  destDrive: { drive: string; freeBytes: number };
  crossDriveCount: number;
  sameDriveCount: number;
  spaceOk: boolean;
  spaceNeeded: number;
}

function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  if (parts.length <= 3) return p;
  return parts.slice(0, 2).join('/') + '/.../' + parts.slice(-1).join('/');
}

/** Build a new destPath for a file when it's reclassified to a different category */
function buildDestPath(item: MovePlanItem, targetPath: string): string {
  const fileName = item.suggestedName || item.currentName;
  const base = targetPath.replace(/[\\/]+$/, '');
  return `${base}/${fileName}`;
}

interface ExecutionResultData {
  succeeded: number;
  failed: number;
  skipped: number;
  sessionId: string;
  errors: Array<{ path: string; error: string }>;
  warnings: Array<{ path: string; warning: string }>;
  categoryBreakdown: Array<{ category: string; count: number }>;
  totalBytes: number;
  elapsedMs: number;
  mode: 'move' | 'copy';
}

const MAX_BATCH_APPROVE = 100;

export default function OrganizerPage() {
  const { t } = useI18n();
  const {
    plan, isGenerating, isExecuting, undoHistory,
    setPlan, setIsGenerating, setIsExecuting, setUndoHistory,
    toggleApproval, approveAll, deselectAll,
  } = useOrganizerStore();

  const addToast = useToastStore(s => s.addToast);
  const [activeTab, setActiveTab] = useState<'plan' | 'history'>('plan');
  const [executionResult, setExecutionResult] = useState<ExecutionResultData | null>(null);

  // Move options
  const [moveMode, setMoveMode] = useState<'move' | 'copy'>('move');
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'overwrite' | 'rename'>('rename');

  // Safety: plan analysis + confirmation
  const [analysis, setAnalysis] = useState<PlanAnalysis | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Drag & drop state
  const [draggingFileId, setDraggingFileId] = useState<number | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Batch rename state
  const [renamePreview, setRenamePreview] = useState<Array<{ path: string; original: string; suggested: string | null }> | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  // Move progress state
  const [moveProgress, setMoveProgress] = useState<{
    current: number;
    total: number;
    currentFile: string;
    bytesProcessed: number;
    totalBytes: number;
    startedAt: number;
  } | null>(null);

  // Folder picker state
  const [managedFolders, setManagedFolders] = useState<Array<{ id: number; path: string; label: string }>>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [organizedRoot, setOrganizedRoot] = useState<string>('');

  // Load undo history, managed folders, and organized root on mount
  useEffect(() => {
    loadHistory();

    // Load managed folders
    window.api.invoke('settings:get-folders').then((folders) => {
      const f = folders as Array<{ id: number; path: string; label: string; is_active: number }>;
      const active = f.filter(x => x.is_active);
      setManagedFolders(active);
      setSelectedFolders(active.map(x => x.path));
    });

    // Load organized root
    window.api.invoke('settings:get', 'organized_root').then((root) => {
      if (root) setOrganizedRoot(root as string);
    });
  }, []);

  // Listen for move progress events
  useEffect(() => {
    const unsub = window.api.on('organizer:move-progress', (progress: unknown) => {
      const p = progress as { current: number; total: number; currentFile: string; bytesProcessed: number; totalBytes: number };
      setMoveProgress(prev => ({
        ...p,
        startedAt: prev?.startedAt || Date.now(),
      }));
    });
    return unsub;
  }, []);

  // Load all categories on mount (needed for dock + reclassification)
  useEffect(() => {
    (async () => {
      try {
        const cats = await window.api.invoke('categories:get-all') as Category[];
        setAllCategories(cats);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    })();
  }, []);

  const loadHistory = async () => {
    try {
      const history = await window.api.invoke('organizer:history', 20) as UndoSession[];
      setUndoHistory(history);
    } catch (err) {
      console.error('Failed to load undo history:', err);
    }
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    setExecutionResult(null);
    setAnalysis(null);
    try {
      const result = await window.api.invoke('organizer:generate-plan', selectedFolders) as MovePlanItem[];
      setPlan(result);

      // Auto-analyze the plan
      if (result.length > 0) {
        try {
          const planAnalysis = await window.api.invoke('organizer:analyze-plan', result) as PlanAnalysis;
          setAnalysis(planAnalysis);
        } catch (err) {
          console.error('Plan analysis failed:', err);
        }
      }
    } catch (err) {
      console.error('Failed to generate plan:', err);
      addToast('error', t('toast.planFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteRequest = () => {
    const approved = plan.filter(item => item.approved);
    if (approved.length === 0) return;
    // Always show confirmation dialog before moving files
    setShowConfirm(true);
    // Re-analyze with only approved items
    window.api.invoke('organizer:analyze-plan', approved)
      .then((result) => setAnalysis(result as PlanAnalysis))
      .catch(console.error);
  };

  const handleExecuteConfirmed = async () => {
    setShowConfirm(false);
    const approved = plan.filter(item => item.approved);
    if (approved.length === 0) return;

    setIsExecuting(true);
    setExecutionResult(null);
    setMoveProgress({ current: 0, total: approved.length, currentFile: '', bytesProcessed: 0, totalBytes: 0, startedAt: Date.now() });
    try {
      const result = await window.api.invoke('organizer:execute', approved, { mode: moveMode, duplicates: duplicateMode }) as ExecutionResultData & { error?: string };

      if (result.error) {
        console.error('Execute error:', result.error);
        addToast('error', `${t('toast.moveFailed')}: ${result.error}`);
        return;
      }

      // Show the detailed results card (persistent, not a toast)
      setExecutionResult(result);

      // Remove succeeded items from plan
      const failedPaths = new Set(result.errors?.map(e => e.path) || []);
      setPlan(plan.filter(item => failedPaths.has(item.currentPath)));
      setAnalysis(null);

      await loadHistory();
    } catch (err) {
      console.error('Execute failed:', err);
      addToast('error', t('toast.moveFailed'));
    } finally {
      setIsExecuting(false);
      setMoveProgress(null);
    }
  };

  const handleUndoSession = async (sessionId: string) => {
    try {
      await window.api.invoke('organizer:undo-batch', sessionId);
      await loadHistory();
      addToast('success', t('toast.undoComplete'));
    } catch (err) {
      console.error('Undo failed:', err);
      addToast('error', t('toast.undoFailed'));
    }
  };

  // Guard: Approve All only for small batches
  const handleApproveAll = () => {
    if (plan.length > MAX_BATCH_APPROVE) {
      addToast('warning', t('organizer.batchTooLarge', { max: MAX_BATCH_APPROVE }));
      return;
    }
    approveAll();
  };

  // Approve all files in a specific category
  const handleApproveCategory = (category: string) => {
    const updated = plan.map(item =>
      item.category === category ? { ...item, approved: true } : item
    );
    setPlan(updated);
  };

  // --- Drag & Drop: reclassify a file into a new category ---
  const handleDropOnCategory = useCallback((categoryName: string) => {
    if (draggingFileId == null) return;

    const cat = allCategories.find(c => c.name === categoryName);
    if (!cat) return;

    const updated = plan.map(item => {
      if (item.fileId !== draggingFileId) return item;
      if (item.category === categoryName) return item;
      return {
        ...item,
        category: categoryName,
        destPath: buildDestPath(item, cat.target_path),
      };
    });

    setPlan(updated);
    setDraggingFileId(null);
    setIsDragging(false);
    addToast('success', t('organizer.movedToCategory', { category: categoryName }));
  }, [draggingFileId, allCategories, plan, setPlan, addToast, t]);

  // --- Batch Rename ---
  const handleBatchRenamePreview = async () => {
    const filePaths = plan.map(item => item.currentPath);
    try {
      const preview = await window.api.invoke('batch-rename:preview', filePaths) as Array<{ path: string; original: string; suggested: string | null }>;
      const withSuggestions = preview.filter(p => p.suggested !== null);
      if (withSuggestions.length === 0) {
        addToast('info', t('organizer.allFilenamesClean'));
        return;
      }
      setRenamePreview(withSuggestions);
    } catch (err) {
      console.error('Batch rename preview failed:', err);
      addToast('error', t('toast.renameFailed'));
    }
  };

  const handleBatchRenameExecute = async () => {
    if (!renamePreview) return;
    setIsRenaming(true);
    try {
      const renames = renamePreview
        .filter(p => p.suggested !== null)
        .map(p => ({ oldPath: p.path, newName: p.suggested! }));
      const results = await window.api.invoke('batch-rename:execute', renames) as Array<{ oldPath: string; newPath: string; success: boolean; error?: string }>;
      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      if (failed > 0) {
        addToast('warning', t('organizer.renamePartial', { succeeded, failed }));
      } else {
        addToast('success', t('organizer.renameFiles', { count: succeeded }));
      }
      setRenamePreview(null);
    } catch (err) {
      console.error('Batch rename failed:', err);
      addToast('error', t('toast.renameFailed'));
    } finally {
      setIsRenaming(false);
    }
  };

  const approvedCount = useMemo(() => plan.filter(p => p.approved).length, [plan]);

  // Group plan by category
  const grouped = useMemo(() => plan.reduce<Record<string, MovePlanItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {}), [plan]);

  const categoriesInPlan = useMemo(() => new Set(Object.keys(grouped)), [grouped]);

  const dockCategories = useMemo(
    () => allCategories.filter(c => !categoriesInPlan.has(c.name)),
    [allCategories, categoriesInPlan]
  );

  return (
    <div className="space-y-6 relative pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[Sora]">{t('organizer.title')}</h1>
          <p className="text-muted text-sm mt-1">{t('organizer.subtitle')}</p>
        </div>
        <button
          onClick={handleGeneratePlan}
          disabled={isGenerating || selectedFolders.length === 0}
          className="px-5 py-2.5 btn-primary rounded-xl disabled:opacity-50 text-white font-medium text-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {isGenerating ? t('organizer.generating') : t('organizer.generatePlan')}
        </button>
      </div>

      {/* Source → Destination */}
      <div className="v-card p-4 space-y-4">
        {/* Source folders */}
        <div>
          <h2 className="section-label mb-3">{t('organizer.selectFolders')}</h2>
          <div className="space-y-2">
            {managedFolders.map((folder) => (
              <label key={folder.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFolders.includes(folder.path)}
                  onChange={() => {
                    setSelectedFolders(prev =>
                      prev.includes(folder.path)
                        ? prev.filter(p => p !== folder.path)
                        : [...prev, folder.path]
                    );
                  }}
                  className="w-4 h-4 rounded accent-accent"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground">{folder.label}</span>
                  <span className="text-xs text-faint font-mono ml-2 truncate">{folder.path}</span>
                </div>
              </label>
            ))}
            {managedFolders.length === 0 && (
              <p className="text-sm text-faint">{t('scanner.noFolders')}</p>
            )}
          </div>
        </div>

        {/* Arrow separator */}
        <div className="flex items-center gap-3 px-2">
          <div className="flex-1 border-t border-edge/50" />
          <svg className="w-5 h-5 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <div className="flex-1 border-t border-edge/50" />
        </div>

        {/* Destination folder */}
        <div>
          <h2 className="section-label mb-2">{t('organizer.organizedRoot')}</h2>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <input
              type="text"
              value={organizedRoot}
              onChange={(e) => setOrganizedRoot(e.target.value)}
              onBlur={() => {
                if (organizedRoot.trim()) {
                  window.api.invoke('settings:set', 'organized_root', organizedRoot.trim());
                }
              }}
              placeholder={t('settings.organizedRootHint')}
              className="flex-1 px-3 py-1.5 bg-surface border border-edge rounded-lg text-sm text-foreground font-mono placeholder:text-faint focus:outline-none focus:border-accent"
            />
            <button
              onClick={async () => {
                const selected = await window.api.invoke('dialog:open-folder', organizedRoot || undefined) as string | null;
                if (selected) {
                  setOrganizedRoot(selected);
                  window.api.invoke('settings:set', 'organized_root', selected);
                }
              }}
              className="px-3 py-1.5 bg-accent/10 border border-accent/30 rounded-lg text-sm text-accent hover:bg-accent/20 transition-colors cursor-pointer shrink-0"
            >
              {t('organizer.browse')}
            </button>
          </div>
          <p className="text-xs text-faint mt-1.5 pl-6">{t('organizer.filesMovedToSubfolders')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-edge">
        <button
          onClick={() => setActiveTab('plan')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'plan' ? 'border-[var(--t-accent)] text-[var(--t-accent)]' : 'border-transparent text-faint hover:text-muted'
          }`}
        >
          {t('organizer.movePlan')} {plan.length > 0 && `(${plan.length})`}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'history' ? 'border-[var(--t-accent)] text-[var(--t-accent)]' : 'border-transparent text-faint hover:text-muted'
          }`}
        >
          {t('organizer.undoHistory')} {undoHistory.length > 0 && `(${undoHistory.length})`}
        </button>
      </div>

      {activeTab === 'plan' && (
        <>
          {/* Plan Summary Card */}
          {analysis && plan.length > 0 && (
            <PlanSummaryCard analysis={analysis} t={t} organizedRoot={organizedRoot} />
          )}

          {/* Detailed Execution Results Card */}
          {executionResult && (
            <ExecutionResultCard result={executionResult} onDismiss={() => setExecutionResult(null)} t={t} />
          )}

          {/* Move Options */}
          {plan.length > 0 && !executionResult && (
            <MoveOptionsPanel
              moveMode={moveMode}
              setMoveMode={setMoveMode}
              duplicateMode={duplicateMode}
              setDuplicateMode={setDuplicateMode}
              t={t}
            />
          )}

          {/* Approval bar */}
          {plan.length > 0 && (
            <div className="flex items-center justify-between v-card p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted">
                  <span className="text-foreground font-semibold">{plan.length}</span> {t('organizer.filesToOrganize')}
                </span>
                <span className="text-sm text-muted">
                  <span className="text-[var(--t-accent)] font-semibold">{approvedCount}</span> {t('organizer.approved')}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleBatchRenamePreview} className="text-xs text-[#22D3EE] hover:text-[#06B6D4] cursor-pointer">
                  {t('organizer.cleanNames')}
                </button>
                <button
                  onClick={handleApproveAll}
                  className="text-xs text-[var(--t-accent)] hover:opacity-80 cursor-pointer"
                  title={plan.length > MAX_BATCH_APPROVE ? t('organizer.batchTooLarge', { max: MAX_BATCH_APPROVE }) : ''}
                >
                  {t('organizer.approveAll')} {plan.length > MAX_BATCH_APPROVE && `(max ${MAX_BATCH_APPROVE})`}
                </button>
                <button onClick={deselectAll} className="text-xs text-faint hover:text-muted cursor-pointer">
                  {t('organizer.clear')}
                </button>
                <button
                  onClick={handleExecuteRequest}
                  disabled={approvedCount === 0 || isExecuting}
                  className="px-4 py-2 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg, #2DD4A8, #1A9F7C)' }}
                >
                  {isExecuting ? t('organizer.moving') : t('organizer.moveFiles', { count: approvedCount })}
                </button>
              </div>
            </div>
          )}

          {/* Drag hint */}
          {plan.length > 0 && !isDragging && (
            <p className="text-xs text-faint text-center">{t('organizer.dragHint')}</p>
          )}

          {/* Grouped plan items */}
          {Object.entries(grouped).map(([category, items]) => (
            <PlanGroup
              key={category}
              category={category}
              items={items}
              onToggle={toggleApproval}
              onApproveCategory={handleApproveCategory}
              draggingFileId={draggingFileId}
              onDragStart={(fileId) => { setDraggingFileId(fileId); setIsDragging(true); }}
              onDragEnd={() => { setDraggingFileId(null); setIsDragging(false); }}
              onDropOnCategory={handleDropOnCategory}
              t={t}
              categoryBytes={analysis?.categoryBreakdown.find(c => c.category === category)?.bytes}
            />
          ))}

          {/* Empty state */}
          {plan.length === 0 && !isGenerating && (
            <div className="text-center py-16">
              <svg className="w-14 h-14 mx-auto text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="text-muted mt-4 text-lg">{t('organizer.generateHint')}</p>
              <p className="text-faint mt-2 text-sm">{t('organizer.scanFirst')}</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3">
          {undoHistory.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-14 h-14 mx-auto text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-muted mt-4 text-lg">{t('organizer.noHistory')}</p>
            </div>
          ) : (
            undoHistory.map((session) => (
              <div key={session.session_id} className="v-card p-4 flex items-center justify-between">
                <div>
                  <span className="text-sm text-foreground font-medium">
                    {t('organizer.filesMoved', { count: session.count })}
                  </span>
                  <span className="text-xs text-faint ml-3">
                    {new Date(session.executed_at).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => handleUndoSession(session.session_id)}
                  className="px-3 py-1.5 border border-edge text-muted rounded-xl text-xs font-medium cursor-pointer hover:bg-hover/50 hover:text-foreground transition-colors"
                >
                  {t('organizer.undoSession')}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Batch Rename Preview Modal */}
      {renamePreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="v-card max-w-lg w-full max-h-[70vh] flex flex-col">
            <div className="p-5 border-b border-edge">
              <h3 className="text-lg font-semibold text-foreground font-[Sora]">{t('organizer.cleanFilenames')}</h3>
              <p className="text-xs text-faint mt-1">{t('organizer.filesWillBeRenamed', { count: renamePreview.length })}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {renamePreview.map((item) => (
                <div key={item.path} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="text-faint line-through truncate flex-1">{item.original}</span>
                  <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-success truncate flex-1">{item.suggested}</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-edge flex justify-end gap-3">
              <button onClick={() => setRenamePreview(null)} className="px-4 py-2 text-sm text-faint hover:text-muted cursor-pointer">
                {t('common.cancel')}
              </button>
              <button
                onClick={handleBatchRenameExecute}
                disabled={isRenaming}
                className="px-5 py-2 btn-primary rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                {isRenaming ? t('organizer.renaming') : t('organizer.renameFiles', { count: renamePreview.length })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <ConfirmMoveDialog
          analysis={analysis}
          approvedCount={approvedCount}
          onConfirm={handleExecuteConfirmed}
          onCancel={() => setShowConfirm(false)}
          t={t}
        />
      )}

      {/* Floating category dock -- visible only when dragging */}
      {isDragging && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-[var(--t-accent)]/40 bg-[var(--t-surface)]/95 backdrop-blur-lg shadow-lg"
          style={{ maxWidth: '90vw' }}
        >
          <span className="text-[10px] uppercase tracking-widest text-faint mr-2 select-none">
            {t('organizer.dropOntoCategory')}
          </span>
          {dockCategories.map(cat => (
            <CategoryDockPill key={cat.id} category={cat} onDrop={handleDropOnCategory} />
          ))}
        </div>
      )}

      {/* Move Progress Overlay */}
      {isExecuting && moveProgress && (
        <MoveProgressOverlay progress={moveProgress} t={t} />
      )}
    </div>
  );
}

// ─── Plan Summary Card ────────────────────────────────────────────────────────

function PlanSummaryCard({ analysis, t, organizedRoot }: { analysis: PlanAnalysis; t: (key: string, vars?: Record<string, string | number>) => string; organizedRoot?: string }) {
  return (
    <div className="v-card p-5 space-y-4">
      <h3 className="section-label">{t('organizer.planSummary')}</h3>

      {organizedRoot && (
        <div className="flex items-center gap-2 text-sm text-muted p-3 rounded-lg bg-accent/5 border border-accent/20">
          <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span>{t('organizer.organizedRoot')}:</span>
          <span className="font-mono text-foreground font-medium">{organizedRoot}</span>
          <span className="text-faint">—</span>
          <span className="text-faint">{t('organizer.filesMovedToSubfolders')}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <div className="text-2xl font-bold text-foreground">{analysis.totalFiles.toLocaleString()}</div>
          <div className="text-xs text-faint">{t('organizer.sourceFiles')}</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-foreground">{formatBytes(analysis.totalBytes)}</div>
          <div className="text-xs text-faint">{t('dashboard.totalSize')}</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-foreground">{analysis.destDrive.drive}</div>
          <div className="text-xs text-faint">{t('organizer.destination')} ({t('organizer.spaceAvailable', { available: formatBytes(analysis.destDrive.freeBytes) })})</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-foreground">{analysis.categoryBreakdown.length}</div>
          <div className="text-xs text-faint">{t('dashboard.categories')}</div>
        </div>
      </div>

      {/* Cross-drive warning */}
      {analysis.crossDriveCount > 0 && (
        <div className={`p-3 rounded-xl border text-sm ${
          analysis.spaceOk
            ? 'bg-warning/10 border-warning/30 text-warning'
            : 'bg-danger/10 border-danger/30 text-danger'
        }`}>
          {analysis.spaceOk
            ? t('organizer.crossDriveWarning', { size: formatBytes(analysis.spaceNeeded), drive: analysis.destDrive.drive })
            : t('organizer.notEnoughSpace', {
                needed: formatBytes(analysis.spaceNeeded),
                available: formatBytes(analysis.destDrive.freeBytes),
                drive: analysis.destDrive.drive,
              })
          }
        </div>
      )}

      {/* Drive breakdown */}
      {analysis.sourceDrives.length > 0 && (
        <div>
          <div className="text-xs text-faint uppercase tracking-wider mb-2">{t('organizer.driveAnalysis')}</div>
          <div className="grid gap-2">
            {analysis.sourceDrives.map(drive => (
              <div key={drive.drive} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-surface/50">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-foreground font-medium">{drive.drive}</span>
                  <span className="text-faint">{drive.fileCount} {t('common.files')}</span>
                  <span className="text-faint">({formatBytes(drive.totalBytes)})</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  drive.isCrossDrive
                    ? 'bg-warning/20 text-warning'
                    : 'bg-success/20 text-success'
                }`}>
                  {drive.isCrossDrive ? t('organizer.crossDriveMoves') : t('organizer.sameDriveMoves')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────

function ConfirmMoveDialog({
  analysis,
  approvedCount,
  onConfirm,
  onCancel,
  t,
}: {
  analysis: PlanAnalysis | null;
  approvedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const canProceed = analysis ? analysis.spaceOk : true;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="v-card max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-edge">
          <h3 className="text-lg font-semibold text-foreground font-[Sora]">{t('organizer.confirmMove')}</h3>
          <p className="text-sm text-muted mt-1">{t('organizer.confirmMoveDesc', { count: approvedCount })}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {analysis && (
            <>
              {/* Category breakdown */}
              <div>
                <div className="text-xs text-faint uppercase tracking-wider mb-2">{t('organizer.categoryBreakdown')}</div>
                <div className="space-y-1.5">
                  {analysis.categoryBreakdown.map(cat => (
                    <div key={cat.category} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{cat.category}</span>
                      <span className="text-faint">{cat.count} {t('common.files')} ({formatBytes(cat.bytes)})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Destination */}
              <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-surface/50">
                <span className="text-faint">{t('organizer.destination')}</span>
                <span className="font-mono text-foreground">{analysis.destDrive.drive} — {formatBytes(analysis.destDrive.freeBytes)} {t('storage.free')}</span>
              </div>

              {/* Cross-drive warning */}
              {analysis.crossDriveCount > 0 && (
                <div className={`p-3 rounded-xl border text-sm ${
                  analysis.spaceOk
                    ? 'bg-warning/10 border-warning/30 text-warning'
                    : 'bg-danger/10 border-danger/30 text-danger'
                }`}>
                  <div className="font-medium mb-1">{t('organizer.crossDriveMoves')}: {analysis.crossDriveCount} {t('common.files')}</div>
                  {!analysis.spaceOk && (
                    <div>{t('organizer.notEnoughSpace', {
                      needed: formatBytes(analysis.spaceNeeded),
                      available: formatBytes(analysis.destDrive.freeBytes),
                      drive: analysis.destDrive.drive,
                    })}</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-edge flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-faint hover:text-muted cursor-pointer">
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={!canProceed}
            className="px-5 py-2 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all hover:brightness-110"
            style={{ background: canProceed ? 'linear-gradient(135deg, #2DD4A8, #1A9F7C)' : '#666' }}
          >
            {t('organizer.proceedMove')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Move Progress Overlay ────────────────────────────────────────────────────

function MoveProgressOverlay({
  progress,
  t,
}: {
  progress: { current: number; total: number; currentFile: string; bytesProcessed: number; totalBytes: number; startedAt: number };
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const elapsed = (Date.now() - progress.startedAt) / 1000; // seconds
  const rate = progress.current > 0 ? elapsed / progress.current : 0; // seconds per file
  const remaining = Math.max(0, Math.round(rate * (progress.total - progress.current)));

  const formatTime = (secs: number): string => {
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="v-card max-w-md w-full p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-accent animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground font-[Sora]">{t('organizer.movingFiles')}</h3>
            <p className="text-xs text-faint">{t('organizer.doNotClose')}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-foreground font-medium">{pct}%</span>
            <span className="text-faint">{progress.current} / {progress.total} {t('common.files')}</span>
          </div>
          <div className="w-full h-3 bg-surface rounded-full overflow-hidden border border-edge/50">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #7C5CFC, #2DD4A8)',
              }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface/50 rounded-lg p-3">
            <div className="text-xs text-faint">{t('organizer.bytesProcessed')}</div>
            <div className="text-sm font-medium text-foreground mt-0.5">
              {formatBytes(progress.bytesProcessed)} / {formatBytes(progress.totalBytes)}
            </div>
          </div>
          <div className="bg-surface/50 rounded-lg p-3">
            <div className="text-xs text-faint">{t('organizer.estimatedTime')}</div>
            <div className="text-sm font-medium text-foreground mt-0.5">
              {progress.current > 0 ? `~${formatTime(remaining)}` : '...'}
            </div>
          </div>
        </div>

        {/* Current file */}
        {progress.currentFile && (
          <div className="bg-surface/50 rounded-lg p-3">
            <div className="text-xs text-faint mb-1">{t('organizer.currentFile')}</div>
            <div className="text-sm text-foreground font-mono truncate">{progress.currentFile}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Category Dock Pill ───────────────────────────────────────────────────────

// ─── Move Options Panel ───────────────────────────────────────────────────────

function MoveOptionsPanel({
  moveMode,
  setMoveMode,
  duplicateMode,
  setDuplicateMode,
  t,
}: {
  moveMode: 'move' | 'copy';
  setMoveMode: (mode: 'move' | 'copy') => void;
  duplicateMode: 'skip' | 'overwrite' | 'rename';
  setDuplicateMode: (mode: 'skip' | 'overwrite' | 'rename') => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="v-card p-4">
      <div className="flex flex-wrap items-center gap-6">
        {/* Move mode */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-faint uppercase tracking-wider">{t('organizer.moveMode')}</span>
          <div className="flex rounded-lg border border-edge overflow-hidden">
            <button
              onClick={() => setMoveMode('move')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                moveMode === 'move'
                  ? 'bg-accent text-white'
                  : 'bg-surface text-muted hover:bg-hover/50'
              }`}
            >
              {t('organizer.modeMove')}
            </button>
            <button
              onClick={() => setMoveMode('copy')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer border-l border-edge ${
                moveMode === 'copy'
                  ? 'bg-accent text-white'
                  : 'bg-surface text-muted hover:bg-hover/50'
              }`}
            >
              {t('organizer.modeCopy')}
            </button>
          </div>
        </div>

        {/* Duplicate handling */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-faint uppercase tracking-wider">{t('organizer.duplicates')}</span>
          <div className="flex rounded-lg border border-edge overflow-hidden">
            {(['rename', 'skip', 'overwrite'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setDuplicateMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  mode !== 'rename' ? 'border-l border-edge' : ''
                } ${
                  duplicateMode === mode
                    ? 'bg-accent text-white'
                    : 'bg-surface text-muted hover:bg-hover/50'
                }`}
              >
                {t(`organizer.dup${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Mode description */}
        <span className="text-xs text-faint">
          {moveMode === 'move' ? t('organizer.moveModeDesc') : t('organizer.copyModeDesc')}
        </span>
      </div>
    </div>
  );
}

// ─── Execution Result Card ────────────────────────────────────────────────────

function ExecutionResultCard({
  result,
  onDismiss,
  t,
}: {
  result: ExecutionResultData;
  onDismiss: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const allGood = result.failed === 0 && result.skipped === 0;
  const hasErrors = result.failed > 0;
  const elapsed = result.elapsedMs / 1000;

  const formatTime = (secs: number): string => {
    if (secs < 1) return '<1s';
    if (secs < 60) return `${Math.round(secs)}s`;
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}m ${s}s`;
  };

  return (
    <div className={`v-card overflow-hidden border-2 ${
      allGood ? 'border-success/40' : hasErrors ? 'border-danger/40' : 'border-warning/40'
    }`}>
      {/* Header */}
      <div className={`px-5 py-4 flex items-center justify-between ${
        allGood ? 'bg-success/10' : hasErrors ? 'bg-danger/10' : 'bg-warning/10'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            allGood ? 'bg-success/20' : hasErrors ? 'bg-danger/20' : 'bg-warning/20'
          }`}>
            {allGood ? (
              <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground font-[Sora]">
              {allGood ? t('organizer.resultSuccess') : t('organizer.resultPartial')}
            </h3>
            <p className="text-xs text-faint">
              {result.mode === 'copy' ? t('organizer.resultCopied') : t('organizer.resultMoved')} • {formatTime(elapsed)}
            </p>
          </div>
        </div>
        <button onClick={onDismiss} className="text-faint hover:text-muted cursor-pointer p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stats row */}
      <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-edge">
        <div>
          <div className="text-2xl font-bold text-success">{result.succeeded}</div>
          <div className="text-xs text-faint">{t('organizer.resultSucceeded')}</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-foreground">{formatBytes(result.totalBytes)}</div>
          <div className="text-xs text-faint">{t('organizer.resultDataProcessed')}</div>
        </div>
        {result.failed > 0 && (
          <div>
            <div className="text-2xl font-bold text-danger">{result.failed}</div>
            <div className="text-xs text-faint">{t('organizer.resultFailed')}</div>
          </div>
        )}
        {result.skipped > 0 && (
          <div>
            <div className="text-2xl font-bold text-warning">{result.skipped}</div>
            <div className="text-xs text-faint">{t('organizer.resultSkipped')}</div>
          </div>
        )}
      </div>

      {/* Category breakdown */}
      {result.categoryBreakdown.length > 0 && (
        <div className="px-5 py-4 border-b border-edge">
          <div className="text-xs text-faint uppercase tracking-wider mb-3">{t('organizer.categoryBreakdown')}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {result.categoryBreakdown.map(cat => (
              <div key={cat.category} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-surface/50">
                <span className="text-foreground font-medium">{cat.category}</span>
                <span className="text-faint">{cat.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="px-5 py-4 border-b border-edge">
          <div className="text-xs text-danger uppercase tracking-wider mb-2">{t('organizer.resultErrors')}</div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {result.errors.slice(0, 10).map((err, i) => (
              <div key={i} className="text-xs text-danger/80 flex gap-2">
                <span className="shrink-0">•</span>
                <span className="truncate font-mono">{err.path.split(/[\\/]/).pop()}</span>
                <span className="text-faint">—</span>
                <span>{err.error}</span>
              </div>
            ))}
            {result.errors.length > 10 && (
              <div className="text-xs text-faint">...and {result.errors.length - 10} more</div>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="px-5 py-4">
          <div className="text-xs text-warning uppercase tracking-wider mb-2">{t('organizer.resultWarnings')}</div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {result.warnings.slice(0, 5).map((w, i) => (
              <div key={i} className="text-xs text-warning/80">• {w.warning}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Category Dock Pill ───────────────────────────────────────────────────────

function CategoryDockPill({
  category,
  onDrop,
}: {
  category: Category;
  onDrop: (categoryName: string) => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); }}
      onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDrop(category.name);
      }}
      className={`
        px-3 py-1.5 rounded-full text-xs font-medium select-none transition-all duration-150 cursor-default
        ${over
          ? 'bg-[var(--t-accent)]/30 text-white ring-2 ring-[var(--t-accent)] scale-110'
          : 'bg-surface/60 text-muted hover:bg-surface'
        }
      `}
    >
      {category.icon && <span className="mr-1">{category.icon}</span>}
      {category.name}
    </div>
  );
}

// ─── Plan Group ───────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 50;

const PlanGroup = React.memo(function PlanGroup({
  category,
  items,
  onToggle,
  onApproveCategory,
  draggingFileId,
  onDragStart,
  onDragEnd,
  onDropOnCategory,
  t,
  categoryBytes,
}: {
  category: string;
  items: MovePlanItem[];
  onToggle: (fileId: number) => void;
  onApproveCategory: (category: string) => void;
  draggingFileId: number | null;
  onDragStart: (fileId: number) => void;
  onDragEnd: () => void;
  onDropOnCategory: (categoryName: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  categoryBytes?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [dropHover, setDropHover] = useState(false);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return (
    <div
      className={`v-card overflow-hidden transition-shadow duration-200 ${
        dropHover ? 'ring-2 ring-[var(--t-accent)] shadow-lg' : ''
      }`}
    >
      {/* Category header -- also a drop target */}
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropHover(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDropHover(true); }}
        onDragLeave={() => setDropHover(false)}
        onDrop={(e) => { e.preventDefault(); setDropHover(false); onDropOnCategory(category); }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center justify-between p-4 hover:bg-hover/50 transition-colors cursor-pointer ${
            dropHover ? 'bg-[var(--t-accent)]/10' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="section-label">{category}</span>
            <span className="text-xs text-faint bg-surface px-2 py-0.5 rounded-full">
              {t('organizer.filesInCategory', { count: items.length })}
            </span>
            {categoryBytes !== undefined && (
              <span className="text-xs text-faint">{formatBytes(categoryBytes)}</span>
            )}
            {dropHover && (
              <span className="text-xs text-[var(--t-accent)] font-medium animate-pulse">
                {t('organizer.dropHere')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onApproveCategory(category); }}
              className="text-xs text-[var(--t-accent)] hover:opacity-80 px-2 py-1 rounded cursor-pointer"
            >
              {t('organizer.approveCategory')}
            </button>
            <svg
              className={`w-4 h-4 text-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-edge max-h-72 overflow-y-auto">
          {visibleItems.map((item) => {
            const isBeingDragged = draggingFileId === item.fileId;

            return (
              <div
                key={item.fileId}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(item.fileId));
                  e.dataTransfer.effectAllowed = 'move';
                  onDragStart(item.fileId);
                }}
                onDragEnd={() => onDragEnd()}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-hover/50 transition-all border-b border-edge/50 last:border-b-0 ${
                  isBeingDragged ? 'opacity-30 scale-[0.97]' : 'opacity-100'
                }`}
                style={{ cursor: 'grab' }}
              >
                <svg className="w-4 h-4 text-faint/50 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="9" cy="6" r="1.5" />
                  <circle cx="15" cy="6" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" />
                  <circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="18" r="1.5" />
                  <circle cx="15" cy="18" r="1.5" />
                </svg>

                <label
                  className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={item.approved}
                    onChange={() => onToggle(item.fileId)}
                    className="w-4 h-4 rounded accent-[var(--t-accent)] mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground truncate">{item.currentName}</span>
                      {item.suggestedName && (
                        <span className="text-xs text-[var(--t-accent)]">
                          &rarr; {item.suggestedName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-faint mt-0.5 truncate font-mono" title={item.currentPath}>
                      {t('common.from')}: {shortPath(item.currentPath)}
                    </div>
                    <div className="text-xs text-success mt-0.5 truncate font-mono" title={item.destPath}>
                      {t('common.to')}: {shortPath(item.destPath)}
                    </div>
                  </div>
                </label>
              </div>
            );
          })}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(c => c + ITEMS_PER_PAGE)}
              className="w-full py-2.5 text-xs text-[var(--t-accent)] hover:bg-hover/30 transition-colors cursor-pointer border-t border-edge/50"
            >
              {t('organizer.showMore', { count: items.length - visibleCount })}
            </button>
          )}
        </div>
      )}
    </div>
  );
});
