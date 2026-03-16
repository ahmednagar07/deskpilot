import React, { useEffect, useState } from 'react';

type Page = 'dashboard' | 'storage' | 'scanner' | 'organizer' | 'search' | 'settings';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

interface NavItem {
  id: Page;
  label: string;
  icon: React.ReactNode;
}

const mainNav: NavItem[] = [
  {
    id: 'dashboard', label: 'Dashboard',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    id: 'storage', label: 'Storage',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  },
  {
    id: 'scanner', label: 'Scanner',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  },
  {
    id: 'organizer', label: 'Organize',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  },
  {
    id: 'search', label: 'Search',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  },
];

const bottomNav: NavItem[] = [
  {
    id: 'settings', label: 'Settings',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const [folderCount, setFolderCount] = useState<number | null>(null);

  useEffect(() => {
    window.api?.invoke('watcher:count').then((c) => setFolderCount(c as number)).catch(() => {});
  }, []);

  return (
    <nav className="relative flex flex-col w-56 shrink-0" style={{ background: 'linear-gradient(180deg, #0c0c1c, #0a0a16)' }}>
      {/* Right edge glow line */}
      <div className="absolute top-0 right-0 bottom-0 w-px"
        style={{ background: 'linear-gradient(180deg, rgba(124,92,252,0.15), rgba(124,92,252,0.04) 50%, rgba(34,211,238,0.06))' }} />

      <div className="flex-1 py-4 px-3 space-y-0.5">
        <div className="section-label px-3 mb-3">Navigation</div>
        {mainNav.map((item) => (
          <NavButton key={item.id} item={item} isActive={currentPage === item.id} onClick={() => onNavigate(item.id)} />
        ))}
      </div>

      <div className="py-4 px-3 space-y-0.5">
        <div className="h-px mx-3 mb-3" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,92,252,0.1), transparent)' }} />
        {bottomNav.map((item) => (
          <NavButton key={item.id} item={item} isActive={currentPage === item.id} onClick={() => onNavigate(item.id)} />
        ))}

        {folderCount !== null && folderCount > 0 && (
          <div className="px-3 pt-4 pb-1">
            <div className="flex items-center gap-2.5 text-[11px] text-faint/70">
              <span className="w-[6px] h-[6px] rounded-full bg-success animate-pulse-dot" />
              <span style={{ fontFamily: 'DM Sans, sans-serif' }}>Watching {folderCount} folder{folderCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function NavButton({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative w-full flex items-center gap-3 px-3 py-[9px] rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer"
      style={{
        fontFamily: 'DM Sans, sans-serif',
        color: isActive ? '#E8E6F0' : '#8E8BA8',
        background: isActive ? 'rgba(124, 92, 252, 0.08)' : 'transparent',
        boxShadow: isActive ? 'inset 0 0 20px rgba(124, 92, 252, 0.04)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(124, 92, 252, 0.04)';
          e.currentTarget.style.color = '#E8E6F0';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#8E8BA8';
        }
      }}
    >
      {/* Left accent bar for active state */}
      {isActive && (
        <div className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full"
          style={{ background: 'linear-gradient(180deg, #7C5CFC, #A78BFA)', boxShadow: '0 0 8px rgba(124,92,252,0.4)' }} />
      )}
      <span style={{
        color: isActive ? '#9B7FFF' : '#4E4B6B',
        filter: isActive ? 'drop-shadow(0 0 4px rgba(124,92,252,0.3))' : 'none',
        transition: 'all 0.2s',
      }}>
        {item.icon}
      </span>
      {item.label}
    </button>
  );
}
