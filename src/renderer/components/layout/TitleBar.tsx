import React, { useEffect, useState } from 'react';

export default function TitleBar() {
  const [version, setVersion] = useState('');
  const handleMinimize = () => window.api?.invoke('window:minimize');
  const handleMaximize = () => window.api?.invoke('window:maximize');
  const handleClose = () => window.api?.invoke('window:close');

  useEffect(() => {
    window.api?.invoke('app:get-version').then((v: unknown) => {
      if (typeof v === 'string') setVersion(v);
    }).catch(() => {});
  }, []);

  return (
    <header className="drag-region relative flex items-center justify-between h-10 px-4 select-none shrink-0"
      role="banner" style={{ background: 'var(--t-titlebar-bg)' }}>
      {/* Holographic bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'var(--t-holo-edge)' }} />

      <div className="flex items-center gap-3">
        <div className="relative w-[22px] h-[22px] rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #7C5CFC, #A78BFA)', boxShadow: '0 0 14px rgba(124,92,252,0.25)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none">
            <rect x="3" y="3" width="7" height="7" rx="1.5" opacity="0.95"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5" opacity="0.6"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5" opacity="0.6"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5" opacity="0.35"/>
          </svg>
        </div>
        <span className="text-[13px] font-semibold tracking-tight"
          style={{
            fontFamily: 'Sora, sans-serif',
            background: 'linear-gradient(90deg, var(--t-title-gradient-from), var(--t-title-gradient-to))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
          DeskPilot
        </span>
        {version && <span className="text-faint/35 text-[10px] font-mono">{version}</span>}
      </div>

      <div className="no-drag flex items-center" role="group" aria-label="Window controls">
        <button onClick={handleMinimize}
          aria-label="Minimize window"
          className="w-11 h-10 flex items-center justify-center text-faint/50 hover:text-foreground hover:bg-white/[0.04] transition-all duration-200"
          title="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor" aria-hidden="true"><rect width="10" height="1" /></svg>
        </button>
        <button onClick={handleMaximize}
          aria-label="Maximize window"
          className="w-11 h-10 flex items-center justify-center text-faint/50 hover:text-foreground hover:bg-white/[0.04] transition-all duration-200"
          title="Maximize">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><rect x="0.5" y="0.5" width="9" height="9" /></svg>
        </button>
        <button onClick={handleClose}
          aria-label="Close window"
          className="w-11 h-10 flex items-center justify-center text-faint/50 hover:text-white hover:bg-danger/80 transition-all duration-200"
          title="Close">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M1 0L0 1L4 5L0 9L1 10L5 6L9 10L10 9L6 5L10 1L9 0L5 4L1 0Z" /></svg>
        </button>
      </div>
    </header>
  );
}
