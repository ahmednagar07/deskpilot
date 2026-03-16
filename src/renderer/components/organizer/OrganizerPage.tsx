import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useOrganizerStore, UndoSession } from '../../stores/organizer-store';
import { useToastStore } from '../../stores/toast-store';
import { MovePlanItem, Category } from '../../../shared/types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  if (parts.length <= 3) return p;
  return parts.slice(0, 2).join('/') + '/.../' + parts.slice(-1).join('/');
}

/** Build a new destPath for a file when it's reclassified to a different category */
function buildDestPath(item: MovePlanItem, targetPath: string): string {
  const fileName = item.suggestedName || item.currentName;
  // Normalise slashes and join
  const base = targetPath.replace(/[\\/]+$/, '');
  return `${base}\\${fileName}`;
}

export default function OrganizerPage() {
  const {
    plan, isGenerating, isExecuting, undoHistory,
    setPlan, setIsGenerating, setIsExecuting, setUndoHistory,
    toggleApproval, approveAll, deselectAll,
  } = useOrganizerStore();

  const addToast = useToastStore(s => s.addToast);
  const [activeTab, setActiveTab] = useState<'plan' | 'history'>('plan');
  const [executionResult, setExecutionResult] = useState<{ succeeded: number; failed: number } | null>(null);

  // Drag & drop state
  const [draggingFileId, setDraggingFileId] = useState<number | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Load undo history on mount
  useEffect(() => {
    loadHistory();
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
    try {
      const result = await window.api.invoke('organizer:generate-plan') as MovePlanItem[];
      setPlan(result);
    } catch (err) {
      console.error('Failed to generate plan:', err);
      addToast('error', 'Failed to generate move plan. Check logs for details.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecute = async () => {
    const approved = plan.filter(item => item.approved);
    if (approved.length === 0) return;

    setIsExecuting(true);
    try {
      const result = await window.api.invoke('organizer:execute', approved) as {
        succeeded: number; failed: number; sessionId: string; errors: Array<{ path: string; error: string }>;
        error?: string;
      };

      if (result.error) {
        console.error('Execute error:', result.error);
        addToast('error', `Move failed: ${result.error}`);
        return;
      }

      setExecutionResult({ succeeded: result.succeeded, failed: result.failed });

      if (result.failed > 0) {
        addToast('warning', `Moved ${result.succeeded} files, ${result.failed} failed`);
      } else {
        addToast('success', `Successfully moved ${result.succeeded} files`);
      }

      // Remove succeeded items from plan
      const failedPaths = new Set(result.errors?.map(e => e.path) || []);
      setPlan(plan.filter(item => failedPaths.has(item.currentPath)));

      await loadHistory();
    } catch (err) {
      console.error('Execute failed:', err);
      addToast('error', 'File move execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleUndoSession = async (sessionId: string) => {
    try {
      await window.api.invoke('organizer:undo-batch', sessionId);
      await loadHistory();
      addToast('success', 'Undo completed successfully');
    } catch (err) {
      console.error('Undo failed:', err);
      addToast('error', 'Undo failed');
    }
  };

  // --- Drag & Drop: reclassify a file into a new category ---
  const handleDropOnCategory = useCallback((categoryName: string) => {
    if (draggingFileId == null) return;

    const cat = allCategories.find(c => c.name === categoryName);
    if (!cat) return;

    const updated = plan.map(item => {
      if (item.fileId !== draggingFileId) return item;
      if (item.category === categoryName) return item; // no-op
      return {
        ...item,
        category: categoryName,
        destPath: buildDestPath(item, cat.target_path),
      };
    });

    setPlan(updated);
    setDraggingFileId(null);
    setIsDragging(false);
    addToast('success', `Moved file to "${categoryName}"`);
  }, [draggingFileId, allCategories, plan, setPlan, addToast]);

  const approvedCount = plan.filter(p => p.approved).length;

  // Group plan by category
  const grouped = plan.reduce<Record<string, MovePlanItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  // Categories present in the plan
  const categoriesInPlan = new Set(Object.keys(grouped));

  // Categories NOT in the current plan (for the floating dock)
  const dockCategories = allCategories.filter(c => !categoriesInPlan.has(c.name));

  return (
    <div className="space-y-6 relative pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[Sora]">Auto-Organizer</h1>
          <p className="text-muted text-sm mt-1">
            Review the move plan, approve changes, then execute. Every move can be undone.
          </p>
        </div>
        <button
          onClick={handleGeneratePlan}
          disabled={isGenerating}
          className="px-5 py-2.5 btn-primary rounded-xl disabled:opacity-50 text-white font-medium text-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {isGenerating ? 'Generating...' : 'Generate Plan'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-edge">
        <button
          onClick={() => setActiveTab('plan')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'plan' ? 'border-[#7C5CFC] text-[#9B7FFF]' : 'border-transparent text-faint hover:text-muted'
          }`}
        >
          Move Plan {plan.length > 0 && `(${plan.length})`}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'history' ? 'border-[#7C5CFC] text-[#9B7FFF]' : 'border-transparent text-faint hover:text-muted'
          }`}
        >
          Undo History {undoHistory.length > 0 && `(${undoHistory.length})`}
        </button>
      </div>

      {activeTab === 'plan' && (
        <>
          {/* Execution result */}
          {executionResult && (
            <div className={`p-3 rounded-xl border text-sm ${
              executionResult.failed === 0
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-warning/10 border-warning/30 text-warning'
            }`}>
              Moved {executionResult.succeeded} files successfully.
              {executionResult.failed > 0 && ` ${executionResult.failed} failed.`}
            </div>
          )}

          {/* Approval bar */}
          {plan.length > 0 && (
            <div className="flex items-center justify-between v-card p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted">
                  <span className="text-foreground font-semibold">{plan.length}</span> files to organize
                </span>
                <span className="text-sm text-muted">
                  <span className="text-[#9B7FFF] font-semibold">{approvedCount}</span> approved
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={approveAll} className="text-xs text-[#9B7FFF] hover:text-[#7C5CFC] cursor-pointer">
                  Approve All
                </button>
                <button onClick={deselectAll} className="text-xs text-faint hover:text-muted cursor-pointer">
                  Clear
                </button>
                <button
                  onClick={handleExecute}
                  disabled={approvedCount === 0 || isExecuting}
                  className="px-4 py-2 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg, #2DD4A8, #1A9F7C)' }}
                >
                  {isExecuting ? 'Moving...' : `Move ${approvedCount} Files`}
                </button>
              </div>
            </div>
          )}

          {/* Drag hint */}
          {plan.length > 0 && !isDragging && (
            <p className="text-xs text-faint text-center">
              Tip: Drag files onto category headers or the dock below to reclassify them.
            </p>
          )}

          {/* Grouped plan items */}
          {Object.entries(grouped).map(([category, items]) => (
            <PlanGroup
              key={category}
              category={category}
              items={items}
              onToggle={toggleApproval}
              draggingFileId={draggingFileId}
              onDragStart={(fileId) => { setDraggingFileId(fileId); setIsDragging(true); }}
              onDragEnd={() => { setDraggingFileId(null); setIsDragging(false); }}
              onDropOnCategory={handleDropOnCategory}
            />
          ))}

          {/* Empty state */}
          {plan.length === 0 && !isGenerating && (
            <div className="text-center py-16">
              <svg className="w-14 h-14 mx-auto text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="text-muted mt-4 text-lg">
                Click "Generate Plan" to create a move plan from classified files
              </p>
              <p className="text-faint mt-2 text-sm">
                Make sure you've scanned files first in the Scanner tab
              </p>
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
              <p className="text-muted mt-4 text-lg">No move history yet</p>
            </div>
          ) : (
            undoHistory.map((session) => (
              <div
                key={session.session_id}
                className="v-card p-4 flex items-center justify-between"
              >
                <div>
                  <span className="text-sm text-foreground font-medium">
                    {session.count} files moved
                  </span>
                  <span className="text-xs text-faint ml-3">
                    {new Date(session.executed_at).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => handleUndoSession(session.session_id)}
                  className="px-3 py-1.5 border border-edge text-muted rounded-xl text-xs font-medium cursor-pointer hover:bg-hover/50 hover:text-foreground transition-colors"
                >
                  Undo Session
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Floating category dock -- visible only when dragging */}
      {isDragging && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-[#7C5CFC]/40 bg-[#1A1A2E]/95 backdrop-blur-lg shadow-[0_0_30px_rgba(124,92,252,0.25)]"
          style={{ maxWidth: '90vw' }}
        >
          <span className="text-[10px] uppercase tracking-widest text-faint mr-2 select-none">
            Drop onto category
          </span>
          {allCategories.map(cat => (
            <CategoryDockPill
              key={cat.id}
              category={cat}
              onDrop={handleDropOnCategory}
            />
          ))}
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
          ? 'bg-[#7C5CFC]/30 text-white ring-2 ring-[#7C5CFC] scale-110'
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

function PlanGroup({
  category,
  items,
  onToggle,
  draggingFileId,
  onDragStart,
  onDragEnd,
  onDropOnCategory,
}: {
  category: string;
  items: MovePlanItem[];
  onToggle: (fileId: number) => void;
  draggingFileId: number | null;
  onDragStart: (fileId: number) => void;
  onDragEnd: () => void;
  onDropOnCategory: (categoryName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [dropHover, setDropHover] = useState(false);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return (
    <div
      className={`v-card overflow-hidden transition-shadow duration-200 ${
        dropHover ? 'ring-2 ring-[#7C5CFC] shadow-[0_0_16px_rgba(124,92,252,0.35)]' : ''
      }`}
    >
      {/* Category header -- also a drop target */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropHover(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDropHover(true);
        }}
        onDragLeave={() => setDropHover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropHover(false);
          onDropOnCategory(category);
        }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center justify-between p-4 hover:bg-hover/50 transition-colors cursor-pointer ${
            dropHover ? 'bg-[#7C5CFC]/10' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="section-label">{category}</span>
            <span className="text-xs text-faint bg-surface px-2 py-0.5 rounded-full">
              {items.length} files
            </span>
            {dropHover && (
              <span className="text-xs text-[#9B7FFF] font-medium animate-pulse">
                Drop here
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
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
                {/* Drag handle indicator */}
                <svg
                  className="w-4 h-4 text-faint/50 mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
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
                    className="w-4 h-4 rounded accent-[#7C5CFC] mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground truncate">{item.currentName}</span>
                      {item.suggestedName && (
                        <span className="text-xs text-[#9B7FFF]">
                          &rarr; {item.suggestedName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-faint mt-0.5 truncate font-mono" title={item.currentPath}>
                      From: {shortPath(item.currentPath)}
                    </div>
                    <div className="text-xs text-success mt-0.5 truncate font-mono" title={item.destPath}>
                      To: {shortPath(item.destPath)}
                    </div>
                  </div>
                </label>
              </div>
            );
          })}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(c => c + ITEMS_PER_PAGE)}
              className="w-full py-2.5 text-xs text-[#9B7FFF] hover:text-accent-hover hover:bg-hover/30 transition-colors cursor-pointer border-t border-edge/50"
            >
              Show more ({items.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
