import React, { useEffect, useState } from 'react';
import { ActivityConsole } from './components/ActivityConsole';
import { AssetDetailsModal } from './components/AssetDetailsModal';
import { LoginModal } from './components/LoginModal';
import { PathOnboardingModal } from './components/PathOnboardingModal';
import { RepairPromptModal } from './components/RepairPromptModal';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { AppProvider, useApp } from './context/AppContext';
import { openExternalUrl } from './services/tauriBridge';
import { AirframesView } from './views/AirframesView';
import { AwardsView } from './views/AwardsView';
import { CatalogView } from './views/CatalogView';
import { DashboardView } from './views/DashboardView';
import { LibraryView } from './views/LibraryView';
import { LoginGateView } from './views/LoginGateView';
import { QualificationsView } from './views/QualificationsView';
import { SettingsView } from './views/SettingsView';

const MainShell: React.FC = () => {
  const { activeTab, setActiveTab, userSession } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        e.preventDefault();
        openExternalUrl(href);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  // Require an authenticated Discord session with a verified GTFO role (Community or CORE)
  // before rendering any part of the application.
  const baseRoleVerified =
    userSession &&
    userSession.isGuildMember &&
    userSession.tier !== 'guest';

  if (!baseRoleVerified) {
    return <LoginGateView />;
  }

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (q.trim() && activeTab !== 'liveries' && activeTab !== 'mods') {
      setActiveTab('liveries');
    }
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-stone-950 text-stone-200">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-topo">
        <TopBar searchQuery={searchQuery} onSearchChange={handleSearchChange} />

        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'airframes' && <AirframesView />}
          {activeTab === 'qualifications' && <QualificationsView />}
          {activeTab === 'awards' && <AwardsView />}
          {activeTab === 'liveries' && (
            <CatalogView category="livery" searchQuery={searchQuery} />
          )}
          {activeTab === 'mods' && (
            <CatalogView category="mod" searchQuery={searchQuery} />
          )}
          {activeTab === 'library' && <LibraryView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>

        <ActivityConsole />
      </div>

      <AssetDetailsModal />
      <RepairPromptModal />
      <LoginModal />
      <PathOnboardingModal />
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainShell />
    </AppProvider>
  );
}

export default App;
