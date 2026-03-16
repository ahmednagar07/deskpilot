import React, { useState, useEffect, Component, ReactNode } from 'react';
import TitleBar from './components/layout/TitleBar';
import Sidebar from './components/layout/Sidebar';
import StoragePage from './components/storage/StoragePage';
import ScannerPage from './components/scanner/ScannerPage';
import OrganizerPage from './components/organizer/OrganizerPage';
import SearchPage from './components/search/SearchPage';
import SearchOverlay from './components/search/SearchOverlay';
import DashboardPage from './components/dashboard/DashboardPage';
import SettingsPage from './components/settings/SettingsPage';
import FirstRunWizard from './components/wizard/FirstRunWizard';
import ToastContainer from './components/shared/Toast';

type Page = 'dashboard' | 'storage' | 'scanner' | 'organizer' | 'search' | 'settings';

// Render the search overlay if loaded via #/search-overlay hash route
const isSearchOverlay = window.location.hash === '#/search-overlay';

class PageErrorBoundary extends Component<{ children: ReactNode; page: string }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidUpdate(prevProps: { page: string }) {
    if (prevProps.page !== this.props.page) this.setState({ hasError: false });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-faint/30 mb-4">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>
          </svg>
          <p className="text-muted text-lg mb-1" style={{ fontFamily: 'Sora, sans-serif' }}>
            This page requires the Electron app
          </p>
          <p className="text-faint text-sm">Run with <code className="font-mono text-accent/60 px-1.5 py-0.5 rounded bg-accent/5">npm run dev</code> then <code className="font-mono text-accent/60 px-1.5 py-0.5 rounded bg-accent/5">npm start</code></p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // If this is the search overlay window, render only the overlay
  // This check is before hooks since isSearchOverlay is a module-level constant
  // and the component always takes the same branch.
  if (isSearchOverlay) {
    return (
      <div className="p-2" style={{ background: 'transparent' }}>
        <SearchOverlay />
      </div>
    );
  }

  return <DashboardApp />;
}

function DashboardApp() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [showWizard, setShowWizard] = useState<boolean | null>(null);

  useEffect(() => {
    checkFirstRun();
  }, []);

  const checkFirstRun = async () => {
    if (!window.api) {
      setShowWizard(false);
      return;
    }
    try {
      const setupComplete = await window.api.invoke('settings:get', 'setup_complete');
      setShowWizard(!setupComplete);
    } catch {
      setShowWizard(false);
    }
  };

  // Still loading the check
  if (showWizard === null) {
    return <div className="noise flex items-center justify-center h-full w-full bg-surface bg-mesh" />;
  }

  if (showWizard) {
    return <FirstRunWizard onComplete={() => setShowWizard(false)} />;
  }

  return (
    <div className="noise flex flex-col h-full w-full bg-surface">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
        <main className="flex-1 overflow-y-auto p-8 bg-mesh min-h-0">
          <div className="page-enter h-full" key={currentPage}>
            <PageErrorBoundary page={currentPage}>
              <PageContent page={currentPage} />
            </PageErrorBoundary>
          </div>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

function PageContent({ page }: { page: Page }) {
  switch (page) {
    case 'dashboard': return <DashboardPage />;
    case 'storage': return <StoragePage />;
    case 'scanner': return <ScannerPage />;
    case 'organizer': return <OrganizerPage />;
    case 'search': return <SearchPage />;
    case 'settings': return <SettingsPage />;
    default: return <DashboardPage />;
  }
}
