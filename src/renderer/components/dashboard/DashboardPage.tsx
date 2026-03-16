import React, { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';

interface DashboardData {
  fileCount: number;
  byCategory: Array<{ category_name: string; category_slug: string; color: string; count: number; total_size: number }>;
  recentActivity: Array<{ id: number; source_path: string; dest_path: string; operation: string; executed_at: string }>;
  drives: Array<{ path: string; totalBytes: number; freeBytes: number; usedBytes: number }>;
  watchedFolders: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const STAT_THEMES = [
  { bar: 'linear-gradient(90deg, #7C5CFC, #A78BFA)', glow: 'rgba(124, 92, 252, 0.05)', shadow: 'rgba(124, 92, 252, 0.08)', iconColor: '#9B7FFF' },
  { bar: 'linear-gradient(90deg, #22D3EE, #2DD4A8)', glow: 'rgba(34, 211, 238, 0.05)', shadow: 'rgba(34, 211, 238, 0.08)', iconColor: '#22D3EE' },
  { bar: 'linear-gradient(90deg, #F0C246, #FB923C)', glow: 'rgba(240, 194, 70, 0.04)', shadow: 'rgba(240, 194, 70, 0.08)', iconColor: '#F0C246' },
  { bar: 'linear-gradient(90deg, #2DD4A8, #A78BFA)', glow: 'rgba(45, 212, 168, 0.04)', shadow: 'rgba(45, 212, 168, 0.08)', iconColor: '#2DD4A8' },
];

const STAT_ICONS = [
  // Files
  <svg key="files" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>,
  // Disk
  <svg key="disk" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>,
  // Tags
  <svg key="tags" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  // Eye
  <svg key="eye" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
];

/* ── Donut Chart Component ───────────────────────────────────── */
function DonutChart({ segments, size = 180, strokeWidth = 22, centerLabel, centerSub }: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  if (total === 0) return null;

  let accumulated = 0;
  const arcs = segments.map((seg, i) => {
    const fraction = seg.value / total;
    const dashLen = fraction * circumference;
    const gap = circumference - dashLen;
    const offset = -accumulated * circumference + circumference * 0.25; // start at top
    accumulated += fraction;
    return { ...seg, dashLen, gap, offset, idx: i };
  });

  const center = size / 2;

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto 12px' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        {/* Background track */}
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--t-donut-track)" strokeWidth={strokeWidth} />
        {arcs.map((arc) => {
          const isHovered = hoveredIdx === arc.idx;
          return (
            <circle
              key={arc.idx}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
              strokeDasharray={`${arc.dashLen} ${arc.gap}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="butt"
              style={{
                transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                opacity: hoveredIdx !== null && !isHovered ? 0.4 : 0.85,
                cursor: 'pointer',
                filter: isHovered ? `drop-shadow(0 0 6px ${arc.color}60)` : 'none',
              }}
              onMouseEnter={() => setHoveredIdx(arc.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          );
        })}
      </svg>
      {/* Center text */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {hoveredIdx !== null ? (
          <>
            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--t-foreground)', lineHeight: 1.1 }}>
              {arcs[hoveredIdx].value}
            </span>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'var(--t-muted)', marginTop: 2, maxWidth: size * 0.5, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {arcs[hoveredIdx].label}
            </span>
          </>
        ) : (
          <>
            {centerLabel && (
              <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--t-foreground)', lineHeight: 1.1 }}>
                {centerLabel}
              </span>
            )}
            {centerSub && (
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'var(--t-muted)', marginTop: 2 }}>
                {centerSub}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    if (!window.api) {
      setError(true);
      return;
    }
    try {
      const [fileCount, byCategory, recentActivity, drives, watchedFolders] = await Promise.all([
        window.api.invoke('files:count') as Promise<number>,
        window.api.invoke('files:by-category') as Promise<DashboardData['byCategory']>,
        window.api.invoke('activity:recent', 5) as Promise<DashboardData['recentActivity']>,
        window.api.invoke('storage:drives') as Promise<DashboardData['drives']>,
        window.api.invoke('watcher:count') as Promise<number>,
      ]);
      setData({ fileCount, byCategory, recentActivity, drives, watchedFolders });
    } catch {
      setError(true);
    }
  };

  // Loading skeleton
  if (!data && !error) {
    return (
      <div className="space-y-6">
        <div>
          <div className="skeleton h-8 w-48 mb-2" />
          <div className="skeleton h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="skeleton h-48 rounded-xl" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  // Fallback welcome when not in Electron or fresh install
  if (error || !data) {
    return <WelcomeDashboard />;
  }

  const totalTrackedSize = data.byCategory.reduce((sum, c) => sum + c.total_size, 0);

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>
        <p className="text-muted text-sm mt-1">{t('dashboard.overview')}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('dashboard.trackedFiles'), value: data.fileCount },
          { label: t('dashboard.totalSize'), value: formatBytes(totalTrackedSize) },
          { label: t('dashboard.categories'), value: data.byCategory.filter(c => c.count > 0).length },
          { label: t('dashboard.watching'), value: `${data.watchedFolders} ${t('common.files')}` },
        ].map((stat, i) => (
          <div key={stat.label} className="stat-card"
            style={{ '--stat-bar': STAT_THEMES[i].bar, '--stat-glow': STAT_THEMES[i].glow, '--stat-shadow': STAT_THEMES[i].shadow } as React.CSSProperties}>
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <div className="text-[11px] font-medium text-faint mb-1 uppercase tracking-wider" style={{ fontFamily: 'Sora, sans-serif' }}>{stat.label}</div>
                <div className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'Sora, sans-serif' }}>{stat.value}</div>
              </div>
              <div style={{ color: STAT_THEMES[i].iconColor, opacity: 0.5 }}>{STAT_ICONS[i]}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Storage Overview */}
        <div className="v-card p-5">
          <div className="section-label mb-4">{t('dashboard.storageOverview')}</div>
          {data.drives.length > 0 && (() => {
            const primary = data.drives[0];
            const usedPct = Math.round((primary.usedBytes / primary.totalBytes) * 100);
            const isLow = (primary.freeBytes / primary.totalBytes) < 0.1;
            return (
              <DonutChart
                size={120}
                strokeWidth={16}
                centerLabel={`${usedPct}%`}
                centerSub="used"
                segments={[
                  { label: 'Used', value: primary.usedBytes, color: isLow ? '#FF4D6A' : usedPct > 75 ? '#F0C246' : '#2DD4A8' },
                  { label: 'Free', value: primary.freeBytes, color: '#1a1a2e' },
                ]}
              />
            );
          })()}
          <div className="space-y-4">
            {data.drives.map(drive => {
              const pct = Math.round((drive.usedBytes / drive.totalBytes) * 100);
              const isLow = (drive.freeBytes / drive.totalBytes) < 0.1;
              return (
                <div key={drive.path}>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-foreground font-medium font-mono text-[13px]">{drive.path.replace('/', '')}</span>
                    <span className={isLow ? 'text-danger font-medium' : 'text-faint'}>
                      {formatBytes(drive.freeBytes)} free
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{
                      width: `${pct}%`,
                      '--bar-from': isLow ? '#FF4D6A' : pct > 75 ? '#F0C246' : '#2DD4A8',
                      '--bar-to': isLow ? '#D6264A' : pct > 75 ? '#FB923C' : '#22D3EE',
                    } as React.CSSProperties} />
                  </div>
                </div>
              );
            })}
            {data.drives.length === 0 && (
              <p className="text-sm text-faint">No drives detected.</p>
            )}
          </div>
        </div>

        {/* Files by Category */}
        <div className="v-card p-5">
          <div className="section-label mb-4">{t('dashboard.filesByCategory')}</div>
          {data.byCategory.some(c => c.count > 0) && (
            <DonutChart
              size={180}
              strokeWidth={22}
              centerLabel={String(data.byCategory.reduce((s, c) => s + c.count, 0))}
              centerSub="total files"
              segments={data.byCategory
                .filter(c => c.count > 0)
                .sort((a, b) => b.count - a.count)
                .map(c => ({ label: c.category_name, value: c.count, color: c.color }))}
            />
          )}
          <div className="space-y-2.5">
            {(() => {
              const sorted = data.byCategory.filter(c => c.count > 0).sort((a, b) => b.count - a.count);
              const maxCount = sorted.length > 0 ? sorted[0].count : 1;
              return sorted.map(cat => (
                  <div key={cat.category_slug} className="group flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color, boxShadow: `0 0 6px ${cat.color}40` }} />
                    <span className="text-[13px] text-foreground w-24 truncate">{cat.category_name}</span>
                    <div className="flex-1 h-[3px] rounded-full bg-edge/40 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(cat.count / maxCount) * 100}%`, backgroundColor: cat.color, opacity: 0.6 }} />
                    </div>
                    <span className="text-xs text-faint w-16 text-right font-mono">{formatBytes(cat.total_size)}</span>
                    <span className="text-xs text-muted font-medium w-8 text-right font-mono">{cat.count}</span>
                  </div>
                ));
            })()}
            {data.byCategory.every(c => c.count === 0) && (
              <div className="flex flex-col items-center py-6">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-faint/30 mb-3">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <p className="text-sm text-faint">No files scanned yet</p>
                <p className="text-xs text-faint/60 mt-1">Go to Scanner to start</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="v-card p-5">
        <div className="section-label mb-4">{t('dashboard.recentActivity')}</div>
        {data.recentActivity.length > 0 ? (
          <div className="space-y-2">
            {data.recentActivity.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 py-1.5 text-[13px]">
                <span className="text-[11px] px-2.5 py-1 rounded-md font-medium font-mono"
                  style={{ background: 'rgba(124,92,252,0.08)', color: '#9B7FFF' }}>
                  {entry.operation}
                </span>
                <span className="text-faint truncate flex-1 font-mono text-xs">
                  {entry.source_path.split('/').pop()} <span className="text-accent/40">-&gt;</span> {entry.dest_path.split('/').slice(-2).join('/')}
                </span>
                <span className="text-[11px] text-faint/60 whitespace-nowrap">
                  {new Date(entry.executed_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 py-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-faint/30">
              <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/>
            </svg>
            <p className="text-sm text-faint">{t('dashboard.noMovesYet')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WelcomeDashboard() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[500px]">
      {/* Hero glow */}
      <div className="relative mb-10">
        <div className="absolute inset-0 blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, #7C5CFC, transparent 70%)' }} />
        <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #7C5CFC, #A78BFA)', boxShadow: '0 0 40px rgba(124,92,252,0.25)' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="white" stroke="none">
            <rect x="3" y="3" width="7" height="7" rx="2" opacity="0.95"/>
            <rect x="14" y="3" width="7" height="7" rx="2" opacity="0.6"/>
            <rect x="3" y="14" width="7" height="7" rx="2" opacity="0.6"/>
            <rect x="14" y="14" width="7" height="7" rx="2" opacity="0.35"/>
          </svg>
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Sora, sans-serif', background: 'linear-gradient(90deg, var(--t-title-gradient-from), var(--t-title-gradient-to))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Welcome to DeskPilot
      </h1>
      <p className="text-muted text-center max-w-md mb-10">
        Smart desktop file management. Scan, classify, and organize your files with AI-powered intelligence.
      </p>

      <div className="grid grid-cols-3 gap-5 max-w-xl w-full">
        {[
          { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>, label: 'Scan Files', desc: 'Discover & classify' },
          { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>, label: 'Organize', desc: 'Smart file moves' },
          { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>, label: 'Clean Up', desc: 'Reclaim space' },
        ].map(item => (
          <div key={item.label} className="v-card p-5 flex flex-col items-center text-center gap-3">
            <div className="text-accent/60">{item.icon}</div>
            <span className="text-[13px] font-medium text-foreground">{item.label}</span>
            <span className="text-[11px] text-faint">{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
